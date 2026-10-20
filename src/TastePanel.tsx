import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { EventRecord } from '../shared/model';
import {
  tasteKinds,
  type PlaceFocus,
  type TasteDiscovery,
  type TasteEntity,
  type TasteKind,
  type TasteSeed,
} from '../shared/taste';
import { api } from './api';
import { Button, ExternalLink, Notice, SectionTitle } from './components';
import { Field } from './forms';

const labels: Record<TasteKind, string> = {
  artist: 'Artists',
  movie: 'Films',
  book: 'Books',
  place: 'Places',
};
export function TastePanel({
  event,
  version,
  review,
  saveProfile,
  planning,
  saving,
}: {
  event: EventRecord;
  version: number;
  review: (entity: TasteEntity, fetchedAt: string) => void;
  saveProfile: (memberId: string, seeds: TasteSeed[]) => Promise<boolean>;
  planning: () => void;
  saving: boolean;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [searchKind, setSearchKind] = useState<TasteKind>('artist');
  const [kind, setKind] = useState<TasteKind>(event.brief.format === 'office' ? 'artist' : 'place');
  const [focus, setFocus] = useState<PlaceFocus>('cafes');
  const [matches, setMatches] = useState<TasteEntity[]>([]);
  const [searched, setSearched] = useState(false);
  const [explorationSeeds, setSeeds] = useState<TasteSeed[]>([]);
  const [personId, setPersonId] = useState('');
  const person = event.members.find((m) => m.id === personId);
  const seeds = person ? (person.tasteSeeds ?? []) : explorationSeeds;
  const [result, setResult] = useState<TasteDiscovery | null>(null);
  const [working, setBusy] = useState(false);
  const busy = working || saving;
  const [error, setError] = useState('');
  const seedKey = seeds.map((s) => s.entityId).join(',');
  useEffect(() => {
    setResult(null);
  }, [seedKey]);
  useEffect(() => {
    let active = true;
    api<{ taste: string }>('/api/health')
      .then((data) => {
        if (active) setConnected(data.taste === 'configured');
      })
      .catch(() => {
        if (active) setError('Could not check the discovery connection. Refresh to try again.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function select(entity: TasteEntity) {
    if (seeds.length >= 8 || seeds.some((s) => s.entityId === entity.entityId)) return;
    updateSeeds([...seeds, { entityId: entity.entityId, name: entity.name, kind: entity.kind }]);
  }
  function updateSeeds(next: TasteSeed[]) {
    setResult(null);
    if (person)
      void run(async () => {
        await saveProfile(person.id, next);
      });
    else setSeeds(next);
  }
  return (
    <section className="taste-panel">
      <SectionTitle title="Find a cultural starting point">
        Explore places for an outing, or artists, films and books for an activity in the office.
        Confirm the favourites you mean before asking Qloo for suggestions.
      </SectionTitle>
      {connected === false && (
        <Notice tone="warm">
          Cultural discovery is not connected on this server yet. Your event planner still works.
        </Notice>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {event.status === 'completed' ? (
        <Notice>Start a new event to explore ideas for next time.</Notice>
      ) : (
        <>
          <div className="surface">
            <h3>1. Choose a few favourites</h3>
            <p>
              Search sends the title or name you enter to Qloo. Finding suggestions sends the
              selected references and, for places, your event city.
            </p>
            <Field label="Whose favourites are these?">
              <select
                value={person?.id ?? ''}
                disabled={busy}
                onChange={(e) => {
                  setPersonId(e.target.value);
                  setResult(null);
                }}
              >
                <option value="">Explore without saving to a person</option>
                {event.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <p className="muted small-text">
              {person
                ? `Selections save to ${person.name}’s preferences and carry into the next event when you copy the team.`
                : 'Choose a person to save their references for per-person venue comparisons. Only choose favourites they have shared.'}
            </p>
            {event.members.some((m) => m.favourites) && (
              <details className="taste-saved">
                <summary>Favourites the team has shared</summary>
                <ul>
                  {event.members
                    .filter((m) => m.favourites)
                    .map((m) => (
                      <li key={m.id}>
                        <strong>{m.name}:</strong> {m.favourites}
                      </li>
                    ))}
                </ul>
                <p>These notes are not sent automatically. Search individual favourites below.</p>
              </details>
            )}
            <form
              className="taste-search"
              onSubmit={(e) => {
                e.preventDefault();
                setMatches([]);
                setSearched(false);
                void run(async () => {
                  const response = await api<{ entities: TasteEntity[] }>('/api/taste/search', {
                    query,
                    kind: searchKind,
                  });
                  setMatches(response.entities);
                  setSearched(true);
                });
              }}
            >
              <Field label="Search category">
                <select
                  value={searchKind}
                  disabled={busy}
                  onChange={(e) => {
                    setSearchKind(e.target.value as TasteKind);
                    setMatches([]);
                    setSearched(false);
                  }}
                >
                  {tasteKinds.map((k) => (
                    <option key={k} value={k}>
                      {labels[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Favourite title or name">
                <input
                  value={query}
                  minLength={2}
                  maxLength={160}
                  required
                  disabled={busy}
                  placeholder="For example, Daft Punk"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setMatches([]);
                    setSearched(false);
                  }}
                />
              </Field>
              <Button type="submit" disabled={busy || !connected || query.trim().length < 2}>
                <Search size={16} />
                Search Qloo
              </Button>
            </form>
            <div className="taste-matches" aria-live="polite">
              {searched && !matches.length && (
                <p>No matching references found. Try the full title or another category.</p>
              )}
              {matches.map((match) => (
                <div className="taste-match" key={match.entityId}>
                  <div>
                    <strong>
                      {match.name}
                      {match.releaseYear ? ` (${match.releaseYear})` : ''}
                    </strong>
                    <p>{match.description || match.address || labels[match.kind]}</p>
                  </div>
                  <Button
                    disabled={
                      busy || seeds.length >= 8 || seeds.some((s) => s.entityId === match.entityId)
                    }
                    onClick={() => select(match)}
                  >
                    {seeds.some((s) => s.entityId === match.entityId)
                      ? 'Selected'
                      : 'Use this favourite'}
                  </Button>
                </div>
              ))}
            </div>
            {seeds.length > 0 && (
              <div className="taste-seeds" aria-label="Selected favourites">
                {seeds.map((seed) => (
                  <Button
                    key={seed.entityId}
                    disabled={busy}
                    onClick={() => {
                      updateSeeds(seeds.filter((s) => s.entityId !== seed.entityId));
                    }}
                    aria-label={`Remove ${seed.name}`}
                  >
                    {seed.name}
                    <X size={14} />
                  </Button>
                ))}
              </div>
            )}
            <p className="muted small-text">
              Up to eight references per person. Discovery explores these references; the plan
              comparison checks each person separately.
            </p>
          </div>
          <div className="surface">
            <h3>2. Discover possibilities</h3>
            <div className="taste-search">
              <Field label="What to discover">
                <select
                  value={kind}
                  disabled={busy}
                  onChange={(e) => {
                    setKind(e.target.value as TasteKind);
                    setResult(null);
                  }}
                >
                  {tasteKinds.map((k) => (
                    <option key={k} value={k}>
                      {k === 'place' ? `Places in ${event.brief.city}` : labels[k]}
                    </option>
                  ))}
                </select>
              </Field>
              {kind === 'place' && (
                <Field label="Place category">
                  <select
                    value={focus}
                    disabled={busy}
                    onChange={(e) => {
                      setFocus(e.target.value as PlaceFocus);
                      setResult(null);
                    }}
                  >
                    <option value="cafes">Cafés & coffee shops</option>
                    <option value="culture">Cinemas & performance venues</option>
                    <option value="all">All places</option>
                  </select>
                </Field>
              )}
              <Button
                variant="primary"
                disabled={busy || !connected || !seeds.length}
                onClick={() => {
                  setResult(null);
                  void run(async () =>
                    setResult(
                      await api<TasteDiscovery>(`/api/events/${event.id}/taste`, {
                        version,
                        kind,
                        focus,
                        entityIds: seeds.map((s) => s.entityId),
                      }),
                    ),
                  );
                }}
              >
                {busy ? 'Working…' : 'Find suggestions'}
              </Button>
            </div>
          </div>
          <div className="taste-next">
            <div>
              <h3>3. Bring the evidence into your plan</h3>
              <p>
                Review places below and save their practical details to the library. Then compare
                feasible plans using each person’s confirmed favourites.
              </p>
            </div>
            <Button onClick={planning} disabled={busy}>
              Compare event plans
            </Button>
          </div>
          {result && (
            <div aria-live="polite">
              <p className="muted small-text">
                Live Qloo results · retrieved {new Date(result.fetchedAt).toLocaleString()}
                {result.matchedLocalities.length > 0
                  ? ` · ${result.matchedLocalities.join('; ')}`
                  : ''}
              </p>
              {result.cautions.map((caution) => (
                <p className="muted small-text" key={caution}>
                  {caution}
                </p>
              ))}
              {!result.candidates.length && (
                <Notice>
                  No suggestions were returned. Try different favourites or a broader category. Your
                  saved plans are unchanged.
                </Notice>
              )}
              <div className="taste-grid">
                {result.candidates.map((candidate) => (
                  <article className="surface taste-card" key={candidate.entityId}>
                    <span className="source-pill">Qloo suggestion</span>
                    <h3>{candidate.name}</h3>
                    <p>{candidate.address || candidate.description}</p>
                    {candidate.categories.length > 0 && (
                      <p className="muted small-text">{candidate.categories.join(' · ')}</p>
                    )}
                    <p className="small-text">{candidate.evidence.explanation}</p>
                    {candidate.evidence.contributingEntityIds.length > 0 && (
                      <p className="small-text">
                        <strong>Contributing favourites:</strong>{' '}
                        {candidate.evidence.contributingEntityIds
                          .map(
                            (id) =>
                              seeds.find((s) => s.entityId === id)?.name ?? 'Selected favourite',
                          )
                          .join(', ')}
                      </p>
                    )}
                    {candidate.website && (
                      <ExternalLink url={candidate.website}>Website listed by Qloo</ExternalLink>
                    )}
                    {candidate.kind === 'place' && (
                      <Button onClick={() => review(candidate, result.fetchedAt)}>
                        Review for the activity library
                      </Button>
                    )}
                    <details className="taste-evidence">
                      <summary>Source evidence</summary>
                      <p>Qloo entity: {candidate.entityId}</p>
                      <p>Local query receipt: {candidate.evidence.queryId}</p>
                    </details>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
