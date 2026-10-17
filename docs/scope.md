---
type: Reference
title: Product scope
description: A complete recurring team-event planning loop that works without Qloo.
timestamp: 2026-10-17
last_verified: 2026-10-17
---

# Product scope

Varun authorized implementation on 2026-10-17 while Qloo API access is pending.
Build-time budget was not specified. Optimize for a focused, complete MVP.

One organizer plans a single-day team outing or an event inside the office for
roughly 6–20 people. A local day offsite uses the same event blocks. The cycle is:
brief → preferences → up to three feasible plans → chosen agenda and checks →
targeted replanning → actual spend and participant feedback → next event.

Include owner-created and participant-entered preferences, private dietary and
accessibility notes, a sample activity catalogue with custom entries, cost and
time validation, explicit preference matching, history-aware selection, locked
blocks, confirmation checklist, public read-only agenda, and post-event feedback.
Unanswered preferences are unknown, never counted as satisfied. An infeasible
request returns an explanation, not fabricated options. Every example cost is an
estimate and every example venue requires organizer confirmation.

Exclude payments, automatic booking or outreach, calendar/Slack integration,
overnight travel, organization-wide SSO, and claimed Qloo matching before access.
Support the full flow with saved local data and an optional Deltabase store.

Acceptance: prepare an event, collect preferences, choose a plan, preserve lunch
while replacing an unavailable activity, resolve checks, complete the event,
collect feedback, and use that history in another event. Public responses must
never expose organizer credentials or other participants' private requirements.
