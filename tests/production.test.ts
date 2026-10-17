import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../server/app';
import { FileStore } from '../server/store';

describe('production HTTP boundaries', () => {
  let cleanup: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await cleanup?.();
  });
  it('serves deep links and assets while keeping unknown API routes JSON-only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'common-hours-static-'));
    await mkdir(join(root, 'public'));
    await writeFile(
      join(root, 'public', 'index.html'),
      '<!doctype html><title>Common Hours</title>',
    );
    await writeFile(join(root, 'public', 'app.js'), 'export const healthy = true;');
    const app = await buildApp(new FileStore(join(root, 'data')), {
      staticRoot: join(root, 'public'),
      production: true,
      origin: 'https://common-hours.example',
    });
    cleanup = async () => {
      await app.close();
      await rm(root, { recursive: true, force: true });
    };
    expect((await app.inject({ url: '/share/an/event/link' })).body).toContain(
      '<title>Common Hours',
    );
    expect((await app.inject({ url: '/app.js' })).headers['content-type']).toContain('javascript');
    const absent = await app.inject({ url: '/api/not-real' });
    expect(absent.statusCode).toBe(404);
    expect(absent.headers['content-type']).toContain('json');
    const created = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { origin: 'https://common-hours.example' },
      payload: { name: 'Private app' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.cookies[0].secure).toBe(true);
    expect(created.cookies[0].httpOnly).toBe(true);
    expect(created.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(created.headers['cache-control']).toBe('no-store');
  });
});
