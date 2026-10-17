import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../server/store';
import { newWorkspace } from '../server/data';

let directory: string, store: FileStore;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'common-hours-store-'));
  store = new FileStore(directory);
});
afterEach(async () => {
  await store.close();
  await rm(directory, { recursive: true, force: true });
});
describe('durable file storage', () => {
  it('serializes concurrent updates and keeps data files private', async () => {
    const { workspace } = newWorkspace('Private', false);
    await store.create(workspace);
    await Promise.all(
      Array.from({ length: 12 }, (_, n) =>
        store.update(workspace.id, (w) => {
          w.name += String(n);
        }),
      ),
    );
    const read = await store.get(workspace.id);
    expect(read?.version).toBe(12);
    expect(read?.name).toBe('Private01234567891011');
    expect((await stat(join(directory, `${workspace.id}.json`))).mode & 0o777).toBe(0o600);
  });
  it('does not persist a failed mutation and rejects traversal', async () => {
    const { workspace } = newWorkspace('Unchanged', false);
    await store.create(workspace);
    await expect(
      store.update(workspace.id, (w) => {
        w.name = 'Wrong';
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect((await store.get(workspace.id))?.name).toBe('Unchanged');
    expect(await store.get('../anything')).toBeNull();
  });
});
