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
  let workspace = created.json();
  const event = workspace.events[0];
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
  async function mutate(url: string, body: Record<string, unknown>) {
    const r = await app.inject({
      method: 'POST',
      url,
      headers: { cookie },
      payload: { version: workspace.version, ...body },
    });
    assert.equal(r.statusCode, 200, r.json().error ?? 'Planning action failed');
    workspace = r.json();
  }
  // New isolated event, two synthetic people, and organizer-supplied example
  // logistics. Live taste evidence never verifies these example arrangements.
  await mutate('/api/events', {
    brief: {
      ...event.brief,
      title: 'Synthetic venue comparison',
      headcount: 2,
      includeMeal: false,
      budget: 20000,
      format: 'outing',
    },
  });
  const planningId = workspace.events[0].id;
  for (const [index, reference] of [electronic, indian].entries()) {
    await mutate(`/api/events/${planningId}`, {
      action: 'member',
      member: {
        name: `Synthetic person ${index + 1}`,
        likes: ['music', 'culture'],
        avoids: [],
        diets: [],
        stepFree: false,
        notes: '',
        favourites: '',
        tasteSeeds: [
          {
            entityId: reference.entityId,
            name: reference.name,
            kind: reference.kind,
          },
        ],
      },
    });
  }
  assert.ok(cafes.candidates.length >= 2, 'Two real venues are needed for the comparison check.');
  for (const venue of cafes.candidates.slice(0, 2)) {
    await mutate('/api/catalogue', {
      item: {
        kind: 'activity',
        name: venue.name.slice(0, 100),
        description: 'Synthetic test activity; logistics unverified.',
        format: 'outing',
        city: event.brief.city,
        tags: ['music', 'culture'],
        duration: 60,
        minPeople: 1,
        maxPeople: 10,
        perPerson: 100,
        fixedCost: 0,
        stepFree: 'unknown',
        diets: [],
        indoor: true,
        sourceUrl: venue.website,
        details: 'Synthetic example only.',
        qloo: { entityId: venue.entityId, name: venue.name },
      },
    });
  }
  await mutate(`/api/events/${planningId}`, { action: 'generate', useTaste: true });
  const comparedPlan = workspace.events[0].options.find(
    (p: { taste?: { people: { venues: unknown[] }[] } }) =>
      p.taste?.people.some((person) => person.venues.length),
  );
  assert.ok(comparedPlan, 'No linked option appeared in the generated shortlist.');
  assert.ok(
    comparedPlan.taste.people.every((p: { status: string }) => p.status === 'assessed'),
    'Live per-person assessment failed.',
  );
  assert.ok(
    comparedPlan.taste.people.some((p: { venues: { rank?: number }[] }) =>
      p.venues.some((v) => v.rank !== undefined),
    ),
    'Qloo supplied no candidate affinity evidence.',
  );
  assert.equal(
    workspace.events[0].selected,
    null,
    'Comparison must not select a plan automatically.',
  );
  const beforeComparisonCache = calls;
  await mutate(`/api/events/${planningId}`, { action: 'generate', useTaste: true });
  assert.equal(calls, beforeComparisonCache, 'Repeated comparison did not use the cache.');
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
      perPersonCandidateComparison: true,
      comparisonCache: true,
      comparisonDoesNotAutoSelect: true,
    },
    calls,
    timings,
    seeds: [electronic, film, indian].map((e) => ({ name: e.name, entityId: e.entityId })),
    comparison: {
      title: comparedPlan.title,
      people: comparedPlan.taste.people.map(
        (p: { status: string; candidateCount: number; venues: { rank?: number }[] }) => ({
          status: p.status,
          candidatesQueried: p.candidateCount,
          returnedRanks: p.venues.map((v) => v.rank ?? null),
        }),
      ),
      logistics: 'Synthetic organizer estimates, not venue facts.',
    },
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
