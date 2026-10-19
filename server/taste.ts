import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PlaceFocus, TasteDiscovery, TasteEntity, TasteKind } from '../shared/taste';

export const QLOO_ORIGIN = 'https://hackathon.api.qloo.com';
export class TasteError extends Error {
  constructor(
    message: string,
    public statusCode = 502,
  ) {
    super(message);
  }
}
export interface TasteProvider {
  status: 'not-connected' | 'configured';
  search(query: string, kind: TasteKind): Promise<TasteEntity[]>;
  discover(input: {
    kind: TasteKind;
    entityIds: string[];
    city?: string;
    focus?: PlaceFocus;
  }): Promise<TasteDiscovery>;
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const string = (value: unknown, limit = 500): string =>
  typeof value === 'string' ? value.slice(0, limit) : '';
const uuid = z.string().uuid();
const safeWebsite = (value: unknown) => {
  try {
    const url = new URL(string(value, 2000));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
};
function entity(value: unknown, kind: TasteKind): TasteEntity | null {
  const raw = record(value),
    properties = record(raw.properties);
  const types = [...array(raw.types), raw.subtype];
  if (
    !uuid.safeParse(raw.entity_id).success ||
    !string(raw.name) ||
    !types.includes(`urn:entity:${kind}`)
  )
    return null;
  return {
    entityId: string(raw.entity_id),
    name: string(raw.name, 200),
    kind,
    description: string(properties.short_description ?? properties.description),
    releaseYear: typeof properties.release_year === 'number' ? properties.release_year : undefined,
    address: string(properties.address),
    website: safeWebsite(properties.website),
    categories: array(raw.tags)
      .map(record)
      .filter((t) => t.type === 'urn:tag:category:place')
      .map((t) => string(t.name, 100))
      .filter(Boolean)
      .slice(0, 6),
  };
}
// Category IDs observed in real Bengaluru results on 2026-10-20. Categories
// never establish dietary, access, availability or booking suitability.
const placeTags: Record<Exclude<PlaceFocus, 'all'>, string[]> = {
  cafes: ['urn:tag:category:place:cafe', 'urn:tag:category:place:coffee_shop'],
  culture: [
    'urn:tag:category:place:performing_arts_theater',
    'urn:tag:category:place:auditorium',
    'urn:tag:category:place:concert_hall',
    'urn:tag:category:place:movie_theater',
  ],
};
export function createTasteProvider(
  options: {
    apiKey?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    now?: () => number;
  } = {},
): TasteProvider {
  const apiKey = options.apiKey?.trim(),
    request = options.fetch ?? fetch,
    now = options.now ?? Date.now;
  // Credential-scoped, bounded, process-local cache; never stores request headers.
  const cache = new Map<
    string,
    { expires: number; data: Record<string, unknown>; fetchedAt: string }
  >();
  async function get(
    path: string,
    params: Record<string, string>,
  ): Promise<{ data: Record<string, unknown>; fetchedAt: string }> {
    if (!apiKey) throw new TasteError('Cultural discovery is not connected yet.', 503);
    const url = new URL(path, QLOO_ORIGIN);
    url.search = new URLSearchParams(params).toString();
    const cached = cache.get(url.href);
    if (cached && cached.expires > now()) return cached;
    try {
      const response = await request(url, {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
      });
      if (response.status === 401 || response.status === 403)
        throw new TasteError(
          'Qloo rejected the server credential. Check its access and expiry.',
          503,
        );
      if (response.status === 429)
        throw new TasteError('Qloo has reached a rate or usage limit. Try again later.', 503);
      if (response.status === 400)
        throw new TasteError(
          'Qloo could not resolve this city or combination of favourites. Try a more specific city or different favourites.',
          422,
        );
      if (response.status === 404 && path === '/search')
        return { data: { results: [] }, fetchedAt: new Date(now()).toISOString() };
      if (!response.ok)
        throw new TasteError('Qloo is unavailable. Your saved event plans are unchanged.');
      const text = await response.text();
      if (text.length > 2_000_000)
        throw new TasteError('Qloo returned a response that was too large.');
      const data = record(JSON.parse(text));
      if (data.success === false || !('results' in data))
        throw new TasteError('Qloo did not return usable results for this request.');
      const value = { data, fetchedAt: new Date(now()).toISOString(), expires: now() + 600_000 };
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(url.href, value);
      return value;
    } catch (error) {
      if (error instanceof TasteError) throw error;
      // Never propagate fetch errors, raw response bodies, URLs or headers.
      throw new TasteError(
        'Qloo could not be reached or its response was invalid. Please try again.',
      );
    }
  }
  return {
    status: apiKey ? 'configured' : 'not-connected',
    async search(query, kind) {
      const { data } = await get('/search', {
        query: query.trim(),
        types: `urn:entity:${kind}`,
        take: '5',
      });
      if (!Array.isArray(data.results))
        throw new TasteError('Qloo returned an unexpected search response.');
      return data.results
        .map((raw) => entity(raw, kind))
        .filter((e): e is TasteEntity => e !== null);
    },
    async discover(input) {
      const ids = [...new Set(z.array(uuid).min(1).max(8).parse(input.entityIds))];
      const params: Record<string, string> = {
        'filter.type': `urn:entity:${input.kind}`,
        'signal.interests.entities': ids.join(','),
        'filter.exclude.entities': ids.join(','),
        'feature.explainability': 'true',
        take: '6',
      };
      if (input.kind === 'place') {
        if (!input.city?.trim())
          throw new TasteError('Add the event city before discovering places.', 422);
        params['filter.location.query'] = input.city.trim();
        params['filter.location.radius'] = '0';
        if (input.focus && input.focus !== 'all') {
          params['filter.tags'] = placeTags[input.focus].join(',');
          params['operator.filter.tags'] = 'union';
        }
      }
      const { data, fetchedAt } = await get('/v2/insights', params);
      const rows = record(data.results).entities;
      if (!Array.isArray(rows))
        throw new TasteError('Qloo returned an unexpected discovery response.');
      const queryId = randomUUID(),
        seen = new Set<string>();
      const candidates = rows.flatMap((raw) => {
        const resolved = entity(raw, input.kind);
        if (!resolved || ids.includes(resolved.entityId) || seen.has(resolved.entityId)) return [];
        seen.add(resolved.entityId);
        const explainability = record(record(record(raw).query).explainability);
        const contributing = array(explainability['signal.interests.entities'])
          .map(record)
          .map((r) => string(r.entity_id))
          .filter((id) => ids.includes(id));
        return [
          {
            ...resolved,
            evidence: {
              source: 'qloo' as const,
              queryId,
              fetchedAt,
              inputEntityIds: ids,
              contributingEntityIds: [...new Set(contributing)],
              explanation: contributing.length
                ? 'Qloo reports that the listed favourites contributed to this recommendation.'
                : 'Returned by Qloo for the selected favourites; individual contributions were not provided.',
            },
          },
        ];
      });
      const matchedLocalities = array(record(record(data.query).localities).filter)
        .map(record)
        .map((r) => string(r.disambiguation ?? r.name))
        .filter(Boolean);
      return {
        source: 'qloo',
        kind: input.kind,
        ...(input.kind === 'place' ? { city: input.city } : {}),
        matchedLocalities,
        candidates,
        fetchedAt,
        queryId,
        cautions: [
          'These are cultural suggestions, not a measure of group agreement or a guarantee anyone will enjoy them.',
          input.kind === 'place'
            ? 'Check current opening, group capacity, prices, dietary needs, accessibility and availability with the venue.'
            : 'Check suitability and any playback or screening permissions before using this at a workplace event.',
          'Suggestions do not automatically change your activity library, budget, logistics checks or event plan.',
        ],
      };
    },
  };
}
export const tasteProvider = createTasteProvider();
