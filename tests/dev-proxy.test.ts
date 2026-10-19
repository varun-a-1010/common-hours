import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import viteConfig from '../vite.config';
import { buildApp } from '../server/app';
import { FileStore } from '../server/store';

describe('development API proxy', () => {
  let directory: string, api: FastifyInstance, vite: ViteDevServer, web: Server, origin: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'common-hours-proxy-'));
    api = await buildApp(new FileStore(directory));
    const target = await api.listen({ host: '127.0.0.1', port: 0 });
    const rule = viteConfig.server!.proxy!['/api'];
    vite = await createViteServer({
      configFile: false,
      logLevel: 'silent',
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
        // Keep the real proxy rule; only its test API destination changes.
        proxy: { '/api': typeof rule === 'string' ? target : { ...rule, target } },
      },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    web = createServer(vite.middlewares);
    await new Promise<void>((resolve) => web.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(web.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    if (web?.listening)
      await new Promise<void>((resolve, reject) =>
        web.close((error) => (error ? reject(error) : resolve())),
      );
    await vite?.close();
    await api?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it.each([false, true])('creates and reopens a workspace with demo=%s', async (demo) => {
    const created = await fetch(`${origin}/api/workspaces`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Proxy test team', demo }),
    });
    expect(created.status).toBe(201);
    const workspace = await created.json();
    expect(workspace.name).toBe('Proxy test team');
    expect(workspace.events.length > 0).toBe(demo);

    const cookie = created.headers.get('set-cookie')!.split(';')[0];
    const reopened = await fetch(`${origin}/api/workspace`, { headers: { cookie } });
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).id).toBe(workspace.id);
  });

  it('still rejects foreign origins even with forged forwarded headers', async () => {
    const rejected = await fetch(`${origin}/api/workspaces`, {
      method: 'POST',
      headers: {
        origin: 'https://other.example',
        'content-type': 'application/json',
        'x-forwarded-host': 'other.example',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ name: 'Rejected team' }),
    });
    expect(rejected.status).toBe(403);
    expect(await rejected.json()).toEqual({
      error: 'This request must come from the app itself.',
    });
  });
});
