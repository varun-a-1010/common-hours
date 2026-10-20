export const tasteKinds = ['artist', 'movie', 'book', 'place'] as const;
export type TasteKind = (typeof tasteKinds)[number];
export type PlaceFocus = 'cafes' | 'culture' | 'all';
export type TasteSeed = Pick<TasteEntity, 'entityId' | 'name' | 'kind'>;

export interface TasteComparison {
  queryId: string;
  fetchedAt: string;
  inputEntityIds: string[];
  candidateEntityIds: string[];
  // Ranks are relative to this exact candidate set, never enjoyment percentages.
  results: { entityId: string; rank: number; contributingEntityIds: string[] }[];
}
export interface MemberTasteComparison {
  memberId: string;
  status: 'assessed' | 'unavailable';
  result?: TasteComparison;
}
export interface PlanTaste {
  people: {
    memberId: string;
    seeds: TasteSeed[];
    status: 'assessed' | 'unavailable' | 'no-favourites';
    queryId?: string;
    fetchedAt?: string;
    candidateCount?: number;
    venues: {
      itemId: string;
      rank?: number;
      contributingNames: string[];
    }[];
  }[];
  orderChanged: boolean;
}

export interface TasteEntity {
  entityId: string;
  name: string;
  kind: TasteKind;
  description: string;
  releaseYear?: number;
  address: string;
  website: string;
  categories: string[];
}
export interface TasteCandidate extends TasteEntity {
  evidence: {
    source: 'qloo';
    // Application receipt, not an upstream Qloo request ID.
    queryId: string;
    fetchedAt: string;
    inputEntityIds: string[];
    contributingEntityIds: string[];
    explanation: string;
  };
}
export interface TasteDiscovery {
  source: 'qloo';
  kind: TasteKind;
  city?: string;
  matchedLocalities: string[];
  candidates: TasteCandidate[];
  fetchedAt: string;
  queryId: string;
  cautions: string[];
}
