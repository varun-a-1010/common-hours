import { money, timeLabel, type Plan } from './model';

export interface PlanRevision {
  changes: { kind: 'activity' | 'meal'; label: string; kept: boolean }[];
  costDelta: number;
  keptChecks: number;
}

export function comparePlans(before: Plan, after: Plan, keptChecks = 0): PlanRevision {
  const changes = (['activity', 'meal'] as const).flatMap((kind) => {
    const old = before.blocks.find((b) => b.kind === kind);
    const next = after.blocks.find((b) => b.kind === kind);
    if (!old && !next) return [];
    if (!old)
      return [{ kind, kept: false, label: `Added ${next!.name} at ${timeLabel(next!.start)}.` }];
    if (!next) return [{ kind, kept: false, label: `Removed ${old.name}.` }];
    if (old.itemId !== next.itemId)
      return [
        {
          kind,
          kept: false,
          label: `${old.name} → ${next.name} at ${timeLabel(next.start)}.`,
        },
      ];
    const edits = [];
    if (old.start !== next.start) edits.push(`${timeLabel(old.start)} → ${timeLabel(next.start)}`);
    if (old.duration !== next.duration) edits.push(`${old.duration} → ${next.duration} minutes`);
    const oldCost = old.quotedCost ?? old.cost,
      nextCost = next.quotedCost ?? next.cost;
    if (oldCost !== nextCost) edits.push(`${money(oldCost)} → ${money(nextCost)}`);
    return [
      {
        kind,
        kept: edits.length === 0,
        label: edits.length
          ? `${next.name}: ${edits.join('; ')}.`
          : `Kept ${next.name}, ${timeLabel(next.start)} and ${money(nextCost)}${next.quotedCost !== undefined ? ' quoted cost' : ' estimate'}${next.locked ? ' (locked)' : ''}.`,
      },
    ];
  });
  return { changes, costDelta: after.total - before.total, keptChecks };
}
