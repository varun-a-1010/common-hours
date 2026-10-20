import type { PlanTaste, TasteSeed } from './taste';
import type { PlanRevision } from './revision';

export const interests = [
  'creative',
  'games',
  'culture',
  'outdoors',
  'movement',
  'conversation',
  'food',
  'music',
] as const;
export type Interest = (typeof interests)[number];
export const diets = ['vegetarian', 'vegan', 'gluten-free', 'halal'] as const;
export type Diet = (typeof diets)[number];
export type Format = 'office' | 'outing' | 'either';
export type EventStatus = 'draft' | 'planned' | 'ready' | 'completed';

export interface Brief {
  title: string;
  goal: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  location: string;
  headcount: number;
  budget: number;
  format: Format;
  includeMeal: boolean;
  travelMinutes: number;
}
export interface Member {
  id: string;
  name: string;
  likes: Interest[];
  avoids: Interest[];
  diets: Diet[];
  stepFree: boolean;
  notes: string;
  favourites: string;
  tasteSeeds?: TasteSeed[];
  secretHash?: string;
  claimToken?: string;
}
export interface CatalogueItem {
  id: string;
  kind: 'activity' | 'meal';
  name: string;
  description: string;
  format: Format;
  city: string;
  tags: Interest[];
  duration: number;
  minPeople: number;
  maxPeople: number;
  perPerson: number;
  fixedCost: number;
  stepFree: 'yes' | 'no' | 'unknown';
  diets: Diet[];
  indoor: boolean;
  source: 'sample' | 'custom';
  sourceUrl: string;
  details: string;
  qloo?: { entityId: string; name: string };
}
export interface PlanBlock {
  id: string;
  kind: 'activity' | 'meal';
  itemId: string;
  name: string;
  description: string;
  start: number;
  duration: number;
  cost: number;
  quotedCost?: number;
  locked: boolean;
  source: 'sample' | 'custom';
}
export interface Plan {
  id: string;
  title: string;
  blocks: PlanBlock[];
  subtotal: number;
  reserve: number;
  total: number;
  score: number;
  reasons: string[];
  cautions: string[];
  matchedPeople: number;
  knownPeople: number;
  fingerprint: string;
  taste?: PlanTaste;
  people?: { memberId: string; interests: Interest[] }[];
}
export interface Check {
  id: string;
  itemId: string;
  label: string;
  done: boolean;
  note: string;
  assignee: string;
}
export interface Feedback {
  memberId: string;
  rating: number;
  repeat: boolean;
  note: string;
}
export interface EventRecord {
  id: string;
  brief: Brief;
  status: EventStatus;
  members: Member[];
  options: Plan[];
  selected: Plan | null;
  checks: Check[];
  feedback: Feedback[];
  actualSpend: number | null;
  reflection: string;
  excludedItemIds: string[];
  inviteToken: string;
  shareToken: string;
  createdAt: string;
  completedAt: string | null;
  messages: string[];
  needsReplan?: boolean;
  useTaste?: boolean;
  lastRevision?: PlanRevision;
}
export interface Workspace {
  id: string;
  name: string;
  ownerHash: string;
  version: number;
  demo: boolean;
  catalogue: CatalogueItem[];
  events: EventRecord[];
  createdAt: string;
}
export type OwnerWorkspace = Omit<Workspace, 'ownerHash'>;
export interface PublicEvent {
  title: string;
  goal: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  location: string;
  headcount: number;
  status: EventStatus;
  blocks: Pick<PlanBlock, 'id' | 'kind' | 'name' | 'description' | 'start' | 'duration'>[];
  pendingChecks: number;
  sample: boolean;
}
export interface JoinView {
  event: PublicEvent;
  member: Omit<Member, 'secretHash'> | null;
  feedback: Feedback | null;
}

export const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
export const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
export const timeLabel = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
