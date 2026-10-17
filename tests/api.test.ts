import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app';
import { FileStore } from '../server/store';
import { defaultBrief } from '../server/data';

let directory: string, app: FastifyInstance, ownerCookie = '', workspace: any;
const cookieHeader = (response: any) => response.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
async function create(demo = false) {
  const res = await app.inject({ method: 'POST', url: '/api/workspaces', payload: { name: 'Our team', demo } });
  expect(res.statusCode).toBe(201); ownerCookie = cookieHeader(res); workspace = res.json();
}
async function mutate(url: string, payload: any) {
  const res = await app.inject({ method: 'POST', url, headers: { cookie: ownerCookie }, payload: { version: workspace.version, ...payload } });
  if (res.statusCode === 200) workspace = res.json(); return res;
}
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'common-hours-test-')); app = await buildApp(new FileStore(directory)); });
afterEach(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });

describe('access and participant privacy', () => {
  it('does not reveal organizer data or member requirements through a shared agenda', async () => {
    await create(true); const event = workspace.events[0];
    expect(workspace.ownerHash).toBeUndefined();
    expect((await app.inject({ url: '/api/workspace' })).statusCode).toBe(401);
    await mutate(`/api/events/${event.id}`, { action: 'select', planId: event.options[0].id });
    const res = await app.inject({ url: `/api/share/${workspace.id}/${event.id}/${event.shareToken}` });
    expect(res.statusCode).toBe(200);
    const body = res.json(); expect(body.blocks.length).toBe(2);
    expect(body.members).toBeUndefined(); expect(body.budget).toBeUndefined();
    expect(res.body).not.toContain('Leah'); expect(res.body).not.toContain('secretHash'); expect(res.body).not.toContain(event.inviteToken);
    expect((await app.inject({ url: `/api/share/${workspace.id}/${event.id}/${event.inviteToken}` })).statusCode).toBe(404);
  });
  it('accepts a participant response and only permits that browser to edit it', async () => {
    await create(); await mutate('/api/events', { brief: { ...defaultBrief(), headcount: 2 } });
    const e = workspace.events[0], url = `/api/join/${workspace.id}/${e.id}/${e.inviteToken}`;
    const member = { name: 'Guest', likes: ['creative'], avoids: [], diets: ['vegan'], stepFree: true, notes: 'Private note', favourites: 'Spirited Away' };
    const first = await app.inject({ method: 'POST', url, payload: { member } }); expect(first.statusCode).toBe(200);
    const guestCookie = cookieHeader(first);
    const anonymous = (await app.inject({ url })).json(); expect(anonymous.member).toBeNull(); expect(JSON.stringify(anonymous)).not.toContain('Private note');
    const own = (await app.inject({ url, headers: { cookie: guestCookie } })).json(); expect(own.member.notes).toBe('Private note'); expect(own.member.secretHash).toBeUndefined();
    await app.inject({ method: 'POST', url, headers: { cookie: guestCookie }, payload: { member: { ...member, name: 'Updated' } } });
    const saved = (await app.inject({ url: '/api/workspace', headers: { cookie: ownerCookie } })).json();
    expect(saved.events[0].members).toHaveLength(1); expect(saved.events[0].members[0].name).toBe('Updated');
  });
  it('rejects cross-origin mutations and stale organizer edits', async () => {
    await create();
    const bad = await app.inject({ method: 'POST', url: '/api/events', headers: { cookie: ownerCookie, origin: 'https://other.example' }, payload: { version: workspace.version, brief: defaultBrief() } });
    expect(bad.statusCode).toBe(403);
    const old = workspace.version; await mutate('/api/events', { brief: defaultBrief() });
    const stale = await app.inject({ method: 'POST', url: '/api/events', headers: { cookie: ownerCookie }, payload: { version: old, brief: defaultBrief() } });
    expect(stale.statusCode).toBe(409);
  });
  it('lets an existing participant review a personal invitation without exposing other responses', async () => {
    await create(true); const e = workspace.events[0], member = e.members[0];
    const base = `/api/join/${workspace.id}/${e.id}/${e.inviteToken}`;
    const url = `${base}?member=${member.id}&claim=${member.claimToken}`;
    const personal = await app.inject({ url });
    expect(personal.statusCode).toBe(200); expect(personal.json().member.name).toBe(member.name);
    expect(personal.json().member.claimToken).toBeUndefined();
    expect(personal.body).not.toContain(e.members[2].notes);
    const update = await app.inject({ method: 'POST', url, payload: { member: { ...member, notes: 'Please leave time for a break.' } } });
    expect(update.statusCode).toBe(200);
    const own = (await app.inject({ url: base, headers: { cookie: cookieHeader(update) } })).json();
    expect(own.member.notes).toContain('break');
    const bad = await app.inject({ url: `${base}?member=${e.members[1].id}&claim=${member.claimToken}` });
    expect(bad.statusCode).toBe(404);
    workspace = (await app.inject({ url: '/api/workspace', headers: { cookie: ownerCookie } })).json();
    await mutate(`/api/events/${e.id}`, { action: 'rotate-links' });
    expect((await app.inject({ url })).statusCode).toBe(404);
  });
});

describe('complete event lifecycle', () => {
  it('selects, revises with a locked meal, confirms, completes and records feedback', async () => {
    await create(true); const id = workspace.events[0].id; const url = `/api/events/${id}`;
    expect((await mutate(url, { action: 'select', planId: workspace.events[0].options[0].id })).statusCode).toBe(200);
    expect((await mutate(url, { action: 'ready' })).statusCode).toBe(400);
    const meal = workspace.events[0].selected.blocks[1], activity = workspace.events[0].selected.blocks[0];
    const mealCheck = workspace.events[0].checks.find((c: any) => c.itemId === meal.itemId);
    await mutate(url, { action: 'check', checkId: mealCheck.id, check: { done: true, note: 'Lunch is already booked', assignee: 'Organizer' } });
    await mutate(url, { action: 'lock', blockId: meal.id, locked: true });
    await mutate(url, { action: 'replan', excludedItemIds: [activity.itemId] });
    expect(workspace.events[0].options.length).toBeGreaterThan(0);
    await mutate(url, { action: 'select', planId: workspace.events[0].options[0].id });
    expect(workspace.events[0].selected.blocks[1].itemId).toBe(meal.itemId);
    expect(workspace.events[0].checks.find((c: any) => c.id === mealCheck.id).done).toBe(true);
    for (const check of workspace.events[0].checks) {
      await mutate(url, { action: 'check', checkId: check.id, check: { done: true, note: 'Confirmed for this test fixture', assignee: 'Organizer' } });
    }
    expect((await mutate(url, { action: 'ready' })).statusCode).toBe(200);
    expect((await mutate(url, { action: 'complete', actualSpend: 6200, reflection: 'Leave more time for conversation.' })).statusCode).toBe(200);
    const e = workspace.events[0]; expect(e.status).toBe('completed');
    expect((await mutate(url, { action: 'feedback', memberId: e.members[0].id, feedback: { rating: 4, repeat: false, note: 'Try music next.' } })).statusCode).toBe(200);
    expect(workspace.events[0].feedback).toHaveLength(1);
    expect((await mutate(url, { action: 'brief', brief: defaultBrief() })).statusCode).toBe(400);
    await mutate('/api/events', { brief: { ...defaultBrief(), title: 'Next month' }, copyFrom: id });
    expect(workspace.events[0].members).toHaveLength(6); expect(workspace.events[0].selected).toBeNull();
  });
  it('persists across a restart and restores owner access using its private recovery key', async () => {
    await create(true); const id = workspace.id;
    const recovery = (await app.inject({ url: '/api/session/recovery', headers: { cookie: ownerCookie } })).json();
    await app.close(); app = await buildApp(new FileStore(directory));
    const restored = await app.inject({ method: 'POST', url: '/api/session/restore', payload: recovery });
    expect(restored.statusCode).toBe(200); expect(restored.json().id).toBe(id); expect(restored.json().events).toHaveLength(2);
  });
});
