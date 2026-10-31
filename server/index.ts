import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { FileStore, PostgresStore } from './store';
import { buildApp } from './app';
import { createTasteProvider } from './taste';
import { createExplainer } from './explain';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const store = process.env.DATABASE_URL
  ? new PostgresStore(process.env.DATABASE_URL)
  : new FileStore(resolve(process.env.DATA_DIR ?? '.data'));
const production = process.env.NODE_ENV === 'production';
const app = await buildApp(store, {
  taste: createTasteProvider({ apiKey: process.env.QLOO_API_KEY }),
  explain: createExplainer({
    project: process.env.VERTEX_LLM_PROJECT_ID,
    serviceAccount: process.env.VERTEX_LLM_SERVICE_ACCOUNT,
    location: process.env.VERTEX_LLM_REGION,
    backup: {
      project: process.env.VERTEX_LLM_BACKUP_PROJECT_ID,
      serviceAccount: process.env.VERTEX_LLM_BACKUP_SERVICE_ACCOUNT,
    },
  }),
  production,
  origin: process.env.APP_ORIGIN,
  staticRoot: production ? resolve('dist/client') : undefined,
});
const port = Number(process.env.PORT ?? 3192);
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
console.info(
  `Common Hours API listening on port ${port}. Storage: ${process.env.DATABASE_URL ? 'dedicated PostgreSQL' : 'local files'}.`,
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
