import type { EventRecord, Plan } from '../shared/model';
import { money } from '../shared/model';
import type { PlanRevision } from '../shared/revision';

export function PlanEvidence({ event, plan }: { event: EventRecord; plan: Plan }) {
  return (
    <details className="plan-evidence">
      <summary>Who is represented?</summary>
      <p className="muted small-text">
        Stated interests are direct matches to activity tags. Qloo ranks are relative cultural
        evidence for linked venues, not satisfaction predictions.
      </p>
      {!plan.people && <p>Refresh options to see per-person evidence for this older plan.</p>}
      <ul className="evidence-people">
        {event.members.map((member) => {
          const direct = plan.people?.find((p) => p.memberId === member.id);
          const taste = plan.taste?.people.find((p) => p.memberId === member.id);
          return (
            <li key={member.id}>
              <strong>{member.name}</strong>
              <span>
                {!direct
                  ? 'Stated interests not assessed in this saved plan.'
                  : direct.interests.length
                    ? `Activity matches: ${direct.interests.join(', ')}.`
                    : member.likes.length
                      ? 'No stated activity interest represented.'
                      : 'No activity interests shared yet.'}
              </span>
              {taste && (
                <>
                  {taste.status === 'no-favourites' ? (
                    <span className="muted">Qloo: no confirmed favourites.</span>
                  ) : taste.status === 'unavailable' ? (
                    <span className="muted">Qloo: comparison unavailable; no inference made.</span>
                  ) : !taste.venues.length ? (
                    <span className="muted">No unlocked linked venue to compare in this plan.</span>
                  ) : (
                    taste.venues.map((venue) => (
                      <span key={venue.itemId}>
                        {plan.blocks.find((b) => b.itemId === venue.itemId)?.name}:{' '}
                        {venue.rank === undefined
                          ? 'Qloo evidence unknown — not returned for this profile.'
                          : `Qloo rank ${venue.rank} among returned venues.`}
                        {venue.contributingNames.length > 0
                          ? ` Contributing favourites: ${venue.contributingNames.join(', ')}.`
                          : venue.rank !== undefined
                            ? ' Individual contributions were not supplied.'
                            : ''}
                      </span>
                    ))
                  )}
                  {taste.queryId && (
                    <details className="taste-evidence">
                      <summary>Query evidence</summary>
                      <p>References: {taste.seeds.map((s) => s.name).join(', ')}.</p>
                      <p>
                        {taste.candidateCount} feasible venues queried · retrieved{' '}
                        {new Date(taste.fetchedAt!).toLocaleString()}.
                      </p>
                      <p>Local receipt: {taste.queryId}</p>
                    </details>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {event.members.length < event.brief.headcount && (
        <p>{event.brief.headcount - event.members.length} people have not responded yet.</p>
      )}
      {plan.taste && (
        <p className="muted small-text">
          {plan.taste.orderChanged
            ? 'Qloo changed this option’s position among plans with equal stated-interest and history scores.'
            : 'This option kept its ordinary position after the comparison.'}{' '}
          When evidence is complete, the weakest relative ranking across people is considered first,
          then the average. People without confirmed favourites remain unassessed by Qloo.
        </p>
      )}
    </details>
  );
}

export function RevisionView({
  revision,
  preview = false,
}: {
  revision: PlanRevision;
  preview?: boolean;
}) {
  return (
    <details className="plan-revision" open>
      <summary>
        {preview ? 'Compared with your current plan' : 'What changed in this revision'}
      </summary>
      <ul>
        {revision.changes.map((change) => (
          <li key={change.kind}>
            <span className={change.kept ? 'revision-kept' : 'revision-changed'}>
              {change.kept ? 'Kept' : 'Changed'}
            </span>
            {change.label}
          </li>
        ))}
      </ul>
      <p>
        {revision.costDelta === 0
          ? 'Same total cost'
          : `${money(Math.abs(revision.costDelta))} ${revision.costDelta > 0 ? 'more' : 'less'}`}{' '}
        including reserve. {revision.keptChecks} completed checks{' '}
        {preview ? 'will carry over' : 'carried over'}.
      </p>
    </details>
  );
}
