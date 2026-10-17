import { createHash, randomUUID } from 'node:crypto';
import { minutes, money, type Brief, type CatalogueItem, type Check, type EventRecord, type Member, type Plan, type PlanBlock } from '../shared/model';

export function briefFingerprint(brief: Brief, members: Member[]) {
  return createHash('sha256').update(JSON.stringify({ brief, members: members.map(({ secretHash: _, claimToken: __, ...m }) => m) })).digest('hex');
}
export function recost(plan: Plan): Plan {
  const subtotal = plan.blocks.reduce((sum, b) => sum + (b.quotedCost ?? b.cost), 0);
  const reserve = Math.ceil(subtotal * 0.1);
  return { ...plan, subtotal, reserve, total: subtotal + reserve };
}
function itemIssues(item: CatalogueItem, brief: Brief, members: Member[]): string[] {
  const issues: string[] = [];
  if (item.city.trim().toLowerCase() !== brief.city.trim().toLowerCase() && item.format !== 'office') issues.push('city');
  if (brief.format !== 'either' && item.format !== 'either' && item.format !== brief.format) issues.push('format');
  if (brief.headcount < item.minPeople || brief.headcount > item.maxPeople) issues.push('group size');
  if (members.some(m => m.avoids.some(t => item.tags.includes(t)))) issues.push('activities to avoid');
  if (members.some(m => m.stepFree) && item.stepFree === 'no') issues.push('step-free access');
  if (item.kind === 'meal' && members.some(m => m.diets.some(d => !item.diets.includes(d)))) issues.push('dietary requirements');
  return issues;
}
function compatible(a: CatalogueItem, b?: CatalogueItem) {
  return !b || a.format === 'either' || b.format === 'either' || a.format === b.format;
}

export function buildPlans(event: EventRecord, catalogue: CatalogueItem[], history: EventRecord[], preserveLocks = false): { plans: Plan[]; messages: string[] } {
  const { brief, members } = event;
  if (members.length > brief.headcount) return { plans: [], messages: ['Increase the headcount to include everyone who has responded.'] };
  const pool = catalogue.filter(i => !event.excludedItemIds.includes(i.id) && itemIssues(i, brief, members).length === 0);
  const locked = preserveLocks ? event.selected?.blocks.filter(b => b.locked) ?? [] : [];
  if (locked.some(b => !pool.some(i => i.id === b.itemId))) return { plans: [], messages: ['A locked arrangement conflicts with the new requirements or is unavailable. Unlock it to explore alternatives.'] };
  if (!brief.includeMeal && locked.some(b => b.kind === 'meal')) return { plans: [], messages: ['Lunch is locked. Unlock it before removing the meal.'] };
  const activities = pool.filter(i => i.kind === 'activity' && !locked.some(b => b.kind === 'activity' && b.itemId !== i.id));
  const meals = brief.includeMeal ? pool.filter(i => i.kind === 'meal' && !locked.some(b => b.kind === 'meal' && b.itemId !== i.id)) : [undefined];
  const recent = history.filter(e => e.id !== event.id && e.status === 'completed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 3);
  const plans: Plan[] = [];
  for (const a of activities) for (const m of meals) {
    if (!compatible(a, m)) continue;
    const used = m ? [a, m] : [a];
    const travel = a.format === 'office' ? 0 : brief.travelMinutes;
    const aLock = locked.find(b => b.kind === 'activity');
    const mLock = locked.find(b => b.kind === 'meal');
    const aStart = aLock?.start ?? minutes(brief.startTime) + 10;
    const mStart = mLock?.start ?? aStart + a.duration + travel;
    if (aStart < minutes(brief.startTime) + 10 || m && mStart < aStart + a.duration + travel) continue;
    const end = m ? mStart + m.duration : aStart + a.duration;
    if (end + 10 > minutes(brief.endTime)) continue;
    const blocks: PlanBlock[] = used.map(i => {
      const old = locked.find(b => b.itemId === i.id);
      return { id: old?.id ?? randomUUID(), kind: i.kind, itemId: i.id, name: i.name, description: i.description,
        start: i.kind === 'meal' ? mStart : aStart, duration: i.duration, cost: i.perPerson * brief.headcount + i.fixedCost,
        quotedCost: old?.quotedCost, locked: !!old, source: i.source };
    });
    const known = members.filter(p => p.likes.length > 0);
    const matches = known.map(p => a.tags.filter(t => p.likes.includes(t)).length);
    const matchedPeople = matches.filter(n => n > 0).length;
    const repeated = recent.some(e => e.selected?.blocks.some(b => b.itemId === a.id));
    const poorFeedback = recent.some(e => e.selected?.blocks.some(b => b.itemId === a.id) && e.feedback.length && e.feedback.filter(f => !f.repeat).length > e.feedback.length / 2);
    const reasons = [known.length ? `${matchedPeople} of ${known.length} people with stated interests have an activity match.` : 'No activity preferences yet; compare these as starting options.'];
    if (known.length && matchedPeople === known.length) reasons.push('Everyone with stated interests has something represented.');
    reasons.push(repeated ? 'This activity appeared in a recent event.' : 'A different activity from the last three recorded events.');
    if (poorFeedback) reasons.push('Recent feedback favored trying something different next time.');
    const cautions = ['Confirm availability and final group pricing before booking.'];
    if (used.some(i => i.source === 'sample')) cautions.push('Sample activities and estimated prices; a provider has not been selected.');
    if (members.some(p => p.stepFree) && used.some(i => i.stepFree === 'unknown')) cautions.push('Step-free access needs confirmation.');
    if (members.some(p => p.diets.length) && m) cautions.push('Confirm dietary requirements directly with the food provider.');
    if (members.some(p => p.notes.trim())) cautions.push('Review the private requirements supplied by participants.');
    if (members.length < brief.headcount) cautions.push(`${brief.headcount - members.length} people have not shared their preferences yet.`);
    if (!a.indoor) cautions.push('Outdoor activity: keep a weather alternative in mind.');
    const plan = recost({ id: randomUUID(), title: a.name, blocks, subtotal: 0, reserve: 0, total: 0,
      score: matchedPeople * 12 + matches.reduce((s, n) => s + Math.min(n, 2), 0) * 2 - (repeated ? 12 : 0) - (poorFeedback ? 20 : 0),
      reasons, cautions, matchedPeople, knownPeople: known.length, fingerprint: briefFingerprint(brief, members) });
    if (plan.total <= brief.budget) plans.push(plan);
  }
  plans.sort((a, b) => b.score - a.score || a.total - b.total || a.title.localeCompare(b.title));
  const chosen: Plan[] = [];
  for (const p of plans) {
    const key = locked.some(b => b.kind === 'activity') ? p.blocks.map(b => b.itemId).join(',') : p.blocks[0].itemId;
    if (chosen.some(c => (locked.some(b => b.kind === 'activity') ? c.blocks.map(b => b.itemId).join(',') : c.blocks[0].itemId) === key)) continue;
    chosen.push(p); if (chosen.length === 3) break;
  }
  const messages = chosen.length ? [] : [
    `No complete plan fits the current ${money(brief.budget)} budget, time window and requirements.`,
    !activities.length ? 'Add an activity in this city/format that covers the group and avoids exclusions.' : 'Try a longer time window, a higher budget, or a lower-cost activity.',
    ...(brief.includeMeal && !meals.length ? ['Add a meal option that supports the group’s dietary requirements.'] : []),
    ...(locked.length ? ['Locked arrangements were preserved. Unlock one if you want a wider search.'] : []),
  ];
  return { plans: chosen, messages };
}

export function makeChecks(event: EventRecord, plan: Plan, old: Check[] = []): Check[] {
  const rows: Check[] = [];
  const add = (itemId: string, key: string, label: string) => {
    const id = `${itemId}:${key}`;
    rows.push(old.find(c => c.id === id) ?? { id, itemId, label, done: false, note: '', assignee: '' });
  };
  for (const block of plan.blocks) {
    add(block.itemId, 'booking', `Confirm provider, date and time for ${block.name.toLowerCase()}`);
    add(block.itemId, 'price', `Confirm the final group price for ${block.name.toLowerCase()}`);
    add(block.itemId, 'capacity', `Confirm space for ${event.brief.headcount} people`);
    if (event.members.some(m => m.stepFree)) add(block.itemId, 'access', 'Confirm step-free access');
    if (block.kind === 'meal' && event.members.some(m => m.diets.length || m.notes)) add(block.itemId, 'food', 'Confirm dietary needs and any food-related notes');
  }
  if (event.members.some(m => m.notes)) add('event', 'notes', 'Review and accommodate the private participant notes');
  return rows;
}

export function planProblems(event: EventRecord): string[] {
  if (!event.selected) return ['Choose a plan first.'];
  const p = event.selected;
  const result: string[] = [];
  if (p.fingerprint !== briefFingerprint(event.brief, event.members)) result.push('The brief or preferences changed. Refresh the plan before confirming it.');
  if (p.blocks.some(b => event.excludedItemIds.includes(b.itemId))) result.push('An arrangement is unavailable. Choose a replacement plan.');
  if (p.total > event.brief.budget) result.push('The plan exceeds the budget, including its 10% reserve.');
  if (event.members.length < event.brief.headcount) result.push('Collect or enter preferences for everyone before marking the event ready.');
  if (event.checks.some(c => !c.done)) result.push('Resolve the outstanding logistics checks.');
  return result;
}
