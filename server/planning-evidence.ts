import type { CatalogueItem, Member, Plan } from '../shared/model';
import type { MemberTasteComparison } from '../shared/taste';

/** Reorder only comparable plans within their existing baseline positions.
 * Missing evidence is unknown, never a zero score. Stated interests and history
 * retain priority. Unlinked or locked arrangements are held equal in each group.
 */
export function rankWithTaste(
  plans: Plan[],
  members: Member[],
  catalogue: CatalogueItem[],
  comparisons: MemberTasteComparison[],
) {
  const byItem = new Map(catalogue.map((item) => [item.id, item]));
  const profiles = members.filter((m) => m.tasteSeeds?.length);
  const groups = new Map<string, { index: number; plan: Plan; worst: number; mean: number }[]>();
  const completeQueries =
    profiles.length > 0 &&
    profiles.every((m) => comparisons.find((c) => c.memberId === m.id)?.status === 'assessed');
  plans.forEach((plan, index) => {
    const linked = plan.blocks.filter((b) => !b.locked && byItem.get(b.itemId)?.qloo);
    plan.taste = {
      orderChanged: false,
      people: members.map((member) => {
        const comparison = comparisons.find((c) => c.memberId === member.id);
        const seeds = member.tasteSeeds ?? [];
        return {
          memberId: member.id,
          seeds,
          status: seeds.length ? (comparison?.status ?? 'unavailable') : 'no-favourites',
          queryId: comparison?.result?.queryId,
          fetchedAt: comparison?.result?.fetchedAt,
          candidateCount: comparison?.result?.candidateEntityIds.length,
          venues: linked.map((block) => {
            const result = comparison?.result?.results.find(
              (r) => r.entityId === byItem.get(block.itemId)!.qloo!.entityId.toUpperCase(),
            );
            return {
              itemId: block.itemId,
              rank: result?.rank,
              contributingNames: seeds
                .filter((s) => result?.contributingEntityIds.includes(s.entityId.toUpperCase()))
                .map((s) => s.name),
            };
          }),
        };
      }),
    };
    if (!completeQueries || !linked.length) return;
    const people = plan.taste.people.filter((p) => p.seeds.length);
    if (people.some((p) => p.venues.some((v) => v.rank === undefined))) return;
    // Equal weight per person, irrespective of how many favourites they supplied.
    const worstPerPerson = people.map((p) => Math.max(...p.venues.map((v) => v.rank!)));
    const key = `${plan.score}|${plan.blocks
      .map((b) => `${b.kind}:${!b.locked && byItem.get(b.itemId)?.qloo ? 'qloo' : b.itemId}`)
      .join('|')}`;
    const group = groups.get(key) ?? [];
    group.push({
      index,
      plan,
      worst: Math.max(...worstPerPerson),
      mean: worstPerPerson.reduce((a, b) => a + b, 0) / worstPerPerson.length,
    });
    groups.set(key, group);
  });
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => a.worst - b.worst || a.mean - b.mean || a.index - b.index,
    );
    group.forEach((slot, i) => {
      const entry = sorted[i];
      entry.plan.taste!.orderChanged = entry.index !== slot.index;
      plans[slot.index] = entry.plan;
    });
  }
}
