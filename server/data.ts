import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Brief, EventRecord, OwnerWorkspace, PublicEvent, Workspace } from '../shared/model';
import { sampleCatalogue } from './catalogue';
import { briefFingerprint, buildPlans, makeChecks } from './planner';

export const token = () => randomBytes(24).toString('base64url');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function same(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function newEvent(brief: Brief): EventRecord {
  return {
    id: randomUUID(),
    brief,
    status: 'draft',
    members: [],
    options: [],
    selected: null,
    checks: [],
    feedback: [],
    actualSpend: null,
    reflection: '',
    excludedItemIds: [],
    inviteToken: token(),
    shareToken: token(),
    createdAt: new Date().toISOString(),
    completedAt: null,
    messages: [],
  };
}
export function defaultBrief(): Brief {
  const day = new Date();
  day.setDate(day.getDate() + 7);
  return {
    title: 'An afternoon together',
    goal: 'A change of scene and time to catch up.',
    date: day.toISOString().slice(0, 10),
    startTime: '14:00',
    endTime: '18:00',
    city: 'Bengaluru',
    location: 'Our office',
    headcount: 8,
    budget: 14000,
    format: 'outing',
    includeMeal: true,
    travelMinutes: 20,
  };
}
export function newWorkspace(name: string, demo: boolean) {
  const secret = token();
  const workspace: Workspace = {
    id: randomUUID(),
    name,
    ownerHash: hash(secret),
    version: 0,
    demo,
    catalogue: sampleCatalogue(),
    events: [],
    createdAt: new Date().toISOString(),
  };
  if (demo) {
    const event = newEvent({ ...defaultBrief(), title: 'A little out of office', headcount: 6 });
    event.members = [
      {
        id: randomUUID(),
        name: 'Maya',
        likes: ['creative', 'culture'],
        avoids: ['movement'],
        diets: ['vegetarian'],
        stepFree: false,
        notes: '',
        favourites: 'Studio Ghibli films, ceramics',
      },
      {
        id: randomUUID(),
        name: 'Arjun',
        likes: ['games', 'conversation'],
        avoids: [],
        diets: [],
        stepFree: false,
        notes: '',
        favourites: '',
      },
      {
        id: randomUUID(),
        name: 'Leah',
        likes: ['creative', 'food'],
        avoids: [],
        diets: ['vegan'],
        stepFree: true,
        notes: 'Please confirm step-free entry and seating.',
        favourites: 'Jazz, independent bookshops',
      },
      {
        id: randomUUID(),
        name: 'Sam',
        likes: ['culture', 'creative'],
        avoids: [],
        diets: [],
        stepFree: false,
        notes: '',
        favourites: '',
      },
      {
        id: randomUUID(),
        name: 'Priya',
        likes: ['conversation', 'creative'],
        avoids: [],
        diets: ['vegetarian'],
        stepFree: false,
        notes: '',
        favourites: '',
      },
      {
        id: randomUUID(),
        name: 'Daniel',
        likes: ['games', 'creative'],
        avoids: [],
        diets: [],
        stepFree: false,
        notes: '',
        favourites: '',
      },
    ];
    event.members.forEach((m) => {
      m.claimToken = token();
    });
    const previous = newEvent({
      ...defaultBrief(),
      title: 'Last month: games & lunch',
      date: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
      headcount: 6,
    });
    previous.members = structuredClone(event.members);
    previous.options = buildPlans(
      previous,
      workspace.catalogue.filter((i) => i.id === 'board-games' || i.kind === 'meal'),
      [],
    ).plans;
    previous.selected = previous.options[0] ?? null;
    previous.checks = previous.selected
      ? makeChecks(previous, previous.selected).map((c) => ({ ...c, done: true }))
      : [];
    previous.status = 'completed';
    previous.completedAt = `${previous.brief.date}T18:00:00Z`;
    previous.actualSpend = 5600;
    previous.feedback = previous.members.slice(0, 4).map((m, i) => ({
      memberId: m.id,
      rating: i === 0 ? 3 : 4,
      repeat: false,
      note: i === 0 ? 'Something creative next time would be lovely.' : '',
    }));
    previous.reflection =
      'A good afternoon. Next time, try a hands-on activity and leave a little more time for lunch.';
    event.options = buildPlans(event, workspace.catalogue, [previous]).plans;
    workspace.events = [event, previous];
  }
  return { workspace, secret };
}
export function ownerView(workspace: Workspace): OwnerWorkspace {
  const { ownerHash: _, ...clean } = structuredClone(workspace);
  clean.events.forEach((e) => {
    e.members = e.members.map(({ secretHash: __, ...m }) => m);
    e.needsReplan =
      !!e.selected &&
      (e.selected.fingerprint !== briefFingerprint(e.brief, e.members) ||
        e.selected.blocks.some((b) => e.excludedItemIds.includes(b.itemId)));
  });
  return clean;
}
export function publicView(event: EventRecord): PublicEvent {
  const { title, goal, date, startTime, endTime, city, location, headcount } = event.brief;
  return {
    title,
    goal,
    date,
    startTime,
    endTime,
    city,
    location,
    headcount,
    status: event.status,
    blocks:
      event.selected?.blocks.map(({ id, kind, name, description, start, duration }) => ({
        id,
        kind,
        name,
        description,
        start,
        duration,
      })) ?? [],
    pendingChecks: event.checks.filter((c) => !c.done).length,
    sample: event.selected?.blocks.some((b) => b.source === 'sample') ?? false,
  };
}
