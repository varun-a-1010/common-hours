import { describe, expect, it, vi } from 'vitest';
import { defaultBrief, newEvent } from '../server/data';
import { sampleCatalogue } from '../server/catalogue';
import { buildPlans } from '../server/planner';
import { planWithTaste } from '../server/plan-with-taste';
import type { TasteProvider } from '../server/taste';
import { createTasteProvider } from '../server/taste';
import { comparePlans } from '../shared/revision';
import type { CatalogueItem, Member } from '../shared/model';
import type { MemberTasteComparison, TasteComparison } from '../shared/taste';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const seed = uuid(10);
const people: Member[] = ['A', 'B', 'C'].map((name, i) => ({
  id: name,
  name,
  likes: ['creative'],
  avoids: [],
  diets: [],
  stepFree: false,
  notes: '',
  favourites: '',
  tasteSeeds: [{ entityId: uuid(10 + i), name: `Artist ${i}`, kind: 'artist' }],
}));
function fixtures() {
  const event = newEvent({ ...defaultBrief(), includeMeal: false, headcount: 3, budget: 50000 });
  event.members = structuredClone(people);
  const catalogue = [1, 2, 3].map((n): CatalogueItem => ({
    ...sampleCatalogue()[0],
    id: String(n),
    name: `Venue ${n}`,
    tags: ['creative'],
    perPerson: n * 100,
    fixedCost: 0,
    qloo: { entityId: uuid(n), name: `Venue ${n}` },
  }));
  return { event, catalogue };
}
function result(
  ranks: number[],
  candidateEntityIds = [uuid(1), uuid(2), uuid(3)],
): TasteComparison {
  return {
    queryId: 'test-receipt',
    fetchedAt: '2026-10-20T10:00:00Z',
    inputEntityIds: [seed],
    candidateEntityIds,
    results: ranks.flatMap((rank, i) =>
      rank ? [{ entityId: uuid(i + 1), rank, contributingEntityIds: [seed] }] : [],
    ),
  };
}
const comparison = (memberId: string, ranks: number[]): MemberTasteComparison => ({
  memberId,
  status: 'assessed',
  result: result(ranks),
});
const provider = (
  compare = vi.fn<TasteProvider['compare']>().mockResolvedValue(result([1, 2, 3])),
): TasteProvider => ({ status: 'configured', search: vi.fn(), discover: vi.fn(), compare });

describe('individual evidence inside feasible planning', () => {
  it('prefers a balanced relative rank over a majority favourite, without changing direct interest/history priority', () => {
    const { event, catalogue } = fixtures();
    const comparisons = [
      comparison('A', [1, 2, 3]),
      comparison('B', [1, 2, 3]),
      comparison('C', [3, 1, 2]),
    ];
    const baseline = buildPlans(event, catalogue, []).plans;
    expect(baseline.map((p) => p.title)).toEqual(['Venue 1', 'Venue 2', 'Venue 3']);
    const ranked = buildPlans(event, catalogue, [], false, { comparisons }).plans;
    expect(ranked[0].title).toBe('Venue 2');
    expect(ranked[0].taste?.orderChanged).toBe(true);
    expect(ranked[0].people?.[0].interests).toEqual(['creative']);
    catalogue[1].tags = ['food'];
    expect(buildPlans(event, catalogue, [], false, { comparisons }).plans[0].title).toBe('Venue 1');
  });
  it('keeps unknown and unlinked options in their baseline positions, and a failed person freezes taste ordering', () => {
    const { event, catalogue } = fixtures();
    const comparisons = people.map((p) => comparison(p.id, [3, 0, 1]));
    const partial = buildPlans(event, catalogue, [], false, { comparisons }).plans;
    expect(partial.map((p) => p.title)).toEqual(['Venue 3', 'Venue 2', 'Venue 1']);
    expect(partial[1].taste?.people[0].venues[0].rank).toBeUndefined();
    delete catalogue[1].qloo;
    expect(buildPlans(event, catalogue, [], false, { comparisons }).plans[1].title).toBe('Venue 2');
    comparisons[0] = { memberId: 'A', status: 'unavailable' };
    expect(buildPlans(event, catalogue, [], false, { comparisons }).plans[0].title).toBe('Venue 1');
  });
  it('does not penalize people without references or equate query failure with dislike', async () => {
    const { event, catalogue } = fixtures();
    event.useTaste = true;
    event.members[1].tasteSeeds = [];
    const compare = vi
      .fn<TasteProvider['compare']>()
      .mockRejectedValue(new Error('upstream error'));
    const planned = await planWithTaste(event, catalogue, [], provider(compare));
    expect(planned.plans[0].title).toBe('Venue 1');
    expect(planned.plans[0].taste?.people.map((p) => p.status)).toEqual([
      'unavailable',
      'no-favourites',
      'unavailable',
    ]);
    expect(planned.messages.join()).toContain('ordinary ranking');
  });
  it('queries only venues from complete feasible plans and deduplicates identical profiles', async () => {
    const { event, catalogue } = fixtures();
    event.useTaste = true;
    event.members[1].tasteSeeds = event.members[0].tasteSeeds;
    event.members[2].tasteSeeds = [];
    const invalid = [
      { duration: 480 },
      { maxPeople: 1 },
      { perPerson: 1000000 },
      { city: 'Elsewhere' },
      { stepFree: 'no' as const },
    ].map((edit, i) => ({
      ...catalogue[0],
      ...edit,
      id: `bad-${i}`,
      qloo: { entityId: uuid(50 + i), name: 'Bad venue' },
    }));
    event.members[0].stepFree = true;
    const compare = vi.fn<TasteProvider['compare']>().mockResolvedValue(result([3, 2, 1]));
    const planned = await planWithTaste(event, [...catalogue, ...invalid], [], provider(compare));
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][0]).toEqual({
      entityIds: [seed],
      candidateEntityIds: [uuid(1), uuid(2), uuid(3)],
      city: event.brief.city,
    });
    expect(planned.plans[0].title).toBe('Venue 3');
    expect(planned.plans.every((p) => p.total <= event.brief.budget)).toBe(true);
    event.brief.budget = 100;
    expect((await planWithTaste(event, catalogue, [], provider(compare))).plans).toEqual([]);
    expect(compare).toHaveBeenCalledTimes(1);
  });
  it('preserves locked meal time, identity and quote; records only actual differences', async () => {
    const { event, catalogue } = fixtures();
    event.brief.includeMeal = true;
    catalogue.push({
      ...catalogue[0],
      kind: 'meal',
      duration: 30,
      id: 'meal',
      name: 'Lunch',
      qloo: { entityId: uuid(9), name: 'Lunch' },
    });
    event.selected = buildPlans(event, catalogue, []).plans[0];
    const meal = event.selected.blocks[1];
    meal.locked = true;
    meal.quotedCost = 1234;
    event.excludedItemIds = ['1'];
    event.useTaste = true;
    const compare = vi
      .fn<TasteProvider['compare']>()
      .mockResolvedValue(result([0, 2, 1], [uuid(2), uuid(3)]));
    const planned = await planWithTaste(event, catalogue, [], provider(compare));
    expect(compare.mock.calls[0][0].candidateEntityIds).toEqual([uuid(2), uuid(3)]);
    expect(planned.plans[0].blocks[1]).toMatchObject(meal);
    const revision = comparePlans(event.selected, planned.plans[0], 3);
    expect(revision.changes.map((c) => c.kept)).toEqual([false, true]);
    expect(revision.keptChecks).toBe(3);
    expect(revision.changes[1].label).toContain('quoted cost');
  });
  it('bounds requests without silently dropping profiles or venues', async () => {
    const { event, catalogue } = fixtures();
    event.useTaste = true;
    const compare = vi.fn<TasteProvider['compare']>();
    const many = Array.from({ length: 21 }, (_, i) => ({
      ...catalogue[0],
      id: `entry-${i}`,
      qloo: { entityId: uuid(100 + i), name: 'Venue' },
    }));
    const planned = await planWithTaste(event, many, [], provider(compare));
    expect(planned.messages.join()).toContain('20 feasible linked venues');
    expect(compare).not.toHaveBeenCalled();
    event.members = Array.from({ length: 13 }, (_, i) => ({
      ...people[0],
      id: `${i}`,
      tasteSeeds: [{ entityId: uuid(50 + i), name: 'Artist', kind: 'artist' as const }],
    }));
    event.brief.headcount = 13;
    expect(
      (await planWithTaste(event, catalogue, [], provider(compare))).messages.join(),
    ).toContain('12 distinct taste profiles');
    expect(compare).not.toHaveBeenCalled();
  });
});

describe('Qloo candidate comparison contract', () => {
  it('limits the result set, keeps tied/zero ranks honest, scopes contributions, and never exposes raw affinity', async () => {
    const raw = (id: string, affinity?: number) => ({
      entity_id: id,
      name: 'Venue',
      subtype: 'urn:entity:place',
      query: {
        affinity,
        explainability: {
          'signal.interests.entities': [{ entity_id: seed }, { entity_id: uuid(99) }],
        },
      },
    });
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: {
            entities: [
              raw(uuid(1), 0),
              raw(uuid(2), 0),
              raw(uuid(3)),
              raw(uuid(99), 1),
              raw(uuid(1), 1),
            ],
          },
        }),
      ),
    );
    const taste = createTasteProvider({ apiKey: 'test-only', fetch: request });
    const compared = await taste.compare({
      entityIds: [seed],
      candidateEntityIds: [uuid(1), uuid(2), uuid(3)],
      city: 'Bengaluru',
    });
    const url = new URL(String(request.mock.calls[0][0]));
    expect(url.searchParams.get('filter.results.entities')).toBe(
      [uuid(1), uuid(2), uuid(3)].join(','),
    );
    expect(url.searchParams.get('filter.location.radius')).toBe('0');
    expect(compared.results).toEqual(
      [1, 2].map((i) => ({ entityId: uuid(i), rank: 1, contributingEntityIds: [seed] })),
    );
    expect(JSON.stringify(compared)).not.toContain('affinity');
  });
});
