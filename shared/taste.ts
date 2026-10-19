export const tasteKinds = ['artist', 'movie', 'book', 'place'] as const;
export type TasteKind = (typeof tasteKinds)[number];
export type PlaceFocus = 'cafes' | 'culture' | 'all';

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
