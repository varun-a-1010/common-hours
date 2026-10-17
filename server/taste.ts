import type { Brief, Member } from '../shared/model';

export interface TasteEvidence { source: 'qloo'; entityId: string; queryId: string; explanation: string; fetchedAt: string }
export interface TasteCandidate { entityId: string; name: string; kind: 'place' | 'artist' | 'movie'; evidence: TasteEvidence[] }
export interface TasteProvider {
  status: 'not-connected' | 'connected';
  discover(input: { brief: Brief; members: Pick<Member, 'likes' | 'favourites'>[] }): Promise<TasteCandidate[]>;
}
// A real baseline, with no simulated affinity scores or external request.
// A future adapter must verify entity coverage and return actual source evidence.
export const tasteProvider: TasteProvider = { status: 'not-connected', async discover() { return []; } };
