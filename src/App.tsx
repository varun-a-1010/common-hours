import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Coffee,
  History,
  Leaf,
  Link2,
  Menu,
  Plus,
  RefreshCw,
  Settings2,
  UsersRound,
  X,
} from 'lucide-react';
import type {
  Brief,
  Check as LogisticsCheck,
  EventRecord,
  JoinView,
  Member,
  OwnerWorkspace,
  PublicEvent,
} from '../shared/model';
import { dateLabel, timeLabel } from '../shared/model';
import { api, ApiError } from './api';
import { TastePanel } from './TastePanel';
import type { TasteEntity } from '../shared/taste';
import { Brand, Button, CopyLink, Empty, Modal, Notice, SectionTitle, Status } from './components';
import { BriefForm, CatalogueForm, FeedbackForm, Field, freshBrief, MemberForm } from './forms';
import {
  AgendaPanel,
  BriefPanel,
  CheckEditor,
  CompleteForm,
  EventSummary,
  FeedbackPanel,
  FeedbackRecorder,
  HistoryPanel,
  LibraryPanel,
  PeoplePanel,
  PlanOptions,
  QuoteEditor,
  type Action,
} from './views';

type Tab = 'brief' | 'people' | 'options' | 'discover' | 'agenda' | 'feedback';
type Screen = 'events' | 'history' | 'library' | 'settings';
type OpenModal =
  | { kind: 'new'; source?: EventRecord }
  | { kind: 'brief' }
  | { kind: 'member'; member?: Member }
  | { kind: 'remove'; member: Member }
  | { kind: 'share' | 'invite' | 'complete' | 'feedback' }
  | { kind: 'catalogue'; suggestion?: TasteEntity; fetchedAt?: string }
  | { kind: 'check'; check: LogisticsCheck }
  | { kind: 'quote'; blockId: string };

export default function App() {
  const match = window.location.pathname.match(/^\/(join|share)\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
  return match ? (
    <PublicPage
      kind={match[1] as 'join' | 'share'}
      path={`/api/${match[1]}/${match[2]}/${match[3]}/${match[4]}${match[1] === 'join' ? location.search : ''}`}
    />
  ) : (
    <OrganizerApp />
  );
}

function OrganizerApp() {
  const [workspace, setWorkspace] = useState<OwnerWorkspace | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [modal, setModal] = useState<OpenModal | null>(null);
  const [screen, setScreen] = useState<Screen>('events'),
    [tab, setTab] = useState<Tab>('brief'),
    [activeId, setActiveId] = useState(''),
    [menu, setMenu] = useState(false);
  const [recovery, setRecovery] = useState('');
  const initialRequest = useRef<Promise<OwnerWorkspace> | null>(null),
    restoring = useRef(false);
  const event =
    workspace?.events.find((e) => e.id === activeId) ??
    workspace?.events.find((e) => e.status !== 'completed') ??
    workspace?.events[0];
  function activate(e: EventRecord) {
    setActiveId(e.id);
    setScreen('events');
    setTab(
      e.status === 'completed'
        ? 'feedback'
        : e.selected
          ? 'agenda'
          : e.options.length
            ? 'options'
            : 'brief',
    );
    setMenu(false);
  }
  async function refresh() {
    try {
      const w = await api<OwnerWorkspace>('/api/workspace');
      setWorkspace((current) =>
        !current || current.id !== w.id || w.version >= current.version ? w : current,
      );
      return w;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setWorkspace(null);
      else setError((e as Error).message);
      return null;
    }
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!initialRequest.current) {
          const restore = new URLSearchParams(location.hash.slice(1)).get('restore');
          restoring.current = !!restore;
          if (restore) history.replaceState(null, '', location.pathname);
          initialRequest.current = api<OwnerWorkspace>(
            restore ? '/api/session/restore' : '/api/workspace',
            restore ? { key: restore } : undefined,
          );
        }
        const w = await initialRequest.current;
        if (active) {
          setWorkspace(w);
          const first = w.events.find((e) => e.status !== 'completed') ?? w.events[0];
          if (first) activate(first);
        }
      } catch (e) {
        if (active && !(e instanceof ApiError && e.status === 401 && !restoring.current))
          setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!workspace || modal || busy) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 12000);
    return () => clearInterval(interval);
  }, [workspace?.id, modal, busy]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  async function mutate(url: string, data: Record<string, unknown>): Promise<boolean> {
    if (!workspace || busy) return false;
    setBusy(true);
    setError('');
    try {
      const next = await api<OwnerWorkspace>(url, { ...data, version: workspace.version });
      setWorkspace(next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  const action: Action = (name, data = {}) =>
    event ? mutate(`/api/events/${event.id}`, { ...data, action: name }) : Promise.resolve(false);
  async function generate(excluded?: string[]) {
    if (
      await action(
        event?.selected && excluded ? 'replan' : 'generate',
        excluded ? { excludedItemIds: excluded } : {},
      )
    )
      setTab('options');
  }
  const closeOn = async (success: Promise<boolean>, text?: string) => {
    if (await success) {
      setModal(null);
      if (text) setMessage(text);
    }
  };
  const inviteUrl =
    event && workspace
      ? `${location.origin}/join/${workspace.id}/${event.id}/${event.inviteToken}`
      : '';
  const shareUrl =
    event && workspace
      ? `${location.origin}/share/${workspace.id}/${event.id}/${event.shareToken}`
      : '';
  const allError = error && (
    <div className="error-banner" role="alert">
      <span>{error}</span>
      <button aria-label="Dismiss error" className="icon-button" onClick={() => setError('')}>
        <X size={18} />
      </button>
    </div>
  );

  if (loading)
    return (
      <div className="loading-page">
        <Brand />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!workspace)
    return (
      <Landing
        error={error}
        busy={busy}
        create={async (name, demo) => {
          setBusy(true);
          setError('');
          try {
            const w = await api<OwnerWorkspace>('/api/workspaces', { name, demo });
            setWorkspace(w);
            if (w.events[0]) activate(w.events[0]);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    );

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to event planner
      </a>
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Brand small />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-name">
          <span className="workspace-avatar">{workspace.name.slice(0, 1)}</span>
          <div>
            <strong>{workspace.name}</strong>
            <span>Team workspace</span>
          </div>
        </div>
        <nav aria-label="Workspace">
          <button
            className={screen === 'events' ? 'active' : ''}
            onClick={() => {
              setScreen('events');
              setMenu(false);
            }}
          >
            <CalendarDays size={19} />
            Events
          </button>
          <button
            className={screen === 'history' ? 'active' : ''}
            onClick={() => {
              setScreen('history');
              setMenu(false);
            }}
          >
            <History size={19} />
            Past events
          </button>
          <button
            className={screen === 'library' ? 'active' : ''}
            onClick={() => {
              setScreen('library');
              setMenu(false);
            }}
          >
            <Leaf size={19} />
            Activity library
          </button>
        </nav>
        <div className="sidebar-events">
          <div className="sidebar-section-title">
            <span>Coming together</span>
            <button
              className="icon-button"
              aria-label="Create an event"
              onClick={() => setModal({ kind: 'new' })}
            >
              <Plus size={16} />
            </button>
          </div>
          {workspace.events
            .filter((e) => e.status !== 'completed')
            .map((e) => (
              <button
                key={e.id}
                className={`sidebar-event ${event?.id === e.id && screen === 'events' ? 'selected' : ''}`}
                onClick={() => activate(e)}
              >
                <span className="event-dot" />
                <span>
                  {e.brief.title}
                  <small>{dateLabel(e.brief.date)}</small>
                </span>
              </button>
            ))}
          {!workspace.events.some((e) => e.status !== 'completed') && (
            <p className="sidebar-empty">Your next good day starts here.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-orbit" />
            <p>
              A little less organizing.
              <br />
              <strong>A little more together.</strong>
            </p>
          </div>
          <button
            className={screen === 'settings' ? 'active' : ''}
            onClick={() => {
              setScreen('settings');
              setMenu(false);
            }}
          >
            <Settings2 size={18} />
            Workspace settings
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              {screen === 'events'
                ? 'Your team’s next chapter'
                : screen === 'history'
                  ? 'The things worth remembering'
                  : screen === 'library'
                    ? 'Keep your options open'
                    : 'Your workspace'}
            </span>
          </div>
          <div className="topbar-actions">
            <span className="saved-indicator">
              <span />
              Saved as you go
            </span>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              onClick={() => void refresh()}
              disabled={busy}
            >
              <RefreshCw size={16} />
            </button>
            <Button variant="primary" onClick={() => setModal({ kind: 'new' })}>
              <Plus size={16} />
              New event
            </Button>
          </div>
        </header>
        <main id="main" className="main-content">
          {workspace.demo && (
            <div className="demo-banner">
              <span>Sample workspace</span>Starter people, activities and past events are
              illustrative.
            </div>
          )}
          {allError}
          {screen === 'events' && event && (
            <>
              <div className="event-heading">
                <div>
                  <div className="event-heading-meta">
                    <Status status={event.status} />
                    {event.status !== 'completed' && (
                      <span className="muted small-text">
                        {event.members.length}/{event.brief.headcount} preferences collected
                      </span>
                    )}
                  </div>
                  <h1>{event.brief.title}</h1>
                </div>
                <Button onClick={() => setModal({ kind: 'invite' })}>
                  <UsersRound size={16} />
                  {event.status === 'completed' ? 'Collect feedback' : 'Invite the team'}
                </Button>
              </div>
              <EventSummary
                event={event}
                edit={event.status !== 'completed' ? () => setModal({ kind: 'brief' }) : undefined}
              />
              <nav className="event-tabs" aria-label="Event sections">
                {(
                  [
                    ['brief', 'The brief'],
                    ['people', 'People'],
                    ['options', 'Explore plans'],
                    ['discover', 'Cultural discovery'],
                    ['agenda', 'The agenda'],
                    ['feedback', 'After the event'],
                  ] as [Tab, string][]
                ).map(([id, label]) => (
                  <button
                    className={tab === id ? 'active' : ''}
                    aria-current={tab === id ? 'page' : undefined}
                    onClick={() => setTab(id)}
                    key={id}
                  >
                    {label}
                    {id === 'people' && <span>{event.members.length}</span>}
                    {id === 'agenda' && event.selected && (
                      <span>
                        {event.checks.filter((c) => !c.done).length || <Check size={11} />}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
              <div className="tab-content">
                <div hidden={tab !== 'discover'}>
                  <TastePanel
                    key={`${workspace.id}:${event.id}:${event.brief.city}:${event.brief.format}`}
                    event={event}
                    version={workspace.version}
                    review={(suggestion, fetchedAt) =>
                      setModal({ kind: 'catalogue', suggestion, fetchedAt })
                    }
                  />
                </div>
                {tab === 'brief' &&
                  (event.status === 'completed' ? (
                    <div className="surface">
                      <h2>{event.brief.goal || event.brief.title}</h2>
                      <p>
                        This event is complete. Its arrangements and feedback are saved for next
                        time.
                      </p>
                      <Button onClick={() => setModal({ kind: 'new', source: event })}>
                        Plan the next one
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  ) : (
                    <BriefPanel
                      event={event}
                      busy={busy}
                      generate={() => void generate()}
                      invite={() => setModal({ kind: 'invite' })}
                      people={() => setTab('people')}
                      edit={() => setModal({ kind: 'brief' })}
                    />
                  ))}
                {tab === 'people' && (
                  <PeoplePanel
                    event={event}
                    busy={busy}
                    add={() => setModal({ kind: 'member' })}
                    edit={(member) => setModal({ kind: 'member', member })}
                    remove={(member) => setModal({ kind: 'remove', member })}
                    invite={() => setModal({ kind: 'invite' })}
                  />
                )}
                {tab === 'options' &&
                  (event.status === 'completed' ? (
                    <Empty
                      title="This event’s plan is part of your history"
                      action={
                        <Button onClick={() => setModal({ kind: 'new', source: event })}>
                          Plan the next one
                        </Button>
                      }
                    >
                      Start another event to explore new possibilities.
                    </Empty>
                  ) : (
                    <PlanOptions
                      event={event}
                      busy={busy}
                      generate={() => void generate()}
                      choose={async (p) => {
                        if (await action('select', { planId: p.id })) {
                          setTab('agenda');
                          setMessage('Plan selected. Let’s arrange the details.');
                        }
                      }}
                      library={() => setModal({ kind: 'catalogue' })}
                    />
                  ))}
                {tab === 'agenda' && (
                  <AgendaPanel
                    event={event}
                    busy={busy}
                    action={action}
                    editCheck={(check) => setModal({ kind: 'check', check })}
                    quote={(blockId) => setModal({ kind: 'quote', blockId })}
                    share={() => setModal({ kind: 'share' })}
                    complete={() => setModal({ kind: 'complete' })}
                    alternatives={(ids) => void generate(ids)}
                    editBrief={() => setModal({ kind: 'brief' })}
                  />
                )}
                {tab === 'feedback' && (
                  <FeedbackPanel
                    event={event}
                    record={() => setModal({ kind: 'feedback' })}
                    invite={() => setModal({ kind: 'invite' })}
                  />
                )}
              </div>
            </>
          )}
          {screen === 'events' && !event && (
            <div className="first-event">
              <span className="first-event-art" aria-hidden="true">
                <CalendarDays size={58} />
                <i />
                <i />
              </span>
              <h1>
                Good team days
                <br />
                start with a little space.
              </h1>
              <p>
                Tell us what you’re planning. Bring in everyone’s preferences, explore a few
                possibilities, and make the details manageable.
              </p>
              <Button variant="primary" onClick={() => setModal({ kind: 'new' })}>
                <Plus size={17} />
                Plan your first event
              </Button>
              <div className="first-event-features">
                <span>
                  <UsersRound size={18} />
                  Make room for everyone
                </span>
                <span>
                  <CalendarDays size={18} />
                  Keep the whole day in view
                </span>
                <span>
                  <History size={18} />
                  Remember what worked
                </span>
              </div>
            </div>
          )}
          {screen === 'history' && (
            <HistoryPanel
              events={workspace.events}
              open={activate}
              next={(source) => setModal({ kind: 'new', source })}
            />
          )}
          {screen === 'library' && (
            <LibraryPanel
              catalogue={workspace.catalogue}
              add={() => setModal({ kind: 'catalogue' })}
            />
          )}
          {screen === 'settings' && (
            <>
              <SectionTitle title="Your workspace">
                A private place to plan the next good team day.
              </SectionTitle>
              <div className="settings-grid">
                <section className="surface">
                  <h3>Keep your access</h3>
                  <p>
                    Your browser remembers this workspace. Save a private recovery link to open it
                    on another device. Anyone with that link can manage the workspace.
                  </p>
                  {recovery ? (
                    <CopyLink value={recovery} label="Copy private link" onCopy={setMessage} />
                  ) : (
                    <Button
                      onClick={async () => {
                        try {
                          const r = await api<{ key: string }>('/api/session/recovery');
                          setRecovery(`${location.origin}/#restore=${encodeURIComponent(r.key)}`);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Link2 size={16} />
                      Show private recovery link
                    </Button>
                  )}
                  <Button
                    className="signout"
                    variant="plain"
                    onClick={async () => {
                      try {
                        await api('/api/session/logout', {});
                        setWorkspace(null);
                        setRecovery('');
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Leave this workspace on this browser
                  </Button>
                </section>
                <section className="surface">
                  <div className="integration-status">
                    <span className="integration-mark">Q</span>
                    <div>
                      <h3>Cultural discovery</h3>
                      <span className="source-pill">Optional Qloo discovery</span>
                    </div>
                  </div>
                  <p>
                    Plans currently use the team’s stated preferences and your activity library.
                    Open Cultural discovery on an event to search favourites and explore Qloo
                    suggestions when connected.
                  </p>
                  <p>
                    Review suggestions before adding them to your library. Qloo does not verify
                    prices, capacity or availability.
                  </p>
                </section>
              </div>
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>Common Hours</span>
          <span>Time well spent, together.</span>
        </footer>
      </div>
      {message && (
        <div className="toast" role="status">
          <Check size={16} />
          {message}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.kind === 'new'
              ? 'Make a little time together'
              : modal.kind === 'brief'
                ? 'Shape the event brief'
                : modal.kind === 'member'
                  ? modal.member
                    ? `Preferences for ${modal.member.name}`
                    : 'Add someone to the plan'
                  : modal.kind === 'remove'
                    ? `Remove ${modal.member.name}?`
                    : modal.kind === 'share'
                      ? 'Share the day'
                      : modal.kind === 'invite'
                        ? event?.status === 'completed'
                          ? 'A little feedback for next time'
                          : 'Bring everyone into the plan'
                        : modal.kind === 'catalogue'
                          ? 'Add a good possibility'
                          : modal.kind === 'check'
                            ? modal.check.label
                            : modal.kind === 'quote'
                              ? 'Record the group quote'
                              : modal.kind === 'complete'
                                ? 'How did the day go?'
                                : 'Capture someone’s feedback'
          }
          close={() => {
            if (!busy) {
              setModal(null);
              setError('');
            }
          }}
        >
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {modal.kind === 'new' && (
            <BriefForm
              initial={
                modal.source
                  ? { ...modal.source.brief, title: 'Our next team day', date: freshBrief().date }
                  : freshBrief()
              }
              canCopy={!!modal.source}
              busy={busy}
              onSave={async (brief: Brief, copy: boolean) => {
                if (
                  await mutate('/api/events', {
                    brief,
                    ...(copy && modal.source ? { copyFrom: modal.source.id } : {}),
                  })
                ) {
                  setModal(null);
                  const w = await refresh();
                  if (w?.events[0]) activate(w.events[0]);
                }
              }}
            />
          )}
          {modal.kind === 'brief' && event && (
            <BriefForm
              initial={event.brief}
              busy={busy}
              onSave={async (b) =>
                closeOn(
                  action('brief', { brief: b }),
                  'Brief updated. Refresh the plans to include your changes.',
                )
              }
            />
          )}
          {modal.kind === 'member' && (
            <MemberForm
              initial={modal.member}
              busy={busy}
              onSave={async (member) =>
                closeOn(
                  action('member', { member, memberId: modal.member?.id }),
                  'Preferences saved.',
                )
              }
            />
          )}
          {modal.kind === 'remove' && (
            <>
              <p>
                Their preferences will be removed from this event. Update the headcount separately
                if they are no longer attending.
              </p>
              <div className="form-actions">
                <Button onClick={() => setModal(null)} disabled={busy}>
                  Keep them
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    void closeOn(action('remove-member', { memberId: modal.member.id }))
                  }
                  disabled={busy}
                >
                  Remove participant
                </Button>
              </div>
            </>
          )}
          {modal.kind === 'catalogue' && (
            <CatalogueForm
              suggestion={modal.suggestion}
              fetchedAt={modal.fetchedAt}
              city={event?.brief.city ?? 'Bengaluru'}
              busy={busy}
              onSave={async (item) =>
                closeOn(mutate('/api/catalogue', { item }), 'Option added to your library.')
              }
            />
          )}
          {modal.kind === 'check' && (
            <CheckEditor
              check={modal.check}
              busy={busy}
              save={async (check) => closeOn(action('check', { checkId: modal.check.id, check }))}
            />
          )}
          {modal.kind === 'quote' && event?.selected && (
            <QuoteEditor
              busy={busy}
              cost={
                event.selected.blocks.find((b) => b.id === modal.blockId)?.quotedCost ??
                event.selected.blocks.find((b) => b.id === modal.blockId)?.cost ??
                0
              }
              save={async (cost) =>
                closeOn(
                  action('quote', { blockId: modal.blockId, cost }),
                  'Quote recorded. Budget updated.',
                )
              }
            />
          )}
          {modal.kind === 'complete' && event && (
            <CompleteForm
              event={event}
              busy={busy}
              save={async (actualSpend, reflection) => {
                if (await action('complete', { actualSpend, reflection })) {
                  setModal(null);
                  setTab('feedback');
                  setMessage('Event completed. The lessons stay with you.');
                }
              }}
            />
          )}
          {modal.kind === 'feedback' && event && (
            <FeedbackRecorder
              event={event}
              busy={busy}
              save={async (memberId, feedback) =>
                closeOn(action('feedback', { memberId, feedback }), 'Feedback saved for next time.')
              }
            />
          )}
          {modal.kind === 'invite' && event && (
            <InviteLinks event={event} baseUrl={inviteUrl} onCopy={setMessage} />
          )}
          {modal.kind === 'share' && (
            <>
              <p>
                A read-only agenda with timings and the meeting point. Personal preferences, budget
                details and organizer notes stay private.
              </p>
              <CopyLink value={shareUrl} onCopy={setMessage} />
              <a className="text-link" href={shareUrl} target="_blank" rel="noreferrer">
                Open shared agenda
                <ArrowRight size={15} />
              </a>
              <div className="link-rotation">
                <p>
                  Need to revoke old links? Replacing them invalidates both the invitation and the
                  shared agenda links.
                </p>
                <Button
                  variant="plain"
                  disabled={busy}
                  onClick={() =>
                    void action('rotate-links').then((ok) => {
                      if (ok) setMessage('New links created. Previous links no longer work.');
                    })
                  }
                >
                  Replace event links
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Landing({
  create,
  busy,
  error,
}: {
  create: (name: string, demo: boolean) => Promise<void>;
  busy: boolean;
  error: string;
}) {
  const [name, setName] = useState('');
  return (
    <div className="landing">
      <header>
        <Brand />
        <span>For the people behind the work.</span>
      </header>
      <main>
        <section className="landing-copy">
          <span className="landing-pill">
            <span />
            Team outings. Office afternoons. Shared memories.
          </span>
          <h1>
            Make time
            <br />
            for a good
            <br />
            <span>team day.</span>
          </h1>
          <p>
            Bring everyone’s preferences into the picture. Find a plan that fits. Keep the details,
            and the next time, in view.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await create(name.trim(), false);
            }}
          >
            <Field label="What’s your team called?">
              <input
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your team or company"
              />
            </Field>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'Opening workspace…' : 'Start planning'}
              <ArrowRight size={17} />
            </Button>
          </form>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <Button
            variant="plain"
            disabled={busy}
            onClick={() => void create('Fieldwork studio', true)}
          >
            Explore a sample workspace
            <ArrowRight size={16} />
          </Button>
          <p className="landing-note">No API keys needed. Your workspace saves as you go.</p>
        </section>
        <section className="landing-scene" aria-label="Example of an afternoon plan">
          <div className="scene-note">
            <span>Friday, together</span>
            <h2>
              A little
              <br />
              out of office.
            </h2>
            <div className="scene-avatars">
              <span>M</span>
              <span>A</span>
              <span>L</span>
              <span>+3</span>
            </div>
          </div>
          <div className="scene-agenda">
            <span className="scene-title">The shape of the afternoon</span>
            <div>
              <time>14:00</time>
              <span>
                <UsersRound size={19} />
                <strong>A moment to catch up</strong>
                <small>Meet at the office</small>
              </span>
            </div>
            <div className="scene-activity">
              <time>14:15</time>
              <span>
                <Leaf size={19} />
                <strong>Make something together</strong>
                <small>Creative workshop</small>
              </span>
            </div>
            <div className="scene-meal">
              <time>16:00</time>
              <span>
                <Coffee size={19} />
                <strong>Stay for a shared table</strong>
                <small>Food & good conversation</small>
              </span>
            </div>
            <footer>
              <Check size={14} />
              Room for everyone. Breathing room, too.
            </footer>
          </div>
          <span className="scene-caption">
            An illustrative plan. Yours starts with your people.
          </span>
        </section>
      </main>
      <footer>
        <span>Common Hours</span>
        <span>Time well spent, together.</span>
      </footer>
    </div>
  );
}

function PublicPage({ kind, path }: { kind: 'join' | 'share'; path: string }) {
  const [view, setView] = useState<JoinView | null>(null),
    [event, setEvent] = useState<PublicEvent | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [loaded, setLoaded] = useState(false);
  async function load() {
    const data = await api<JoinView | PublicEvent>(path);
    if ('event' in data) {
      setView(data);
      setEvent(data.event);
    } else setEvent(data);
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [path]);
  async function save(data: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(path, data);
      await load();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-shell">
      <header>
        <Brand small />
        <span>{kind === 'share' ? 'The plan for our day' : 'A good day starts with you'}</span>
      </header>
      <main>
        {!loaded && <p>Opening the event…</p>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {event && (
          <>
            <Status status={event.status} />
            <h1>{event.title}</h1>
            {event.goal && <p className="public-goal">{event.goal}</p>}
            <div className="public-meta">
              <span>
                <CalendarDays size={17} />
                {dateLabel(event.date)}
              </span>
              <span>
                <Clock3 size={17} />
                {event.startTime}–{event.endTime}
              </span>
              <span>
                <UsersRound size={17} />
                {event.headcount} people
              </span>
            </div>
            {kind === 'share' ? (
              <>
                <div className="public-location">
                  <span>Meet here</span>
                  <strong>
                    {event.location || 'The organizer will confirm the meeting point.'}
                  </strong>
                  <p>{event.city}</p>
                </div>
                {event.status !== 'ready' && event.status !== 'completed' && (
                  <Notice tone="warm">
                    This agenda is still being arranged.
                    {event.pendingChecks
                      ? ` ${event.pendingChecks} details remain to be confirmed.`
                      : ''}
                  </Notice>
                )}
                {event.sample && (
                  <Notice>
                    These are sample activity concepts. Confirm actual provider details with the
                    organizer.
                  </Notice>
                )}
                <div className="public-agenda">
                  {event.blocks.map((b) => (
                    <article key={b.id}>
                      <time>{timeLabel(b.start)}</time>
                      <div>
                        <span>{b.duration} minutes</span>
                        <h2>{b.name}</h2>
                        <p>{b.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
                {!event.blocks.length && (
                  <Empty title="The plan is taking shape">
                    Check back here once the organizer has chosen an agenda.
                  </Empty>
                )}
                <Button onClick={() => window.print()}>Print agenda</Button>
              </>
            ) : (
              view && (
                <section className="public-form">
                  <h2>
                    {event.status === 'completed'
                      ? 'What should we remember?'
                      : view.member
                        ? 'Your preferences'
                        : 'What makes a good team day for you?'}
                  </h2>
                  <p>
                    {event.status === 'completed'
                      ? 'A quick reflection helps make the next event better.'
                      : 'Share what you enjoy and anything the organizer should take into account. Your individual answers stay private to the organizer.'}
                  </p>
                  {saved && (
                    <Notice tone="success">
                      <CheckCircle />
                      {event.status === 'completed'
                        ? 'Feedback saved. Thank you for helping shape next time.'
                        : 'Your preferences are saved. You can update them here.'}
                    </Notice>
                  )}
                  {event.status === 'completed' ? (
                    view.member ? (
                      <FeedbackForm
                        initial={view.feedback ?? undefined}
                        busy={busy}
                        onSave={async (feedback) => save({ action: 'feedback', feedback })}
                      />
                    ) : (
                      <Notice>
                        To leave feedback, open this link in the browser you used to share your
                        preferences. If the organizer added your preferences for you, send them your
                        feedback directly.
                      </Notice>
                    )
                  ) : (
                    <MemberForm
                      key={view.member?.id ?? 'new'}
                      initial={view.member ?? undefined}
                      participant
                      busy={busy}
                      onSave={async (member) => save({ member })}
                    />
                  )}
                </section>
              )
            )}
          </>
        )}
      </main>
      <footer>Common Hours · Time well spent, together.</footer>
    </div>
  );
}
function CheckCircle() {
  return <Check size={16} aria-hidden="true" />;
}

function InviteLinks({
  event,
  baseUrl,
  onCopy,
}: {
  event: EventRecord;
  baseUrl: string;
  onCopy: (message: string) => void;
}) {
  const [person, setPerson] = useState('');
  const member = event.members.find((m) => m.id === person);
  const url = member?.claimToken
    ? `${baseUrl}?member=${member.id}&claim=${member.claimToken}`
    : baseUrl;
  return (
    <>
      <p>
        {event.status === 'completed'
          ? 'Send a personal link so someone can leave feedback on any device, or share the general link for people using their original browser.'
          : 'Share the general link for new responses. For someone whose preferences you already added or copied, send their personal link to review and update them.'}
      </p>
      <div className="invite-person">
        <Field label="Who is this link for?">
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">General invitation</option>
            {event.members
              .filter((m) => m.claimToken)
              .map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name} — personal link
                </option>
              ))}
          </select>
        </Field>
      </div>
      <CopyLink value={url} onCopy={onCopy} />
      <Notice>
        {member
          ? `This personal link gives access to ${member.name}’s response. Share it only with them.`
          : 'Only the organizer sees all individual preferences and private requirements.'}
      </Notice>
      <a className="text-link" href={url} target="_blank" rel="noreferrer">
        Preview participant page
        <ArrowRight size={15} />
      </a>
    </>
  );
}
