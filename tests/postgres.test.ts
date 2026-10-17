import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PostgresStore } from '../server/store';
import { newWorkspace } from '../server/data';

// The companion script starts a fresh Unix-socket-only Postgres in a private temp
// directory. Never point this at a shared or live application database.
const url = process.env.COMMON_HOURS_TEST_DATABASE;
describe.skipIf(!url)('isolated PostgreSQL storage', () => {
  let store: PostgresStore;
  afterAll(async () => {
    if (store) await store.close();
  });
  it('persists and serializes row mutations across concurrent transactions', async () => {
    store = new PostgresStore(url!);
    const { workspace } = newWorkspace('Database', false);
    await store.create(workspace);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.update(workspace.id, (w) => {
          w.name += '!';
        }),
      ),
    );
    const result = await store.get(workspace.id);
    expect(result?.version).toBe(10);
    expect(result?.name).toBe('Database!!!!!!!!!!');
    await expect(
      store.update(workspace.id, (w) => {
        w.name = 'Should roll back';
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect((await store.get(workspace.id))?.name).toBe('Database!!!!!!!!!!');
  });
  it('prepares the exact application SELECT/UPDATE statements against PostgreSQL', async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const { workspace } = newWorkspace('Explain', false);
      await store.create(workspace);
      const read = await client.query(
        'EXPLAIN SELECT data FROM common_hours_workspaces WHERE id = $1 FOR UPDATE',
        [workspace.id],
      );
      const update = await client.query(
        'EXPLAIN UPDATE common_hours_workspaces SET data = $2 WHERE id = $1',
        [workspace.id, JSON.stringify(workspace)],
      );
      expect(read.rows.length).toBeGreaterThan(0);
      expect(update.rows.length).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });
});
