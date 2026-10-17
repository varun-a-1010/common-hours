---
type: Reference
title: Verification
description: Code-level evidence for the complete MVP and the boundaries still pending.
timestamp: 2026-10-17
last_verified: 2026-10-17
---

# Verification

Verified locally on Node 24.15.0 on 2026-10-17:

- Strict TypeScript, including unused imports and parameters, passes.
- 18 default Vitest tests pass. The default run explicitly skips two Postgres
  tests; `npm run test:postgres` runs those separately and both passed against a
  fresh, private Unix-socket-only PostgreSQL instance. That instance was removed.
- The Vite production build succeeds. JavaScript is about 291 kB / 88 kB gzip;
  styles and all fonts are served locally.
- Source formatting and `git diff --check` are checked before delivery.
- Dependency installation reports zero known audit vulnerabilities.

Coverage includes budget reserves, schedule and travel buffers, hard dietary and
access constraints, exclusions, recent-event feedback, locked meal identity/time
and quote preservation, impossible plans, missing participant responses, stale
plans, changes invalidating prices/checks, organizer version conflicts, public
projection privacy, scoped personal invitations, link revocation, cross-origin
mutation rejection, secure production cookies, static/deep-link routes, restart
recovery, transaction rollback, and concurrent persistent updates. API tests use
Fastify injection and do not open a browser or start a UI server.

## Deliberate boundaries

- Browser/visual QA was not performed, per the fleet instructions. Varun reviews
  the interface. No screenshot, headless-browser test or UI rendering was used.
- Qloo is disconnected. Cultural favourites are collected but do not affect
  recommendations. Live entity coverage and added value remain untested.
- Starter activities, people and history in the sample workspace are illustrative.
  Provider facts, actual prices, accessibility and availability require confirmation.
- The Deltabase-compatible adapter was verified with real isolated PostgreSQL, not
  a live Deltabase tenant. Default runtime uses a single-process local file store.
- No remote repository, external deployment, booking, payment, or message sending
  was performed. Participant/share URLs are local until hosted at a reachable URL.
- Workspace access uses private capability links, not enterprise SSO. Process-local
  rate limiting and file mode should be revisited before scaling across instances.

## Manual review path

1. `npm run dev` and open http://127.0.0.1:5192.
2. Explore the sample workspace; compare and select an event plan.
3. Record and lock the meal, then replace the activity. The meal and its completed
   checks stay in place. Change headcount and confirm old quotes/checks are reset.
4. Inspect the agenda share link; it has no names, dietary notes or budget.
5. Open a personal participant link, update preferences, and refresh the organizer.
   The chosen plan is flagged for revision rather than silently staying ready.
6. Confirm the logistics, mark ready, complete the event and collect feedback.
   Plan the next event from history. Save the private workspace recovery link.
