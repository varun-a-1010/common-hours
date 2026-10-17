import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = mkdtempSync('/tmp/common-hours-pg-');
const data = join(root, 'data'),
  socket = join(root, 'socket');
mkdirSync(socket, { mode: 0o700 });
let started = false;
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 60000 });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
    );
  return result.stdout;
}
try {
  run('initdb', [
    '-D',
    data,
    '-U',
    'common_hours_test',
    '-A',
    'trust',
    '--no-locale',
    '-E',
    'UTF8',
  ]);
  run('pg_ctl', [
    '-D',
    data,
    '-l',
    join(root, 'postgres.log'),
    '-o',
    `-c listen_addresses='' -k ${socket} -p 55439`,
    '-w',
    'start',
  ]);
  started = true;
  const database = `postgresql://common_hours_test@localhost/postgres?host=${encodeURIComponent(socket)}&port=55439`;
  console.info('Testing a fresh, isolated PostgreSQL instance over its private Unix socket.');
  const result = spawnSync('npm', ['test', '--', 'tests/postgres.test.ts'], {
    stdio: 'inherit',
    env: { ...process.env, COMMON_HOURS_TEST_DATABASE: database },
    timeout: 60000,
  });
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
