import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import type { Store } from './store';
import {
  briefSchema,
  catalogueSchema,
  feedbackSchema,
  memberSchema,
  tasteSeedsSchema,
  versionSchema,
} from '../shared/validation';
import type { EventRecord, Workspace } from '../shared/model';
import { hash, newEvent, newWorkspace, ownerView, publicView, same, token } from './data';
import { briefFingerprint, makeChecks, planProblems, recost } from './planner';
import { planWithTaste } from './plan-with-taste';
import { comparePlans } from '../shared/revision';
import { tasteProvider, TasteError, type TasteProvider } from './taste';
import { tasteKinds } from '../shared/taste';

class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const params = (request: FastifyRequest) => request.params as Record<string, string>;
const ownerCookie = 'common_hours_owner';
const memberCookie = (eventId: string) => `ch_member_${eventId}`;

export async function buildApp(
  store: Store,
  options: {
    staticRoot?: string;
    origin?: string;
    production?: boolean;
    taste?: TasteProvider;
  } = {},
) {
  const taste = options.taste ?? tasteProvider;
  const tasteRuns = new Set<string>();
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, trustProxy: '127.0.0.1' });
  await app.register(cookie);
  await app.register(rateLimit, { max: 180, timeWindow: '1 minute' });
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api')) reply.header('Cache-Control', 'no-store');
    reply
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Content-Type-Options', 'nosniff')
      .header('X-Frame-Options', 'DENY');
    if (options.production)
      reply.header(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      );
    const origin = request.headers.origin;
    if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const allowed = options.origin ?? `${request.protocol}://${request.headers.host}`;
      if (origin !== allowed) fail(403, 'This request must come from the app itself.');
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof TasteError)
      return reply.code(error.statusCode).send({ error: error.message });
    if (error instanceof ZodError)
      return reply.code(400).send({ error: error.issues.map((i) => i.message).join(' ') });
    const status = (error as HttpError).statusCode ?? 500;
    return reply.code(status).send({
      error:
        status < 500 ? (error as Error).message : 'Something could not be saved. Please try again.',
    });
  });
  const setOwner = (reply: FastifyReply, id: string, secret: string) =>
    reply.setCookie(ownerCookie, `${id}.${secret}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.origin?.startsWith('https://') ?? false,
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    });
  const setMember = (reply: FastifyReply, eventId: string, id: string, secret: string) =>
    reply.setCookie(memberCookie(eventId), `${id}.${secret}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.origin?.startsWith('https://') ?? false,
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    });
  async function owner(request: FastifyRequest) {
    const [id, secret] = (request.cookies[ownerCookie] ?? '').split('.');
    const workspace = id && secret ? await store.get(id) : null;
    if (!workspace || !same(workspace.ownerHash, hash(secret)))
      return fail(401, 'Open your workspace or use your private recovery link.');
    return workspace;
  }
  async function mutate(
    request: FastifyRequest,
    change: (w: Workspace, body: Record<string, unknown>) => void,
  ) {
    const authenticated = await owner(request);
    const body = z.record(z.string(), z.unknown()).parse(request.body);
    const version = versionSchema.parse(body.version);
    const { workspace } = await store.update(authenticated.id, (w) => {
      if (w.version !== version)
        fail(409, 'The workspace changed. It has been refreshed; please try your change again.');
      change(w, body);
    });
    return ownerView(workspace);
  }
  const findEvent = (w: Workspace, id: string) =>
    w.events.find((e) => e.id === id) ?? fail(404, 'Event not found.');
  function invalidate(event: EventRecord) {
    event.options = [];
    event.messages = [];
    if (event.selected) {
      event.status = 'planned';
      event.checks = makeChecks(event, event.selected);
    }
  }
  async function publicAccess(request: FastifyRequest, purpose: 'invite' | 'share') {
    const p = params(request),
      workspace = await store.get(p.workspace);
    const event = workspace?.events.find((e) => e.id === p.event);
    if (
      !workspace ||
      !event ||
      !same(p.token, purpose === 'invite' ? event.inviteToken : event.shareToken)
    )
      return fail(404, 'This link is unavailable. Ask the organizer for a current link.');
    return { workspace, event };
  }
  function participantAccess(request: FastifyRequest, event: EventRecord) {
    const query = request.query as Record<string, unknown>;
    if (query.member !== undefined || query.claim !== undefined) {
      const member = event.members.find(
        (m) =>
          m.id === query.member &&
          typeof query.claim === 'string' &&
          m.claimToken &&
          same(m.claimToken, query.claim),
      );
      return (
        member ??
        fail(404, 'That personal invitation is no longer valid. Ask the organizer for a new link.')
      );
    }
    const [id, secret] = (request.cookies[memberCookie(event.id)] ?? '').split('.');
    return event.members.find(
      (m) => m.id === id && m.secretHash && secret && same(m.secretHash, hash(secret)),
    );
  }

  app.get('/api/health', async () => ({ ok: true, taste: taste.status }));
  app.post(
    '/api/taste/search',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      await owner(request);
      const input = z
        .object({ query: z.string().trim().min(2).max(160), kind: z.enum(tasteKinds) })
        .parse(request.body);
      return { entities: await taste.search(input.query, input.kind) };
    },
  );
  app.post(
    '/api/events/:id/taste',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const workspace = await owner(request);
      const event = findEvent(workspace, params(request).id);
      const input = z
        .object({
          version: versionSchema,
          kind: z.enum(tasteKinds),
          entityIds: z.array(z.string().uuid()).min(1).max(8),
          focus: z.enum(['cafes', 'culture', 'all']).default('cafes'),
        })
        .parse(request.body);
      if (input.version !== workspace.version)
        fail(409, 'The event changed. Refresh it before finding suggestions.');
      if (event.status === 'completed')
        fail(400, 'Start a new event to explore cultural suggestions.');
      // Selected entity IDs and city only; no names, diets, notes or free-text favourites.
      // Discovery is read-only and never changes a saved event plan.
      return taste.discover({ ...input, city: event.brief.city });
    },
  );
  app.post(
    '/api/workspaces',
    { config: { rateLimit: { max: 12, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const input = z
        .object({ name: z.string().trim().min(2).max(80), demo: z.boolean().default(false) })
        .parse(request.body);
      const { workspace, secret } = newWorkspace(input.name, input.demo);
      await store.create(workspace);
      setOwner(reply, workspace.id, secret);
      return reply.code(201).send(ownerView(workspace));
    },
  );
  app.post('/api/session/restore', async (request, reply) => {
    const { key } = z.object({ key: z.string().max(150) }).parse(request.body),
      [id, secret] = key.split('.');
    const workspace = id && secret ? await store.get(id) : null;
    if (!workspace || !same(workspace.ownerHash, hash(secret)))
      return fail(401, 'That recovery link is not valid.');
    setOwner(reply, id, secret);
    return ownerView(workspace);
  });
  app.post('/api/session/logout', async (_request, reply) => {
    reply.clearCookie(ownerCookie, { path: '/' });
    return { ok: true };
  });
  app.get('/api/session/recovery', async (request) => {
    await owner(request);
    return { key: request.cookies[ownerCookie] };
  });
  app.get('/api/workspace', async (request) => ownerView(await owner(request)));
  app.post('/api/catalogue', async (request) =>
    mutate(request, (w, body) => {
      if (w.catalogue.length >= 150)
        fail(400, 'The catalogue is limited to 150 entries in this version.');
      const item = catalogueSchema.parse(body.item);
      w.catalogue.push({ ...item, id: randomUUID(), source: 'custom' });
    }),
  );
  app.post('/api/events', async (request) =>
    mutate(request, (w, body) => {
      if (w.events.length >= 100) fail(400, 'This workspace has reached its event limit.');
      const event = newEvent(briefSchema.parse(body.brief));
      if (typeof body.copyFrom === 'string') {
        const source = findEvent(w, body.copyFrom);
        event.members = source.members.map(({ secretHash: _, ...m }) => ({
          ...m,
          id: randomUUID(),
          claimToken: token(),
        }));
        if (event.members.length > event.brief.headcount)
          fail(400, 'The headcount must include everyone being copied.');
      }
      w.events.unshift(event);
    }),
  );
  app.post('/api/events/:id', async (request) => {
    const body = z.record(z.string(), z.unknown()).parse(request.body);
    if (body.action === 'generate' || body.action === 'replan') {
      const workspace = await owner(request);
      if (versionSchema.parse(body.version) !== workspace.version)
        fail(409, 'The workspace changed. Refresh it before finding plans.');
      const event = structuredClone(findEvent(workspace, params(request).id));
      if (event.status === 'completed') fail(400, 'Start a new event to explore plans.');
      if (body.action === 'replan' && !event.selected) fail(400, 'Choose a plan first.');
      const excluded =
        body.action === 'replan'
          ? z
              .array(z.string())
              .max(100)
              .parse(body.excludedItemIds ?? [])
          : [];
      event.excludedItemIds = [...new Set([...event.excludedItemIds, ...excluded])];
      event.useTaste = z.boolean().parse(body.useTaste ?? event.useTaste ?? false);
      if (tasteRuns.has(workspace.id))
        fail(429, 'A comparison is already running. Wait for it to finish.');
      tasteRuns.add(workspace.id);
      try {
        // No network request under the store lock. The second version check in
        // mutate rejects results if preferences, quotes, locks or the library changed.
        const result = await planWithTaste(event, workspace.catalogue, workspace.events, taste);
        return await mutate(request, (w) => {
          const current = findEvent(w, event.id);
          current.useTaste = event.useTaste;
          current.excludedItemIds = event.excludedItemIds;
          current.options = result.plans;
          current.messages = result.messages;
          if (current.selected?.blocks.some((b) => excluded.includes(b.itemId))) {
            current.status = 'planned';
            current.checks = current.checks.map((c) =>
              excluded.includes(c.itemId) ? { ...c, done: false } : c,
            );
          }
        });
      } finally {
        tasteRuns.delete(workspace.id);
      }
    }
    return mutate(request, (w, body) => {
      const e = findEvent(w, params(request).id);
      const action = z
        .enum([
          'brief',
          'member',
          'remove-member',
          'taste-profile',
          'select',
          'lock',
          'check',
          'quote',
          'ready',
          'complete',
          'feedback',
          'rotate-links',
        ])
        .parse(body.action);
      if (e.status === 'completed' && !['feedback', 'rotate-links'].includes(action))
        fail(400, 'This event is completed. Plan the next one to make new arrangements.');
      switch (action) {
        case 'brief': {
          const brief = briefSchema.parse(body.brief);
          if (brief.headcount < e.members.length)
            fail(400, 'Headcount cannot be less than the people already included.');
          if (
            e.selected &&
            (brief.headcount !== e.brief.headcount || brief.date !== e.brief.date)
          ) {
            e.selected.blocks.forEach((b) => {
              delete b.quotedCost;
            });
            e.selected = recost(e.selected);
          }
          e.brief = brief;
          invalidate(e);
          break;
        }
        case 'member': {
          const input = memberSchema.parse(body.member);
          const existing =
            typeof body.memberId === 'string'
              ? e.members.find((m) => m.id === body.memberId)
              : undefined;
          if (body.memberId && !existing) fail(404, 'Participant not found.');
          if (existing) Object.assign(existing, input);
          else {
            if (e.members.length >= e.brief.headcount)
              fail(400, 'Increase the headcount before adding another participant.');
            e.members.push({ ...input, id: randomUUID(), claimToken: token() });
          }
          invalidate(e);
          break;
        }
        case 'remove-member': {
          const id = z.string().parse(body.memberId);
          e.members = e.members.filter((m) => m.id !== id);
          invalidate(e);
          break;
        }
        case 'taste-profile': {
          const member =
            e.members.find((m) => m.id === body.memberId) ?? fail(404, 'Participant not found.');
          member.tasteSeeds = tasteSeedsSchema.parse(body.seeds);
          invalidate(e);
          break;
        }
        case 'select': {
          const selected =
            e.options.find((p) => p.id === body.planId) ??
            fail(404, 'That plan is no longer available. Generate fresh options.');
          if (selected.fingerprint !== briefFingerprint(e.brief, e.members))
            fail(409, 'Preferences changed. Generate fresh options.');
          const preserved =
            e.selected?.fingerprint === selected.fingerprint
              ? e.checks.filter(
                  (c) =>
                    c.itemId === 'event' ||
                    selected.blocks.some((b) => b.locked && b.itemId === c.itemId),
                )
              : [];
          if (e.selected)
            e.lastRevision = comparePlans(
              e.selected,
              selected,
              preserved.filter((c) => c.done).length,
            );
          e.selected = structuredClone(selected);
          e.checks = makeChecks(e, selected, preserved);
          e.status = 'planned';
          e.options = [];
          e.messages = [];
          break;
        }
        case 'lock': {
          const block =
            e.selected?.blocks.find((b) => b.id === body.blockId) ??
            fail(404, 'Choose an arrangement first.');
          block.locked = z.boolean().parse(body.locked);
          e.options = [];
          break;
        }
        case 'check': {
          if (!e.selected || e.selected.fingerprint !== briefFingerprint(e.brief, e.members))
            fail(409, 'Refresh the plan before confirming arrangements.');
          const check =
            e.checks.find((c) => c.id === body.checkId) ?? fail(404, 'Check not found.');
          const update = z
            .object({
              done: z.boolean(),
              note: z.string().trim().max(600),
              assignee: z.string().trim().max(80),
            })
            .parse(body.check);
          Object.assign(check, update);
          if (!check.done && e.status === 'ready') e.status = 'planned';
          break;
        }
        case 'quote': {
          const block =
            e.selected?.blocks.find((b) => b.id === body.blockId) ??
            fail(404, 'Arrangement not found.');
          block.quotedCost = z.number().int().min(0).max(10000000).parse(body.cost);
          e.selected = recost(e.selected!);
          e.options = [];
          if (e.selected.total > e.brief.budget) e.status = 'planned';
          break;
        }
        case 'ready': {
          const issues = planProblems(e);
          if (issues.length) fail(400, issues.join(' '));
          e.status = 'ready';
          break;
        }
        case 'complete': {
          if (e.status !== 'ready') fail(400, 'Resolve the checks and mark the event ready first.');
          const input = z
            .object({
              actualSpend: z.number().int().min(0).max(10000000),
              reflection: z.string().trim().max(1000),
            })
            .parse(body);
          e.actualSpend = input.actualSpend;
          e.reflection = input.reflection;
          e.status = 'completed';
          e.completedAt = new Date().toISOString();
          break;
        }
        case 'feedback': {
          if (e.status !== 'completed') fail(400, 'Feedback opens after the event is completed.');
          const memberId = z.string().parse(body.memberId);
          if (!e.members.some((m) => m.id === memberId)) fail(404, 'Participant not found.');
          const entry = { ...feedbackSchema.parse(body.feedback), memberId };
          e.feedback = [...e.feedback.filter((f) => f.memberId !== memberId), entry];
          break;
        }
        case 'rotate-links': {
          e.inviteToken = token();
          e.shareToken = token();
          break;
        }
      }
    });
  });

  app.get('/api/share/:workspace/:event/:token', async (request) =>
    publicView((await publicAccess(request, 'share')).event),
  );
  app.get('/api/join/:workspace/:event/:token', async (request) => {
    const { event } = await publicAccess(request, 'invite');
    const member = participantAccess(request, event);
    return {
      event: publicView(event),
      member: member ? (({ secretHash: _, claimToken: __, ...m }) => m)(member) : null,
      feedback: member ? (event.feedback.find((f) => f.memberId === member.id) ?? null) : null,
    };
  });
  app.post(
    '/api/join/:workspace/:event/:token',
    { config: { rateLimit: { max: 40, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const { workspace, event } = await publicAccess(request, 'invite');
      const body = z.record(z.string(), z.unknown()).parse(request.body);
      const newSecret = token();
      const { result } = await store.update(workspace.id, (w) => {
        const current = findEvent(w, event.id);
        if (!same(params(request).token, current.inviteToken))
          fail(404, 'This invitation has been replaced.');
        const member = participantAccess(request, current);
        if (body.action === 'feedback') {
          if (current.status !== 'completed') fail(400, 'Feedback opens after the event.');
          if (!member)
            fail(
              403,
              'Use the same browser you used to share your preferences, or ask the organizer to record your feedback.',
            );
          const feedback = { ...feedbackSchema.parse(body.feedback), memberId: member.id };
          current.feedback = [
            ...current.feedback.filter((f) => f.memberId !== member.id),
            feedback,
          ];
          member.secretHash = hash(newSecret);
          return { id: member.id, secret: newSecret };
        }
        if (current.status === 'completed') fail(400, 'This event has already finished.');
        const input = memberSchema.parse(body.member);
        if (member) Object.assign(member, input);
        else {
          if (current.members.length >= current.brief.headcount)
            fail(
              400,
              'This event has all its responses. Contact the organizer to add another person.',
            );
          const added = {
            ...input,
            id: randomUUID(),
            secretHash: hash(newSecret),
            claimToken: token(),
          };
          current.members.push(added);
          invalidate(current);
          return { id: added.id, secret: newSecret };
        }
        member.secretHash = hash(newSecret);
        invalidate(current);
        return { id: member.id, secret: newSecret };
      });
      setMember(reply, event.id, result.id, result.secret);
      return { ok: true };
    },
  );
  if (options.staticRoot) {
    await app.register(staticFiles, { root: options.staticRoot, wildcard: false });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.code(404).send({ error: 'Not found.' })
        : reply.type('text/html').sendFile('index.html'),
    );
  }
  app.addHook('onClose', async () => {
    await store.close();
  });
  return app;
}
