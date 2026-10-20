import type { CatalogueItem, EventRecord } from '../shared/model';
import type { MemberTasteComparison } from '../shared/taste';
import { buildPlans } from './planner';
import type { TasteProvider } from './taste';

export async function planWithTaste(
  event: EventRecord,
  catalogue: CatalogueItem[],
  history: EventRecord[],
  taste: TasteProvider,
) {
  const preserve = !!event.selected;
  if (!event.useTaste) return buildPlans(event, catalogue, history, preserve);
  // Only venues present in a complete feasible plan reach the provider.
  const feasible = buildPlans(event, catalogue, history, preserve, { all: true });
  if (!feasible.plans.length) return feasible;
  const itemIds = new Set(
    feasible.plans.flatMap((p) => p.blocks.filter((b) => !b.locked).map((b) => b.itemId)),
  );
  const candidateEntityIds = [
    ...new Set(
      catalogue
        .filter((c) => itemIds.has(c.id) && c.qloo)
        .map((c) => c.qloo!.entityId.toUpperCase()),
    ),
  ].sort();
  const profiles = new Map<string, string[]>();
  for (const member of event.members) {
    const ids = [...new Set((member.tasteSeeds ?? []).map((s) => s.entityId.toUpperCase()))].sort();
    if (!ids.length) continue;
    const key = ids.join(',');
    profiles.set(key, [...(profiles.get(key) ?? []), member.id]);
  }
  const comparisons: MemberTasteComparison[] = [];
  const messages: string[] = [];
  if (!profiles.size)
    messages.push(
      'Save confirmed favourites for individual people in Cultural discovery to compare venues.',
    );
  else if (!candidateEntityIds.length)
    messages.push(
      'No unlocked Qloo-linked venue fits a complete plan. Review a place in Cultural discovery and add its practical details to the library.',
    );
  else if (profiles.size > 12 || candidateEntityIds.length > 20)
    messages.push(
      'This comparison supports up to 12 distinct taste profiles and 20 feasible linked venues. Ordinary planning is still available; nobody was silently left out.',
    );
  else if (taste.status !== 'configured')
    messages.push('Qloo is not connected. Options use stated preferences and history.');
  else {
    const entries = [...profiles];
    // At most three concurrent calls, twelve total; identical profiles share a query.
    for (let start = 0; start < entries.length; start += 3) {
      const batch = await Promise.all(
        entries.slice(start, start + 3).map(async ([ids, memberIds]) => {
          try {
            const result = await taste.compare({
              entityIds: ids.split(','),
              candidateEntityIds,
              city: event.brief.city,
            });
            return memberIds.map((memberId) => ({ memberId, status: 'assessed' as const, result }));
          } catch {
            return memberIds.map((memberId) => ({ memberId, status: 'unavailable' as const }));
          }
        }),
      );
      comparisons.push(...batch.flat());
    }
    if (comparisons.some((c) => c.status === 'unavailable'))
      messages.push(
        'Qloo could not assess every saved profile. The ordinary ranking was kept; missing evidence is shown as unknown.',
      );
    else
      messages.push(
        'Qloo compared feasible linked venues for each saved profile. It can break ties in stated-interest and history scores; missing results and unlinked plans keep their ordinary positions.',
      );
  }
  const result = buildPlans(event, catalogue, history, preserve, { comparisons });
  return { ...result, messages: [...messages, ...result.messages] };
}
