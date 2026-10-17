import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { Workspace } from '../shared/model';

export interface Store {
  get(id: string): Promise<Workspace | null>;
  create(workspace: Workspace): Promise<void>;
  update<T>(
    id: string,
    change: (workspace: Workspace) => T,
  ): Promise<{ workspace: Workspace; result: T }>;
  close(): Promise<void>;
}
const validId = (id: string) => /^[a-f0-9-]{36}$/.test(id);
export class FileStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory: string) {}
  private path(id: string) {
    if (!validId(id)) throw new Error('Invalid workspace identifier.');
    return join(this.directory, `${id}.json`);
  }
  async get(id: string): Promise<Workspace | null> {
    if (!validId(id)) return null;
    try {
      return JSON.parse(await readFile(this.path(id), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  private async save(workspace: Workspace) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.path(workspace.id),
      temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(workspace), { mode: 0o600, flush: true });
    await rename(temp, target);
  }
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.catch(() => {});
    return result;
  }
  async create(workspace: Workspace) {
    await this.serial(async () => {
      if (await this.get(workspace.id)) throw new Error('Workspace already exists.');
      await this.save(workspace);
    });
  }
  async update<T>(id: string, change: (workspace: Workspace) => T) {
    return this.serial(async () => {
      const workspace = await this.get(id);
      if (!workspace) throw new Error('Workspace not found.');
      const result = change(workspace);
      workspace.version++;
      await this.save(workspace);
      return { workspace, result };
    });
  }
  async close() {
    await this.queue;
  }
}

/** A dedicated Common Hours Deltabase tenant, never the control-plane database. */
export class PostgresStore implements Store {
  private pool: pg.Pool;
  private ready: Promise<unknown>;
  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    this.ready = this.pool.query(
      'CREATE TABLE IF NOT EXISTS common_hours_workspaces (id uuid PRIMARY KEY, data jsonb NOT NULL)',
    );
  }
  async get(id: string): Promise<Workspace | null> {
    if (!validId(id)) return null;
    await this.ready;
    const result = await this.pool.query('SELECT data FROM common_hours_workspaces WHERE id = $1', [
      id,
    ]);
    return result.rows[0]?.data ?? null;
  }
  async create(workspace: Workspace) {
    await this.ready;
    await this.pool.query('INSERT INTO common_hours_workspaces (id, data) VALUES ($1, $2)', [
      workspace.id,
      JSON.stringify(workspace),
    ]);
  }
  async update<T>(id: string, change: (workspace: Workspace) => T) {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        'SELECT data FROM common_hours_workspaces WHERE id = $1 FOR UPDATE',
        [id],
      );
      const workspace = row.rows[0]?.data as Workspace | undefined;
      if (!workspace) throw new Error('Workspace not found.');
      const result = change(workspace);
      workspace.version++;
      await client.query('UPDATE common_hours_workspaces SET data = $2 WHERE id = $1', [
        id,
        JSON.stringify(workspace),
      ]);
      await client.query('COMMIT');
      return { workspace, result };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.ready;
    await this.pool.end();
  }
}
