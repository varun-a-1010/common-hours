import { useState, type FormEvent, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import {
  diets,
  interests,
  type Brief,
  type CatalogueItem,
  type Diet,
  type Feedback,
  type Interest,
  type Member,
} from '../shared/model';
import { Button, Notice } from './components';
import type { TasteEntity } from '../shared/taste';

export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function freshBrief(): Brief {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return {
    title: '',
    goal: '',
    date: next.toISOString().slice(0, 10),
    startTime: '14:00',
    endTime: '18:00',
    city: 'Bengaluru',
    location: '',
    headcount: 8,
    budget: 14000,
    format: 'outing',
    includeMeal: true,
    travelMinutes: 20,
  };
}
export function BriefForm({
  initial,
  busy,
  onSave,
  canCopy = false,
}: {
  initial: Brief;
  busy: boolean;
  onSave: (b: Brief, copy: boolean) => Promise<void>;
  canCopy?: boolean;
}) {
  const [b, setB] = useState(initial),
    [copy, setCopy] = useState(canCopy);
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) =>
    setB((current) => ({ ...current, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSave(b, copy);
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="form-grid">
        <Field label="Give this event a name" wide>
          <input
            required
            autoFocus
            maxLength={100}
            value={b.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="An afternoon out of office"
          />
        </Field>
        <Field label="What’s the occasion?" wide>
          <textarea
            maxLength={500}
            value={b.goal}
            onChange={(e) => set('goal', e.target.value)}
            placeholder="Welcome our new teammates and spend some time together."
            rows={2}
          />
        </Field>
        <Field label="Event format">
          <select
            value={b.format}
            onChange={(e) => set('format', e.target.value as Brief['format'])}
          >
            <option value="outing">A local outing</option>
            <option value="office">Inside the office</option>
            <option value="either">Open to either</option>
          </select>
        </Field>
        <Field label="Date">
          <input
            required
            type="date"
            value={b.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>
        <Field label="Start time">
          <input
            required
            type="time"
            value={b.startTime}
            onChange={(e) => set('startTime', e.target.value)}
          />
        </Field>
        <Field label="End time">
          <input
            required
            type="time"
            value={b.endTime}
            onChange={(e) => set('endTime', e.target.value)}
          />
        </Field>
        <Field label="Number of people">
          <input
            required
            type="number"
            min={1}
            max={60}
            value={b.headcount}
            onChange={(e) => set('headcount', Number(e.target.value))}
          />
        </Field>
        <Field label="Total budget (₹)" hint="Plans include a 10% reserve.">
          <input
            required
            type="number"
            min={100}
            max={10000000}
            step={1}
            value={b.budget}
            onChange={(e) => set('budget', Number(e.target.value))}
          />
        </Field>
        <Field label="City">
          <input
            required
            maxLength={100}
            value={b.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </Field>
        <Field label="Meeting point">
          <input
            maxLength={200}
            value={b.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Office lobby"
          />
        </Field>
        <Field
          label="Travel buffer between stops (minutes)"
          hint="Used for outings. Enter a realistic allowance."
        >
          <input
            required
            type="number"
            min={0}
            max={90}
            value={b.travelMinutes}
            onChange={(e) => set('travelMinutes', Number(e.target.value))}
          />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={b.includeMeal}
            onChange={(e) => set('includeMeal', e.target.checked)}
          />
          Include food in the plan
        </label>
        {canCopy && (
          <label className="check-label wide">
            <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
            Start with the previous event’s participant preferences
          </label>
        )}
        <div className="form-actions wide">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save event brief'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
const blankMember = {
  name: '',
  likes: [] as Interest[],
  avoids: [] as Interest[],
  diets: [] as Diet[],
  stepFree: false,
  notes: '',
  favourites: '',
};
export type MemberInput = Omit<Member, 'id' | 'secretHash' | 'claimToken'>;
export function MemberForm({
  initial,
  busy,
  onSave,
  participant = false,
}: {
  initial?: MemberInput;
  busy: boolean;
  onSave: (m: MemberInput) => Promise<void>;
  participant?: boolean;
}) {
  const [m, setM] = useState<MemberInput>(initial ?? blankMember);
  const toggle = (key: 'likes' | 'avoids', value: Interest) =>
    setM((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((t) => t !== value)
        : [...current[key], value],
    }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(m);
      }}
    >
      <fieldset disabled={busy} className="form-grid">
        <Field label={participant ? 'Your name' : 'Name'} wide>
          <input
            required
            maxLength={80}
            autoFocus
            value={m.name}
            onChange={(e) => setM({ ...m, name: e.target.value })}
            placeholder="First name is fine"
          />
        </Field>
        <fieldset className="choice-field wide">
          <legend>What sounds like a good time?</legend>
          <p>Pick any that appeal. It’s fine to leave this open.</p>
          <div className="choices">
            {interests.map((i) => (
              <button
                type="button"
                className={`choice ${m.likes.includes(i) ? 'selected' : ''}`}
                aria-pressed={m.likes.includes(i)}
                onClick={() => toggle('likes', i)}
                key={i}
              >
                {m.likes.includes(i) && <Check size={14} />}
                {i}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice-field wide">
          <legend>Anything to avoid?</legend>
          <p>These activities will be excluded from the plan.</p>
          <div className="choices">
            {interests.map((i) => (
              <button
                type="button"
                className={`choice avoid ${m.avoids.includes(i) ? 'selected' : ''}`}
                aria-pressed={m.avoids.includes(i)}
                onClick={() => toggle('avoids', i)}
                key={i}
              >
                {i}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="choice-field wide">
          <legend>Food preferences</legend>
          <div className="choices">
            {diets.map((d) => (
              <button
                type="button"
                className={`choice ${m.diets.includes(d) ? 'selected' : ''}`}
                aria-pressed={m.diets.includes(d)}
                onClick={() =>
                  setM({
                    ...m,
                    diets: m.diets.includes(d) ? m.diets.filter((x) => x !== d) : [...m.diets, d],
                  })
                }
                key={d}
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="check-label wide">
          <input
            type="checkbox"
            checked={m.stepFree}
            onChange={(e) => setM({ ...m, stepFree: e.target.checked })}
          />
          I need step-free access
        </label>
        <Field
          label="Anything else the organizer should know?"
          hint="For example, an allergy, a seating need or an activity you can’t participate in. This is private to the organizer."
          wide
        >
          <textarea
            rows={3}
            maxLength={600}
            value={m.notes}
            onChange={(e) => setM({ ...m, notes: e.target.value })}
          />
        </Field>
        <details className="optional-field wide">
          <summary>Share a few cultural favourites (optional)</summary>
          <p>
            Films, artists, books or places you enjoy. The organizer can select individual
            favourites to explore Qloo suggestions. These notes are not sent automatically.
          </p>
          <textarea
            aria-label="Cultural favourites"
            maxLength={400}
            rows={2}
            value={m.favourites}
            onChange={(e) => setM({ ...m, favourites: e.target.value })}
          />
        </details>
        <div className="form-actions wide">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : participant ? 'Share my preferences' : 'Save preferences'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

type ItemInput = Omit<CatalogueItem, 'id' | 'source'>;
export function CatalogueForm({
  busy,
  city,
  onSave,
  suggestion,
  fetchedAt,
}: {
  busy: boolean;
  city: string;
  onSave: (item: ItemInput) => Promise<void>;
  suggestion?: TasteEntity;
  fetchedAt?: string;
}) {
  const [provided, setProvided] = useState({
    duration: !suggestion,
    maxPeople: !suggestion,
    perPerson: !suggestion,
  });
  const [item, setItem] = useState<ItemInput>({
    name: suggestion?.name.slice(0, 100) ?? '',
    description: suggestion?.description.slice(0, 500) ?? '',
    kind: 'activity',
    format: 'outing',
    city,
    tags: suggestion ? [] : ['creative'],
    duration: 90,
    minPeople: 1,
    maxPeople: 20,
    perPerson: 0,
    fixedCost: 0,
    stepFree: 'unknown',
    diets: [],
    indoor: true,
    sourceUrl: suggestion?.website ?? '',
    details: suggestion
      ? `Discovered through Qloo on ${fetchedAt ?? 'this session'}. Entity: ${suggestion.entityId}. Address reported by Qloo: ${suggestion.address}. Group arrangements require confirmation.`.slice(
          0,
          1000,
        )
      : '',
  });
  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => {
    if (key in provided) setProvided((p) => ({ ...p, [key]: true }));
    setItem((i) => ({ ...i, [key]: value }));
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(item);
      }}
    >
      <fieldset disabled={busy} className="form-grid">
        {suggestion && (
          <div className="wide">
            <Notice tone="warm">
              Qloo supplied the name and venue information. Enter your own duration, group capacity
              and cost estimate; confirm practical requirements with the venue before making
              arrangements.
            </Notice>
          </div>
        )}
        <Field label="Activity or venue name" wide>
          <input
            required
            maxLength={100}
            value={item.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Type">
          <select
            value={item.kind}
            onChange={(e) => {
              set('kind', e.target.value as ItemInput['kind']);
              if (e.target.value === 'meal') set('tags', ['food', 'conversation']);
            }}
          >
            <option value="activity">Activity</option>
            <option value="meal">Food / meal</option>
          </select>
        </Field>
        <Field label="Where it happens">
          <select
            value={item.format}
            onChange={(e) => set('format', e.target.value as ItemInput['format'])}
          >
            <option value="outing">Outside the office</option>
            <option value="office">Inside the office</option>
            <option value="either">Either</option>
          </select>
        </Field>
        <Field label="City">
          <input required value={item.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="Duration (minutes)">
          <input
            required
            type="number"
            min={15}
            max={480}
            value={provided.duration ? item.duration : ''}
            onChange={(e) => set('duration', Number(e.target.value))}
          />
        </Field>
        <Field label="Description" wide>
          <textarea
            rows={2}
            maxLength={500}
            value={item.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <fieldset className="choice-field wide">
          <legend>Interests represented</legend>
          <div className="choices">
            {interests.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={item.tags.includes(t)}
                className={`choice ${item.tags.includes(t) ? 'selected' : ''}`}
                onClick={() =>
                  set(
                    'tags',
                    item.tags.includes(t) ? item.tags.filter((x) => x !== t) : [...item.tags, t],
                  )
                }
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Minimum group">
          <input
            required
            type="number"
            min={1}
            max={60}
            value={item.minPeople}
            onChange={(e) => set('minPeople', Number(e.target.value))}
          />
        </Field>
        <Field label="Maximum group">
          <input
            required
            type="number"
            min={1}
            max={500}
            value={provided.maxPeople ? item.maxPeople : ''}
            onChange={(e) => set('maxPeople', Number(e.target.value))}
          />
        </Field>
        <Field label="Cost per person (₹)">
          <input
            required
            type="number"
            min={0}
            max={1000000}
            value={provided.perPerson ? item.perPerson : ''}
            onChange={(e) => set('perPerson', Number(e.target.value))}
          />
        </Field>
        <Field label="Additional fixed cost (₹)">
          <input
            required
            type="number"
            min={0}
            max={10000000}
            value={item.fixedCost}
            onChange={(e) => set('fixedCost', Number(e.target.value))}
          />
        </Field>
        <Field label="Step-free access">
          <select
            value={item.stepFree}
            onChange={(e) => set('stepFree', e.target.value as ItemInput['stepFree'])}
          >
            <option value="unknown">Needs checking</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={item.indoor}
            onChange={(e) => set('indoor', e.target.checked)}
          />
          Activity is indoors
        </label>
        {item.kind === 'meal' && (
          <fieldset className="choice-field wide">
            <legend>Dietary options the provider supports</legend>
            <div className="choices">
              {diets.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={item.diets.includes(d)}
                  className={`choice ${item.diets.includes(d) ? 'selected' : ''}`}
                  onClick={() =>
                    set(
                      'diets',
                      item.diets.includes(d)
                        ? item.diets.filter((x) => x !== d)
                        : [...item.diets, d],
                    )
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <Field label="Provider or source link" wide>
          <input
            type="url"
            maxLength={1000}
            value={item.sourceUrl}
            onChange={(e) => set('sourceUrl', e.target.value)}
            placeholder="https://"
          />
        </Field>
        <Field
          label="Source notes"
          hint="Where did this information come from, and when was it checked?"
          wide
        >
          <textarea
            rows={2}
            maxLength={1000}
            value={item.details}
            onChange={(e) => set('details', e.target.value)}
          />
        </Field>
        <div className="form-actions wide">
          <Button variant="primary" type="submit" disabled={busy}>
            <Plus size={16} />
            {busy ? 'Adding…' : 'Add to library'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function FeedbackForm({
  initial,
  busy,
  onSave,
}: {
  initial?: Omit<Feedback, 'memberId'>;
  busy: boolean;
  onSave: (f: Omit<Feedback, 'memberId'>) => Promise<void>;
}) {
  const [f, setF] = useState(initial ?? { rating: 4, repeat: true, note: '' });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(f);
      }}
    >
      <fieldset disabled={busy} className="form-grid">
        <fieldset className="choice-field wide">
          <legend>How was the event?</legend>
          <div className="rating-options">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`choice ${f.rating === n ? 'selected' : ''}`}
                type="button"
                aria-label={`${n} out of 5`}
                aria-pressed={f.rating === n}
                onClick={() => setF({ ...f, rating: n })}
              >
                {n}
              </button>
            ))}
          </div>
          <p>1 = not for me · 5 = loved it</p>
        </fieldset>
        <label className="check-label wide">
          <input
            type="checkbox"
            checked={f.repeat}
            onChange={(e) => setF({ ...f, repeat: e.target.checked })}
          />
          I’d enjoy doing this activity again
        </label>
        <Field label="What should we remember for next time?" wide>
          <textarea
            rows={3}
            maxLength={600}
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
        </Field>
        <div className="form-actions wide">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save feedback'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
