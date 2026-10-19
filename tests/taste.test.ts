import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTasteProvider, QLOO_ORIGIN } from '../server/taste';
import { buildApp } from '../server/app';
import { FileStore } from '../server/store';

const seed = '012EF80C-B187-4ECB-9C3D-9CA5228B503C';
const other = '9B33A620-68CA-49B3-BFCF-F09CCF8AD595';
const place = 'AC2C055D-1C0A-43D2-8002-DD0A4CEA2A7F';
const key = 'unit-test-credential';
const rawPlace = {
  entity_id: place,
  name: 'Example cafe',
  subtype: 'urn:entity:place',
  properties: { address: 'Test address', website: 'javascript:alert(1)', price_level: 2 },
  tags: [{ type: 'urn:tag:category:place', name: 'Cafe' }],
  query: {
    affinity: 0.9,
    explainability: {
      'signal.interests.entities': [
        { entity_id: seed, score: 0.8 },
        { entity_id: other, score: 0.2 },
      ],
    },
  },
};
const discovery = {
  success: true,
  results: { entities: [rawPlace] },
  query: { localities: { filter: [{ name: 'Bengaluru' }] } },
};
const mockFetch = () => vi.fn<typeof fetch>();

describe('Qloo adapter', () => {
  it('keeps credentials in the fixed-origin header and requires explicit entity selection', async () => {
    const request = mockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { entity_id: seed, name: 'Daft Punk', types: ['urn:entity:artist'], properties: {} },
            { entity_id: other, name: 'Wrong domain', types: ['urn:entity:movie'] },
            { entity_id: 'not-an-entity-id', name: 'Malformed', types: ['urn:entity:artist'] },
          ],
        }),
      ),
    );
    const provider = createTasteProvider({ apiKey: key, fetch: request });
    expect(provider.status).toBe('configured');
    const found = await provider.search('Daft Punk', 'artist');
    expect(found.map((e) => e.name)).toEqual(['Daft Punk']);
    const [url, options] = request.mock.calls[0];
    expect(new URL(String(url)).origin).toBe(QLOO_ORIGIN);
    expect(String(url)).not.toContain(key);
    expect(options?.headers).toEqual({ 'X-Api-Key': key, Accept: 'application/json' });
    expect(options?.redirect).toBe('error');
    expect(JSON.stringify(found)).not.toContain(key);
  });
  it('keeps geography strict, filters categories, scopes attribution and never supplies logistics', async () => {
    const request = mockFetch().mockImplementation(
      async () => new Response(JSON.stringify(discovery)),
    );
    let now = 1000;
    const provider = createTasteProvider({ apiKey: key, fetch: request, now: () => now });
    const input = {
      kind: 'place' as const,
      entityIds: [seed, seed],
      city: 'Bengaluru',
      focus: 'cafes' as const,
    };
    const first = await provider.discover(input);
    const url = new URL(String(request.mock.calls[0][0]));
    expect(url.searchParams.get('signal.interests.entities')).toBe(seed);
    expect(url.searchParams.get('filter.location.radius')).toBe('0');
    expect(url.searchParams.get('filter.location.query')).toBe('Bengaluru');
    expect(url.searchParams.get('filter.tags')).toContain('coffee_shop');
    expect(url.searchParams.get('operator.filter.tags')).toBe('union');
    const candidate = first.candidates[0];
    expect(candidate.website).toBe('');
    expect(candidate.evidence.contributingEntityIds).toEqual([seed]);
    expect(candidate.evidence.inputEntityIds).toEqual([seed]);
    expect(candidate).not.toHaveProperty('perPerson');
    expect(candidate).not.toHaveProperty('maxPeople');
    expect(candidate).not.toHaveProperty('affinity');
    expect(first.matchedLocalities).toEqual(['Bengaluru']);
    const again = await provider.discover(input);
    expect(request).toHaveBeenCalledTimes(1);
    expect(again.fetchedAt).toBe(first.fetchedAt);
    expect(again.queryId).not.toBe(first.queryId);
    await provider.discover({ ...input, entityIds: [other] });
    expect(request).toHaveBeenCalledTimes(2);
    now += 600_001;
    await provider.discover(input);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('handles missing attribution and an empty result without inventing suggestions', async () => {
    const request = mockFetch()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, results: { entities: [{ ...rawPlace, query: {} }] } }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, results: { entities: [] } })),
      );
    const provider = createTasteProvider({ apiKey: key, fetch: request });
    const result = await provider.discover({ kind: 'place', entityIds: [seed], city: 'Bengaluru' });
    expect(result.candidates[0].evidence.contributingEntityIds).toEqual([]);
    expect(result.candidates[0].evidence.explanation).toContain('not provided');
    expect((await provider.discover({ kind: 'artist', entityIds: [seed] })).candidates).toEqual([]);
  });
  it.each([400, 401, 403, 429, 500])(
    'reports HTTP %i safely without retries or leaked provider bodies',
    async (status) => {
      const request = mockFetch().mockResolvedValue(
        new Response(`Do not disclose ${key}`, { status }),
      );
      const provider = createTasteProvider({ apiKey: key, fetch: request });
      const error = await provider.search('Daft Punk', 'artist').catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(key);
      expect(String(error)).not.toContain('Do not disclose');
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('treats documented search 404 as empty and malformed data as an error', async () => {
    const request = mockFetch()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('not json'))
      .mockRejectedValueOnce(new Error(`timeout with ${key}`));
    const provider = createTasteProvider({ apiKey: key, fetch: request });
    expect(await provider.search('Unknown', 'movie')).toEqual([]);
    await expect(provider.search('Malformed', 'movie')).rejects.toThrow('invalid');
    await expect(provider.search('Slow', 'movie')).rejects.not.toThrow(key);
  });
  it('does not make calls without a key or with missing discovery inputs', async () => {
    const request = mockFetch();
    const offline = createTasteProvider({ fetch: request });
    expect(offline.status).toBe('not-connected');
    await expect(offline.search('Daft Punk', 'artist')).rejects.toThrow('not connected');
    const provider = createTasteProvider({ apiKey: key, fetch: request });
    await expect(provider.discover({ kind: 'place', entityIds: [seed] })).rejects.toThrow(
      'event city',
    );
    await expect(provider.discover({ kind: 'artist', entityIds: [] })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
describe('cultural discovery access and planner boundary', () => {
  it('requires the organizer, validates inputs, limits outbound fields and leaves saved plans alone', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'common-hours-taste-'));
    const request = mockFetch().mockImplementation(
      async () => new Response(JSON.stringify(discovery)),
    );
    const app = await buildApp(new FileStore(directory), {
      taste: createTasteProvider({ apiKey: key, fetch: request }),
    });
    cleanup.push(async () => {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      payload: { name: 'Test team', demo: true },
    });
    const workspace = created.json(),
      event = workspace.events[0];
    const cookie = created.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const url = `/api/events/${event.id}/taste`;
    const payload = {
      version: workspace.version,
      kind: 'place',
      entityIds: [seed],
      focus: 'cafes',
    };
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/taste/search',
          payload: { query: 'Daft Punk', kind: 'artist' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload,
          headers: { cookie, origin: 'https://elsewhere.example' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: { ...payload, version: workspace.version + 1 },
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: { ...payload, entityIds: [] },
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(400);
    const otherWorkspace = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      payload: { name: 'Another team' },
    });
    const otherCookie = otherWorkspace.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    expect(
      (await app.inject({ method: 'POST', url, payload, headers: { cookie: otherCookie } }))
        .statusCode,
    ).toBe(404);
    expect(request).not.toHaveBeenCalled();
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { ...payload, members: event.members, city: 'London' },
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const upstream = new URL(String(request.mock.calls[0][0]));
    expect(upstream.searchParams.get('filter.location.query')).toBe(event.brief.city);
    expect(String(upstream)).not.toContain('London');
    for (const member of event.members) expect(String(upstream)).not.toContain(member.name);
    const after = (await app.inject({ url: '/api/workspace', headers: { cookie } })).json();
    expect(after).toEqual(workspace);
    const publicResult = await app.inject({
      url: `/api/share/${workspace.id}/${event.id}/${event.shareToken}`,
    });
    expect(publicResult.body).not.toContain(place);
    expect(publicResult.body).not.toContain(seed);
    expect(response.body).not.toContain(key);
  });
});
