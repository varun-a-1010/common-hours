import { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coffee,
  Leaf,
  Link2,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UnlockKeyhole,
  UsersRound,
} from 'lucide-react';
import {
  dateLabel,
  money,
  timeLabel,
  type CatalogueItem,
  type Check as LogisticsCheck,
  type EventRecord,
  type Member,
  type Plan,
} from '../shared/model';
import { Button, CheckPill, Empty, ExternalLink, Notice, SectionTitle, Status } from './components';
import { Field, FeedbackForm } from './forms';
import { PlanEvidence, RevisionView } from './PlanEvidence';
import { comparePlans } from '../shared/revision';

export type Action = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
export function EventSummary({ event, edit }: { event: EventRecord; edit?: () => void }) {
  const b = event.brief;
  return (
    <div className="brief-strip">
      <span>
        <CalendarDays size={17} />
        {dateLabel(b.date)}
      </span>
      <span>
        <Clock3 size={17} />
        {b.startTime}–{b.endTime}
      </span>
      <span>
        <UsersRound size={17} />
        {b.headcount} people
      </span>
      <span>
        <MapPin size={17} />
        {b.format === 'office' ? 'In the office' : b.city}
      </span>
      <span className="brief-budget">
        {money(b.budget)}
        <small>total budget</small>
      </span>
      {edit && (
        <button className="icon-button" onClick={edit} aria-label="Edit event brief">
          <Pencil size={16} />
        </button>
      )}
    </div>
  );
}
export function BriefPanel({
  event,
  busy,
  generate,
  invite,
  people,
  edit,
}: {
  event: EventRecord;
  busy: boolean;
  generate: () => void;
  invite: () => void;
  people: () => void;
  edit: () => void;
}) {
  return (
    <div className="overview-grid">
      <section className="surface brief-main">
        <span className="small-label">The occasion</span>
        <h2>{event.brief.goal || 'Make some time for the people you work with.'}</h2>
        <p>
          Start with what the team enjoys. We’ll keep the practical details in view as the plan
          takes shape.
        </p>
        <div className="brief-facts">
          <div>
            <span>Meeting point</span>
            <strong>{event.brief.location || 'Still to decide'}</strong>
          </div>
          <div>
            <span>Format</span>
            <strong>
              {event.brief.format === 'office'
                ? 'Inside the office'
                : event.brief.format === 'outing'
                  ? 'Local outing'
                  : 'Open to either'}
            </strong>
          </div>
          <div>
            <span>Food</span>
            <strong>{event.brief.includeMeal ? 'Included in the plan' : 'Activity only'}</strong>
          </div>
          <div>
            <span>Between stops</span>
            <strong>{event.brief.travelMinutes} minute buffer</strong>
          </div>
        </div>
        <Button onClick={edit}>
          <Pencil size={15} />
          Edit the brief
        </Button>
      </section>
      <aside className="surface getting-started">
        <div className="people-art" aria-hidden="true">
          <span>M</span>
          <span>A</span>
          <span>+</span>
        </div>
        <h2>Good plans start with people.</h2>
        <p>
          {event.members.length} of {event.brief.headcount} preferences collected. Invite the team
          or add what they’ve shared with you.
        </p>
        <div className="progress-track">
          <span
            style={{
              width: `${Math.min(100, (event.members.length / event.brief.headcount) * 100)}%`,
            }}
          />
        </div>
        <Button variant="primary" onClick={invite}>
          <Link2 size={16} />
          Invite the team
        </Button>
        <Button variant="plain" onClick={people}>
          Manage preferences
          <ArrowRight size={16} />
        </Button>
      </aside>
      <div className="next-step">
        <div>
          <h3>Ready to explore a few possibilities?</h3>
          <p>Start with the preferences you have. Unanswered needs remain visible.</p>
        </div>
        <Button variant="primary" disabled={busy} onClick={generate}>
          {busy ? 'Finding plans…' : 'Find event plans'}
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

export function PeoplePanel({
  event,
  busy,
  add,
  edit,
  remove,
  invite,
}: {
  event: EventRecord;
  busy: boolean;
  add: () => void;
  edit: (m: Member) => void;
  remove: (m: Member) => void;
  invite: () => void;
}) {
  const completed = event.status === 'completed';
  return (
    <>
      <SectionTitle
        title="A little about everyone"
        action={
          !completed && (
            <div className="button-row">
              <Button onClick={invite}>
                <Link2 size={16} />
                Invite link
              </Button>
              <Button
                variant="primary"
                onClick={add}
                disabled={busy || event.members.length >= event.brief.headcount}
              >
                <Plus size={16} />
                Add a person
              </Button>
            </div>
          )
        }
      >
        Private requirements stay with the organizer. The shared agenda contains no individual
        responses.
      </SectionTitle>
      <div className="response-summary">
        <strong>
          {event.members.length} / {event.brief.headcount}
        </strong>
        <span>preferences collected</span>
        <div className="progress-track">
          <span
            style={{
              width: `${Math.min(100, (event.members.length / event.brief.headcount) * 100)}%`,
            }}
          />
        </div>
      </div>
      {!event.members.length ? (
        <Empty
          icon={<UsersRound />}
          title="Make room for everyone’s preferences"
          action={<Button onClick={add}>Add the first person</Button>}
        >
          A short preference check helps the team find common ground.
        </Empty>
      ) : (
        <div className="people-list">
          {event.members.map((m, index) => (
            <article className="person-row" key={m.id}>
              <span className={`avatar tint-${index % 4}`}>{m.name.slice(0, 1).toUpperCase()}</span>
              <div className="person-content">
                <h3>{m.name}</h3>
                <div className="tags">
                  {m.likes.length ? (
                    m.likes.map((t) => <span key={t}>{t}</span>)
                  ) : (
                    <span className="muted">Open on interests</span>
                  )}
                  {m.avoids.map((t) => (
                    <span key={t} className="avoid-tag">
                      Avoid {t}
                    </span>
                  ))}
                </div>
                {(m.diets.length > 0 || m.stepFree) && (
                  <p className="requirements">
                    {[...m.diets, ...(m.stepFree ? ['Step-free access'] : [])].join(' · ')}
                  </p>
                )}
                {m.notes && <p className="person-note">{m.notes}</p>}
                {m.favourites && (
                  <p className="muted small-text">Favourites saved: {m.favourites}</p>
                )}
                {!!m.tasteSeeds?.length && (
                  <p className="muted small-text">
                    Confirmed Qloo references: {m.tasteSeeds.map((s) => s.name).join(', ')}
                  </p>
                )}
              </div>
              {!completed && (
                <div className="person-actions">
                  <button
                    className="icon-button"
                    onClick={() => edit(m)}
                    aria-label={`Edit ${m.name}`}
                    disabled={busy}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    onClick={() => remove(m)}
                    aria-label={`Remove ${m.name}`}
                    disabled={busy}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function PlanOptions({
  event,
  busy,
  generate,
  choose,
  library,
  discover,
}: {
  event: EventRecord;
  busy: boolean;
  generate: (useTaste: boolean) => void;
  choose: (p: Plan) => void;
  library: () => void;
  discover: () => void;
}) {
  const [useTaste, setUseTaste] = useState(event.useTaste ?? false);
  const profiles = event.members.filter((m) => m.tasteSeeds?.length).length;
  return (
    <>
      <SectionTitle
        title={event.selected ? 'A few ways to revise the plan' : 'Find your kind of afternoon'}
        action={
          <Button onClick={() => generate(useTaste)} disabled={busy}>
            <RefreshCw size={16} />
            {busy ? 'Finding plans…' : 'Refresh options'}
          </Button>
        }
      >
        Based on stated interests, practical requirements and recent events. Costs include a 10%
        reserve.
      </SectionTitle>
      <div className="planning-taste">
        <label className="check-label">
          <input
            type="checkbox"
            checked={useTaste}
            disabled={busy}
            onChange={(e) => setUseTaste(e.target.checked)}
          />
          Compare linked venues with Qloo
        </label>
        <p>
          {profiles} of {event.members.length} people have confirmed favourites. Qloo receives
          selected reference IDs, venue IDs and city. Names and private requirements stay here.
        </p>
        <Button variant="plain" onClick={discover} disabled={busy}>
          Set up favourites & venues <ArrowRight size={15} />
        </Button>
      </div>
      <Notice tone="warm">
        The starter library contains example activities and estimated prices. Add actual venues and
        quotes before finalizing arrangements.
      </Notice>
      {event.messages.length > 0 && (
        <div className="planning-messages" role="status">
          {event.messages.map((m, i) => (
            <p key={m}>{i === 0 ? <strong>{m}</strong> : m}</p>
          ))}
          <Button onClick={library}>
            <Plus size={16} />
            Add another option to the library
          </Button>
        </div>
      )}
      {!event.options.length && !event.messages.length && (
        <Empty
          icon={<Leaf />}
          title="Let’s put a few ideas on the table"
          action={
            <Button variant="primary" onClick={() => generate(useTaste)} disabled={busy}>
              Find event plans
            </Button>
          }
        >
          We’ll consider the whole event: activity, food, timing and the people coming.
        </Empty>
      )}
      <div className="plan-grid">
        {event.options.map((plan, index) => (
          <article className={`plan-card plan-color-${index}`} key={plan.id}>
            <div className="plan-cover">
              <span className="plan-number">Option {index + 1}</span>
              <div className="plan-illustration" aria-hidden="true">
                {plan.blocks[0].itemId.includes('game') ||
                plan.blocks[0].itemId.includes('escape') ? (
                  <div className="paper-game">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                ) : (
                  <div className="paper-objects">
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>
              <h3>{plan.title}</h3>
            </div>
            <div className="plan-content">
              <div className="plan-stops">
                {plan.blocks.map((b) => (
                  <div key={b.id}>
                    <span>{timeLabel(b.start)}</span>
                    <p>
                      {b.name}
                      {b.locked && <LockKeyhole size={13} aria-label="Locked arrangement" />}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="reasons">
                {plan.reasons.map((r) => (
                  <li key={r}>
                    <Check size={15} />
                    {r}
                  </li>
                ))}
              </ul>
              <div className="plan-price">
                <strong>{money(plan.total)}</strong>
                <span>{money(Math.ceil(plan.total / event.brief.headcount))} / person</span>
              </div>
              {event.selected && (
                <RevisionView
                  preview
                  revision={comparePlans(
                    event.selected,
                    plan,
                    event.selected.fingerprint === plan.fingerprint
                      ? event.checks.filter(
                          (c) =>
                            c.done &&
                            (c.itemId === 'event' ||
                              plan.blocks.some((b) => b.locked && b.itemId === c.itemId)),
                        ).length
                      : 0,
                  )}
                />
              )}
              <PlanEvidence event={event} plan={plan} />
              <details className="cautions">
                <summary>{plan.cautions.length} things to keep in view</summary>
                <ul>
                  {plan.cautions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
              <Button
                variant={index === 0 ? 'primary' : 'secondary'}
                onClick={() => choose(plan)}
                disabled={busy}
              >
                Choose this plan
                <ArrowRight size={16} />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function AgendaPanel({
  event,
  busy,
  action,
  editCheck,
  quote,
  share,
  complete,
  alternatives,
  editBrief,
}: {
  event: EventRecord;
  busy: boolean;
  action: Action;
  editCheck: (c: LogisticsCheck) => void;
  quote: (id: string) => void;
  share: () => void;
  complete: () => void;
  alternatives: (ids: string[]) => void;
  editBrief: () => void;
}) {
  const plan = event.selected;
  if (!plan)
    return (
      <Empty
        icon={<CalendarDays />}
        title="Your agenda starts with a plan"
        action={
          <Button variant="primary" onClick={() => alternatives([])}>
            Explore event plans
          </Button>
        }
      >
        Choose an option to arrange the details and share the day.
      </Empty>
    );
  const finished = event.status === 'completed',
    done = event.checks.filter((c) => c.done).length;
  const unavailable = plan.blocks.some((b) => event.excludedItemIds.includes(b.itemId));
  return (
    <>
      <SectionTitle
        title={finished ? 'The day, remembered' : 'Make it a good day'}
        action={
          <Button onClick={share}>
            <Link2 size={16} />
            Share agenda
          </Button>
        }
      >
        {finished
          ? 'Keep what worked, and carry the lessons into the next event.'
          : 'Keep the arrangements you like. Change the parts that need a rethink.'}
      </SectionTitle>
      {event.needsReplan && !unavailable && (
        <Notice tone="warm">
          The brief or participant preferences changed. Refresh the plans to include the new
          requirements.
          <Button variant="plain" disabled={busy} onClick={() => alternatives([])}>
            Refresh plans
          </Button>
        </Notice>
      )}
      {unavailable && (
        <Notice tone="warm">
          An arrangement is unavailable. Choose a replacement before confirming this plan.
        </Notice>
      )}
      {plan.total > event.brief.budget && (
        <Notice tone="warm">
          Updated quotes put this plan {money(plan.total - event.brief.budget)} over budget. Revise
          the plan or budget.
        </Notice>
      )}
      {event.lastRevision && <RevisionView revision={event.lastRevision} />}
      <PlanEvidence event={event} plan={plan} />
      <div className="agenda-layout">
        <section>
          <div className="agenda-sheet">
            <div className="agenda-date">
              <CalendarDays size={19} />
              <div>
                <strong>{dateLabel(event.brief.date)}</strong>
                <span>{event.brief.location || 'Meeting point to confirm'}</span>
              </div>
            </div>
            <div className="timeline">
              <div className="timeline-buffer">
                <time>{event.brief.startTime}</time>
                <div>
                  <span className="timeline-dot" />
                  <strong>Arrive & settle in</strong>
                  <p>A little breathing room before we begin.</p>
                </div>
              </div>
              {plan.blocks.map((b, i) => (
                <div className={`timeline-entry ${b.kind}`} key={b.id}>
                  <time>{timeLabel(b.start)}</time>
                  <div className={`agenda-block ${b.kind}`}>
                    <div className="agenda-block-head">
                      <span>
                        {b.kind === 'meal' ? <Coffee size={17} /> : <Leaf size={17} />}
                        {b.duration} minutes
                      </span>
                      {b.locked && (
                        <span className="lock-label">
                          <LockKeyhole size={13} />
                          Keep this
                        </span>
                      )}
                    </div>
                    <h3>{b.name}</h3>
                    <p>{b.description}</p>
                    <div className="agenda-block-meta">
                      <span>
                        {b.quotedCost !== undefined ? 'Recorded quote' : 'Estimate'}:{' '}
                        {money(b.quotedCost ?? b.cost)}
                      </span>
                      {b.source === 'sample' && (
                        <span className="sample-label">Example activity</span>
                      )}
                    </div>
                    {!finished && (
                      <div className="agenda-block-actions">
                        <Button
                          variant="plain"
                          disabled={busy}
                          onClick={() => action('lock', { blockId: b.id, locked: !b.locked })}
                        >
                          {b.locked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}
                          {b.locked ? 'Unlock' : 'Keep when replanning'}
                        </Button>
                        <Button variant="plain" disabled={busy} onClick={() => quote(b.id)}>
                          Record quote
                        </Button>
                        {!b.locked && (
                          <Button
                            variant="plain"
                            disabled={busy}
                            onClick={() => alternatives([b.itemId])}
                          >
                            Replace
                          </Button>
                        )}
                      </div>
                    )}
                    {i === 0 && plan.blocks.length > 1 && (
                      <p className="gap-note">
                        {plan.blocks[1].start - (b.start + b.duration)} minutes before the next stop
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="timeline-buffer">
                <time>{timeLabel(plan.blocks.at(-1)!.start + plan.blocks.at(-1)!.duration)}</time>
                <div>
                  <span className="timeline-dot" />
                  <strong>Wrap up & head back</strong>
                  <p>The event window ends at {event.brief.endTime}.</p>
                </div>
              </div>
            </div>
          </div>
          {!finished && (
            <div className="change-panel">
              <RefreshCw size={20} />
              <div>
                <h3>Plans change. That’s okay.</h3>
                <p>
                  Lock what’s arranged, then find alternatives. Update the brief if the budget or
                  headcount changes.
                </p>
                <div className="button-row">
                  <Button onClick={() => alternatives([])} disabled={busy}>
                    Find alternatives
                  </Button>
                  <Button variant="plain" onClick={editBrief}>
                    Edit brief
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
        <aside className="agenda-aside">
          <section className="surface budget-card">
            <h3>The budget</h3>
            <div className="budget-total">
              <strong>{money(plan.total)}</strong>
              <span>of {money(event.brief.budget)}</span>
            </div>
            <div className={`progress-track ${plan.total > event.brief.budget ? 'over' : ''}`}>
              <span
                style={{ width: `${Math.min(100, (plan.total / event.brief.budget) * 100)}%` }}
              />
            </div>
            <dl>
              {plan.blocks.map((b) => (
                <div key={b.id}>
                  <dt>{b.kind === 'meal' ? 'Food' : 'Activity'}</dt>
                  <dd>{money(b.quotedCost ?? b.cost)}</dd>
                </div>
              ))}
              <div>
                <dt>10% reserve</dt>
                <dd>{money(plan.reserve)}</dd>
              </div>
              <div className="budget-remaining">
                <dt>Remaining</dt>
                <dd>{money(event.brief.budget - plan.total)}</dd>
              </div>
              {finished && (
                <div>
                  <dt>Actual spend</dt>
                  <dd>{money(event.actualSpend ?? 0)}</dd>
                </div>
              )}
            </dl>
            <p>
              Travel, taxes and extra charges need to fit the reserve or be included in your quotes.
            </p>
          </section>
          <section className="surface checklist-card">
            <div className="checklist-heading">
              <h3>The last few details</h3>
              <span>
                {done}/{event.checks.length}
              </span>
            </div>
            <div className="checklist">
              {event.checks.map((c) => (
                <button
                  className={`logistics-check ${c.done ? 'done' : ''}`}
                  key={c.id}
                  disabled={busy || finished}
                  onClick={() => editCheck(c)}
                >
                  <span className="check-square">{c.done && <Check size={13} />}</span>
                  <span>
                    {c.label}
                    {c.assignee && <small>{c.assignee}</small>}
                    {c.note && <small className="check-note">{c.note}</small>}
                  </span>
                  <Pencil size={12} />
                </button>
              ))}
            </div>
            {!finished && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => (event.status === 'ready' ? complete() : action('ready'))}
              >
                {event.status === 'ready' ? 'Complete event' : 'Mark ready to go'}
                <CheckCircle2 size={16} />
              </Button>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export function LibraryPanel({ catalogue, add }: { catalogue: CatalogueItem[]; add: () => void }) {
  const [filter, setFilter] = useState('all'),
    [query, setQuery] = useState('');
  const visible = catalogue.filter(
    (i) =>
      (filter === 'all' || filter === i.kind || filter === i.format || filter === i.source) &&
      `${i.name} ${i.description} ${i.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        title="A library of good possibilities"
        action={
          <Button variant="primary" onClick={add}>
            <Plus size={16} />
            Add an option
          </Button>
        }
      >
        Keep useful activities, food options and actual providers in one place.
      </SectionTitle>
      <Notice tone="warm">
        Starter entries are example concepts with illustrative prices. Add real providers and check
        details for your event.
      </Notice>
      <div className="library-toolbar">
        <input
          type="search"
          aria-label="Search activity library"
          placeholder="Find an activity, meal or interest…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter activity library"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Everything</option>
          <option value="activity">Activities</option>
          <option value="meal">Food</option>
          <option value="office">Inside the office</option>
          <option value="outing">Outings</option>
          <option value="custom">Your additions</option>
        </select>
      </div>
      <div className="library-list">
        {visible.map((i) => (
          <article className="library-item" key={i.id}>
            <span className={`library-icon ${i.kind}`}>
              {i.kind === 'meal' ? <Coffee size={23} /> : <Leaf size={23} />}
            </span>
            <div>
              <div className="library-item-title">
                <h3>{i.name}</h3>
                <span className={`source-pill ${i.source}`}>
                  {i.source === 'sample' ? 'Example' : 'Added by you'}
                </span>
              </div>
              <p>{i.description}</p>
              <div className="tags">
                {i.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <details>
                <summary>Practical details</summary>
                <p>
                  {i.city} ·{' '}
                  {i.format === 'office'
                    ? 'In-office'
                    : i.format === 'outing'
                      ? 'Outing'
                      : 'Either format'}{' '}
                  · {i.minPeople}–{i.maxPeople} people · {i.indoor ? 'Indoors' : 'Outdoors'}
                </p>
                <p>
                  Step-free access: {i.stepFree === 'unknown' ? 'needs checking' : i.stepFree}.{' '}
                  {i.diets.length ? `Food options: ${i.diets.join(', ')}.` : ''}
                </p>
                <p>{i.details}</p>
                {i.sourceUrl && <ExternalLink url={i.sourceUrl}>Provider information</ExternalLink>}
              </details>
            </div>
            <div className="library-price">
              <strong>{money(i.perPerson)}</strong>
              <span>per person</span>
              {i.fixedCost > 0 && <small>+ {money(i.fixedCost)} fixed</small>}
              <span>{i.duration} min</span>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty title="Nothing here yet">Try another search or add an option of your own.</Empty>
      )}
    </>
  );
}

export function HistoryPanel({
  events,
  open,
  next,
}: {
  events: EventRecord[];
  open: (e: EventRecord) => void;
  next: (e: EventRecord) => void;
}) {
  const completed = events.filter((e) => e.status === 'completed');
  return (
    <>
      <SectionTitle title="Good times, useful lessons">
        Each event gives the next one a better starting point.
      </SectionTitle>
      {!completed.length ? (
        <Empty icon={<CalendarDays />} title="Your shared history starts here">
          Complete an event and collect a little feedback. We’ll remember it next time.
        </Empty>
      ) : (
        <div className="history-list">
          {completed.map((e) => (
            <article className="history-item" key={e.id}>
              <div className="history-date">
                <span>
                  {new Date(`${e.brief.date}T12:00:00`).toLocaleDateString('en', {
                    month: 'short',
                  })}
                </span>
                <strong>{new Date(`${e.brief.date}T12:00:00`).getDate()}</strong>
              </div>
              <div className="history-content">
                <Status status={e.status} />
                <h3>
                  <button onClick={() => open(e)}>{e.brief.title}</button>
                </h3>
                <p>{e.selected?.blocks.map((b) => b.name).join(' + ')}</p>
                {e.reflection && <blockquote>{e.reflection}</blockquote>}
                <div className="history-meta">
                  <span>{e.brief.headcount} people</span>
                  <span>{money(e.actualSpend ?? 0)} actual spend</span>
                  <span>
                    {e.feedback.length} responses
                    {e.feedback.length
                      ? ` · ${(e.feedback.reduce((s, f) => s + f.rating, 0) / e.feedback.length).toFixed(1)}/5`
                      : ''}
                  </span>
                </div>
              </div>
              <Button onClick={() => next(e)}>
                Plan the next one
                <ArrowRight size={16} />
              </Button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function FeedbackPanel({
  event,
  record,
  invite,
}: {
  event: EventRecord;
  record: () => void;
  invite: () => void;
}) {
  if (event.status !== 'completed')
    return (
      <Empty icon={<ClipboardList />} title="A little reflection goes a long way">
        Feedback opens when you complete the event. The team can then use their original invitation
        link to respond.
      </Empty>
    );
  const average = event.feedback.length
    ? (event.feedback.reduce((s, f) => s + f.rating, 0) / event.feedback.length).toFixed(1)
    : '—';
  return (
    <>
      <SectionTitle
        title="What should we carry forward?"
        action={
          <div className="button-row">
            <Button onClick={invite}>
              <Link2 size={15} />
              Feedback link
            </Button>
            <Button variant="primary" onClick={record}>
              Record feedback
            </Button>
          </div>
        }
      >
        Participants can respond from the browser they used for their preferences. You can also
        record feedback they share directly.
      </SectionTitle>
      <div className="feedback-summary">
        <div>
          <strong>
            {average}
            <small>/5</small>
          </strong>
          <span>average rating</span>
        </div>
        <div>
          <strong>
            {event.feedback.length}
            <small>/{event.members.length}</small>
          </strong>
          <span>responses</span>
        </div>
        <div>
          <strong>{event.feedback.filter((f) => f.repeat).length}</strong>
          <span>would repeat the activity</span>
        </div>
      </div>
      {event.reflection && (
        <div className="organizer-reflection">
          <h3>Organizer’s note</h3>
          <p>{event.reflection}</p>
        </div>
      )}
      <div className="feedback-list">
        {event.feedback.map((f) => (
          <article key={f.memberId}>
            <div>
              <strong>
                {event.members.find((m) => m.id === f.memberId)?.name ?? 'Participant'}
              </strong>
              <span>{f.rating}/5</span>
            </div>
            <p>{f.note || 'No additional note.'}</p>
            <CheckPill>
              {f.repeat ? 'Would enjoy it again' : 'Try something different next time'}
            </CheckPill>
          </article>
        ))}
      </div>
    </>
  );
}

export function CheckEditor({
  check,
  busy,
  save,
}: {
  check: LogisticsCheck;
  busy: boolean;
  save: (c: Pick<LogisticsCheck, 'done' | 'note' | 'assignee'>) => Promise<void>;
}) {
  const [c, setC] = useState({ done: check.done, note: check.note, assignee: check.assignee });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await save(c);
      }}
    >
      <fieldset disabled={busy} className="form-grid">
        <Field label="Who’s taking care of it?" wide>
          <input
            maxLength={80}
            value={c.assignee}
            onChange={(e) => setC({ ...c, assignee: e.target.value })}
            placeholder="Name"
          />
        </Field>
        <Field label="Confirmation or next step" wide>
          <textarea
            rows={3}
            maxLength={600}
            value={c.note}
            onChange={(e) => setC({ ...c, note: e.target.value })}
            placeholder="Provider confirmed by phone on…"
          />
        </Field>
        <label className="check-label wide">
          <input
            type="checkbox"
            checked={c.done}
            onChange={(e) => setC({ ...c, done: e.target.checked })}
          />
          This has been confirmed
        </label>
        <div className="form-actions wide">
          <Button variant="primary" type="submit">
            Save detail
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function QuoteEditor({
  cost,
  busy,
  save,
}: {
  cost: number;
  busy: boolean;
  save: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState(cost);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await save(value);
      }}
    >
      <Field
        label="Confirmed total group quote (₹)"
        hint="Include taxes and fees. The budget will update immediately."
      >
        <input
          type="number"
          required
          min={0}
          max={10000000}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          autoFocus
        />
      </Field>
      <div className="form-actions">
        <Button variant="primary" type="submit" disabled={busy}>
          Record quote
        </Button>
      </div>
    </form>
  );
}
export function CompleteForm({
  event,
  busy,
  save,
}: {
  event: EventRecord;
  busy: boolean;
  save: (cost: number, note: string) => Promise<void>;
}) {
  const [cost, setCost] = useState(event.selected?.subtotal ?? 0),
    [note, setNote] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await save(cost, note);
      }}
    >
      <fieldset disabled={busy} className="form-grid">
        <Field label="What did you actually spend? (₹)" wide>
          <input
            required
            type="number"
            min={0}
            max={10000000}
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
          />
        </Field>
        <Field label="A note for next time" wide>
          <textarea
            rows={4}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What worked, what surprised you, what you’d change…"
          />
        </Field>
        <p className="form-hint wide">
          Completing the event opens feedback and saves the arrangements in your history.
        </p>
        <div className="form-actions wide">
          <Button variant="primary" type="submit">
            Complete event
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function FeedbackRecorder({
  event,
  busy,
  save,
}: {
  event: EventRecord;
  busy: boolean;
  save: (
    memberId: string,
    feedback: { rating: number; repeat: boolean; note: string },
  ) => Promise<void>;
}) {
  const [memberId, setMemberId] = useState(event.members[0]?.id ?? '');
  return (
    <>
      <Field label="Whose feedback are you recording?">
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {event.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <FeedbackForm
        key={memberId}
        initial={event.feedback.find((f) => f.memberId === memberId)}
        busy={busy}
        onSave={(f) => save(memberId, f)}
      />
    </>
  );
}
