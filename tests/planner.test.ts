import { describe, expect, it } from 'vitest';
import { defaultBrief, newEvent, newWorkspace } from '../server/data';
import { sampleCatalogue } from '../server/catalogue';
import { briefFingerprint, buildPlans, makeChecks, planProblems } from '../server/planner';
import type { CatalogueItem } from '../shared/model';

describe('planning decisions', () => {
  it('fits the complete event, travel, closing buffer and 10% cost reserve', () => {
    const event = newEvent(defaultBrief());
    const { plans } = buildPlans(event, sampleCatalogue(), []);
    expect(plans).toHaveLength(3);
    for (const p of plans) {
      expect(p.total).toBe(p.subtotal + Math.ceil(p.subtotal * 0.1));
      expect(p.total).toBeLessThanOrEqual(event.brief.budget);
      expect(p.blocks[1].start).toBeGreaterThanOrEqual(
        p.blocks[0].start + p.blocks[0].duration + event.brief.travelMinutes,
      );
      expect(p.blocks.at(-1)!.start + p.blocks.at(-1)!.duration + 10).toBeLessThanOrEqual(18 * 60);
    }
  });
  it('never lets preference scores override dietary or mobility requirements and exclusions', () => {
    const event = newEvent({ ...defaultBrief(), budget: 50000 });
    event.members = [
      {
        id: 'a',
        name: 'A',
        likes: ['movement'],
        avoids: ['games'],
        diets: ['vegan'],
        stepFree: true,
        notes: '',
        favourites: '',
      },
    ];
    const { plans } = buildPlans(event, sampleCatalogue(), []);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      expect(p.blocks.map((b) => b.itemId)).not.toContain('climbing');
      expect(['escape', 'bowling', 'board-games']).not.toContain(p.blocks[0].itemId);
      expect(['meal-cafe', 'meal-buffet']).toContain(p.blocks[1].itemId);
      expect(p.cautions).toContain('Step-free access needs confirmation.');
    }
  });
  it('returns no invented options for a missing city or impossible budget', () => {
    expect(
      buildPlans(newEvent({ ...defaultBrief(), city: 'Unlisted city' }), sampleCatalogue(), [])
        .plans,
    ).toHaveLength(0);
    expect(
      buildPlans(newEvent({ ...defaultBrief(), budget: 100 }), sampleCatalogue(), []).plans,
    ).toHaveLength(0);
  });
  it('keeps a locked meal, its time and confirmed quote when replacing an activity', () => {
    const event = newEvent(defaultBrief());
    event.selected = buildPlans(event, sampleCatalogue(), []).plans[0];
    const meal = event.selected.blocks[1];
    meal.locked = true;
    meal.quotedCost = 3000;
    event.excludedItemIds = [event.selected.blocks[0].itemId];
    const { plans } = buildPlans(event, sampleCatalogue(), [], true);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      expect(p.blocks[1]).toMatchObject({
        id: meal.id,
        itemId: meal.itemId,
        start: meal.start,
        quotedCost: 3000,
        locked: true,
      });
      expect(p.blocks[0].itemId).not.toBe(event.excludedItemIds[0]);
    }
  });
  it('reports conflicts when a locked arrangement is itself unavailable', () => {
    const event = newEvent(defaultBrief());
    event.selected = buildPlans(event, sampleCatalogue(), []).plans[0];
    event.selected.blocks[0].locked = true;
    event.excludedItemIds = [event.selected.blocks[0].itemId];
    const r = buildPlans(event, sampleCatalogue(), [], true);
    expect(r.plans).toEqual([]);
    expect(r.messages.join()).toContain('locked');
  });
  it('uses actual history and feedback to prefer a fresh otherwise-equivalent activity', () => {
    const a = sampleCatalogue()[0];
    const b: CatalogueItem = { ...a, id: 'b', name: 'Alternative' };
    const event = newEvent({ ...defaultBrief(), includeMeal: false });
    const previous = newEvent(event.brief);
    previous.status = 'completed';
    previous.completedAt = new Date().toISOString();
    previous.selected = buildPlans(previous, [a], []).plans[0];
    previous.feedback = [{ memberId: 'old', rating: 2, repeat: false, note: 'Something else' }];
    expect(buildPlans(event, [a, b], [previous]).plans[0].blocks[0].itemId).toBe('b');
  });
  it('does not count unanswered preferences as satisfied or allow them to be marked ready', () => {
    const event = newEvent(defaultBrief());
    event.selected = buildPlans(event, sampleCatalogue(), []).plans[0];
    event.checks = makeChecks(event, event.selected).map((c) => ({ ...c, done: true }));
    expect(event.selected.knownPeople).toBe(0);
    expect(planProblems(event).join()).toContain('everyone');
    expect(event.selected.cautions.join()).toContain('8 people');
  });
  it('makes earlier plans stale when preferences change', () => {
    const { workspace } = newWorkspace('Demo', true);
    const event = workspace.events[0];
    event.selected = event.options[0];
    event.checks = makeChecks(event, event.selected).map((c) => ({ ...c, done: true }));
    expect(planProblems(event)).toEqual([]);
    event.members[0].avoids.push('creative');
    expect(event.selected.fingerprint).not.toBe(briefFingerprint(event.brief, event.members));
    expect(planProblems(event).join()).toContain('changed');
  });
});
