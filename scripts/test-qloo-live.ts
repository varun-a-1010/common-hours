import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { buildApp } from '../server/app';
import { FileStore } from '../server/store';
import { createTasteProvider } from '../server/taste';
import type { TasteDiscovery, TasteEntity, TasteKind } from '../shared/taste';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const key = process.env.QLOO_API_KEY;
if (!key)
  throw new Error('QLOO_API_KEY must be supplied to the server process for this opt-in live test.');
const directory = await mkdtemp(join(tmpdir(), 'common-hours-qloo-live-'));
let calls = 0;
const timings: { path: string; status: number; milliseconds: number }[] = [];
const boundedFetch: typeof fetch = async (input, init) => {
  if (++calls > 10) throw new Error('Live test request budget exceeded.');
  const start = performance.now();
  const response = await fetch(input, init);
  timings.push({
    path: new URL(String(input)).pathname,
    status: response.status,
    milliseconds: Math.round(performance.now() - start),
  });
  return response;
};
const app = await buildApp(new FileStore(directory), {
  taste: createTasteProvider({ apiKey: key, fetch: boundedFetch }),
});
try {
  const created = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    payload: { name: 'Isolated Qloo test', demo: true },
  });
  assert.equal(created.statusCode, 201);
  const workspace = created.json(),
    event = workspace.events[0];
  const cookie = created.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  async function search(query: string, kind: TasteKind) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/taste/search',
      headers: { cookie },
      payload: { query, kind },
    });
    assert.equal(response.statusCode, 200, response.json().error ?? 'Search failed');
    const match = (response.json().entities as TasteEntity[]).find(
      (e) => e.name.toLowerCase() === query.toLowerCase(),
    );
    assert.ok(match, `No exact ${query} search result; review matches instead of auto-resolving.`);
    return match;
  }
  const electronic = await search('Daft Punk', 'artist');
  const film = await search('Spirited Away', 'movie');
  const indian = await search('Arijit Singh', 'artist');
  async function discover(kind: TasteKind, entityIds: string[], focus = 'cafes') {
    const response = await app.inject({
      method: 'POST',
      url: `/api/events/${event.id}/taste`,
      headers: { cookie },
      payload: { version: workspace.version, kind, entityIds, focus },
    });
    assert.equal(response.statusCode, 200, response.json().error ?? 'Discovery failed');
    const result = response.json() as TasteDiscovery;
    assert.equal(result.source, 'qloo');
    for (const candidate of result.candidates) {
      assert.ok(candidate.entityId);
      assert.equal(candidate.kind, kind);
      assert.deepEqual(candidate.evidence.inputEntityIds, entityIds);
      assert.ok(candidate.evidence.contributingEntityIds.every((id) => entityIds.includes(id)));
      assert.ok(!('perPerson' in candidate) && !('maxPeople' in candidate));
    }
    return result;
  }
  const ids = [electronic.entityId, film.entityId];
  const cafes = await discover('place', ids);
  const music = await discover('artist', ids);
  const culture = await discover('place', ids, 'culture');
  const changed = await discover('place', [indian.entityId]);
  assert.ok(cafes.candidates.length && music.candidates.length, 'Core sample coverage was empty.');
  const beforeCache = calls;
  const cached = await discover('place', ids);
  assert.equal(calls, beforeCache, 'Repeated request bypassed the cache.');
  assert.equal(cached.fetchedAt, cafes.fetchedAt);
  assert.deepEqual(
    (await app.inject({ url: '/api/workspace', headers: { cookie } })).json(),
    workspace,
  );
  const describe = (r: TasteDiscovery) => ({
    matchedLocalities: r.matchedLocalities,
    fetchedAt: r.fetchedAt,
    candidates: r.candidates.map((c) => ({
      name: c.name,
      entityId: c.entityId,
      address: c.address,
      categories: c.categories,
      contributionCount: c.evidence.contributingEntityIds.length,
    })),
  });
  const firstIds = cafes.candidates.map((c) => c.entityId),
    changedIds = changed.candidates.map((c) => c.entityId);
  const report = {
    testedAt: new Date().toISOString(),
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workspace: 'temporary synthetic data; removed after the test',
    checks: {
      authenticatedRoutes: true,
      liveSearch: true,
      sourceEvidence: true,
      cachedRepeat: true,
      savedPlansUnchanged: true,
    },
    calls,
    timings,
    seeds: [electronic, film, indian].map((e) => ({ name: e.name, entityId: e.entityId })),
    cafes: describe(cafes),
    officeMusic: describe(music),
    culture: describe(culture),
    differentFavourites: describe(changed),
    sensitivity: {
      sameOrderedResults: JSON.stringify(firstIds) === JSON.stringify(changedIds),
      sharedInTopSix: firstIds.filter((id) => changedIds.includes(id)).length,
      interpretation:
        'Sensitivity check only; not evidence of better recommendations or group satisfaction.',
    },
  };
  const output = JSON.stringify(report, null, 2);
  assert.ok(!output.includes(key), 'Refusing to output a credential.');
  console.info(output);
} finally {
  await app.close();
  await rm(directory, { recursive: true, force: true });
}
