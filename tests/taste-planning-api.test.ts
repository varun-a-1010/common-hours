import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app';
import { FileStore } from '../server/store';
import { defaultBrief, newEvent } from '../server/data';
import { sampleCatalogue } from '../server/catalogue';
import type { OwnerWorkspace } from '../shared/model';
import type { TasteProvider } from '../server/taste';
import type { TasteComparison } from '../shared/taste';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const seeds = [{ entityId: uuid(20), name: 'Saved favourite', kind: 'artist' }];
let directory: string,
  app: FastifyInstance,
  store: FileStore,
  cookie: string,
  workspace: OwnerWorkspace;
const compare = vi.fn<TasteProvider['compare']>();
const response: TasteComparison = {
  queryId: 'test-only',
  fetchedAt: '2026-10-20T10:00:00Z',
  inputEntityIds: [uuid(20)],
  candidateEntityIds: [uuid(1), uuid(2), uuid(3)],
  results: [1, 2, 3].map((n) => ({
    entityId: uuid(n),
    rank: n,
    contributingEntityIds: [uuid(20)],
  })),
};
const taste: TasteProvider = { status: 'configured', compare, search: vi.fn(), discover: vi.fn() };
async function action(body: Record<string, unknown>) {
  const r = await app.inject({
    method: 'POST',
    url: `/api/events/${workspace.events[0].id}`,
    headers: { cookie },
    payload: { version: workspace.version, ...body },
  });
  if (r.statusCode === 200) workspace = r.json();
  return r;
}
beforeEach(async () => {
  compare.mockReset().mockResolvedValue(response);
  directory = await mkdtemp(join(tmpdir(), 'common-hours-comparison-'));
  store = new FileStore(directory);
  app = await buildApp(store, { taste });
  const created = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    payload: { name: 'Synthetic team' },
  });
  workspace = created.json();
  cookie = created.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  await store.update(workspace.id, (w) => {
    const base = sampleCatalogue()[0];
    w.catalogue = [1, 2, 3, 4].map((n) => ({
      ...base,
      id: String(n),
      name: `Venue ${n}`,
      kind: n === 4 ? 'meal' : 'activity',
      duration: n === 4 ? 30 : 60,
      fixedCost: 0,
      perPerson: n * 100,
      tags: ['creative'],
      qloo: { entityId: uuid(n), name: `Venue ${n}` },
    }));
    const e = newEvent({ ...defaultBrief(), headcount: 2, budget: 20000 });
    e.members = ['Alex', 'Sam'].map((name, i) => ({
      id: String(i),
      name,
      likes: ['creative'],
      avoids: [],
      diets: [],
      notes: 'Private need',
      stepFree: false,
      favourites: 'Raw private favourites',
    }));
    w.events = [e];
  });
  workspace = (await app.inject({ url: '/api/workspace', headers: { cookie } })).json();
});
afterEach(async () => {
  await app.close();
  await store.close();
  await rm(directory, { recursive: true, force: true });
});
describe('saved profiles and versioned comparisons', () => {
  it('persists validated individual references, copies them to the next event, and hides them from public/anonymous links', async () => {
    expect((await action({ action: 'taste-profile', memberId: '0', seeds })).statusCode).toBe(200);
    expect(
      (
        await action({
          action: 'taste-profile',
          memberId: '1',
          seeds: [{ ...seeds[0], entityId: 'bad' }],
        })
      ).statusCode,
    ).toBe(400);
    const event = workspace.events[0];
    await app.close();
    app = await buildApp(store, { taste });
    const loaded = (await app.inject({ url: '/api/workspace', headers: { cookie } })).json();
    expect(loaded.events[0].members[0].tasteSeeds).toEqual(seeds);
    for (const path of ['share', 'join']) {
      const token = path === 'share' ? event.shareToken : event.inviteToken;
      const publicResponse = await app.inject({
        url: `/api/${path}/${workspace.id}/${event.id}/${token}`,
      });
      expect(publicResponse.body).not.toContain('Saved favourite');
      expect(publicResponse.body).not.toContain(uuid(20));
    }
    const copy = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { cookie },
      payload: { version: workspace.version, brief: event.brief, copyFrom: event.id },
    });
    expect(copy.statusCode).toBe(200);
    expect(copy.json().events[0].members[0].tasteSeeds).toEqual(seeds);
    expect(copy.json().events[0].members[0].id).not.toBe(event.members[0].id);
  });
  it('keeps locked bookings and completed checks on replacement, with a durable revision receipt', async () => {
    await action({ action: 'taste-profile', memberId: '0', seeds });
    await action({ action: 'generate', useTaste: true });
    expect(compare).toHaveBeenCalledTimes(1);
    expect(Object.keys(compare.mock.calls[0][0]).sort()).toEqual([
      'candidateEntityIds',
      'city',
      'entityIds',
    ]);
    await action({ action: 'select', planId: workspace.events[0].options[0].id });
    const meal = workspace.events[0].selected!.blocks[1];
    await action({ action: 'quote', blockId: meal.id, cost: 777 });
    await action({ action: 'lock', blockId: meal.id, locked: true });
    for (const check of workspace.events[0].checks.filter((c) => c.itemId === meal.itemId)) {
      await action({
        action: 'check',
        checkId: check.id,
        check: { done: true, note: 'Confirmed', assignee: 'Organizer' },
      });
    }
    const before = structuredClone(workspace.events[0].selected);
    await action({ action: 'replan', excludedItemIds: [before!.blocks[0].itemId] });
    expect(workspace.events[0].selected).toEqual(before);
    expect(compare.mock.lastCall?.[0].candidateEntityIds).not.toContain(uuid(4));
    await action({ action: 'select', planId: workspace.events[0].options[0].id });
    const event = workspace.events[0];
    expect(event.selected!.blocks[1]).toEqual(before!.blocks[1]);
    expect(
      event.checks
        .filter((c) => c.itemId === meal.itemId)
        .every((c) => c.done && c.note === 'Confirmed'),
    ).toBe(true);
    expect(event.lastRevision?.changes.map((c) => c.kept)).toEqual([false, true]);
    expect(event.lastRevision?.keptChecks).toBe(4);
    expect(
      event.checks
        .filter((c) => c.itemId === event.selected!.blocks[0].itemId)
        .every((c) => !c.done),
    ).toBe(true);
    const publicResult = await app.inject({
      url: `/api/share/${workspace.id}/${event.id}/${event.shareToken}`,
    });
    expect(publicResult.body).not.toContain('test-only');
    expect(publicResult.body).not.toContain('Saved favourite');
    expect(publicResult.body).not.toContain('Alex');
  });
  it('does not save results across a concurrent preference change or accept unauthenticated comparison', async () => {
    await action({ action: 'taste-profile', memberId: '0', seeds });
    const url = `/api/events/${workspace.events[0].id}`;
    const payload = { version: workspace.version, action: 'generate', useTaste: true };
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(401);
    expect(compare).not.toHaveBeenCalled();
    let started!: () => void, release!: (value: TasteComparison) => void;
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    compare.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const pending = app
      .inject({ method: 'POST', url, headers: { cookie }, payload })
      .then((r) => r);
    await waiting;
    const simultaneous = await app.inject({ method: 'POST', url, headers: { cookie }, payload });
    expect(simultaneous.statusCode).toBe(429);
    expect((await action({ action: 'taste-profile', memberId: '0', seeds: [] })).statusCode).toBe(
      200,
    );
    release(response);
    expect((await pending).statusCode).toBe(409);
    const after = (await app.inject({ url: '/api/workspace', headers: { cookie } })).json();
    expect(after).toEqual(workspace);
    expect(after.events[0].options).toEqual([]);
  });
});
