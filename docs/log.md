# Change log

## 2026-10-31

- Trusted the local nginx proxy so rate limits apply per client. Deployed to Motif at
  common-hours.slate-app.online and published the repository under MIT.

## 2026-10-20

- Improved the recurring-event workflow after examining Common Bill, Common Ground
  and Theme Night GM public implementations: persistent per-person references,
  structured Qloo venue links, evidence inside feasible plan options, explicit
  unknowns, and before/after revision summaries with retained-check counts.
- Added bounded per-profile candidate comparisons with cache reuse, strict feasible
  candidate sets, equal person weighting, conservative tie-breaking and version-safe
  persistence. Hard requirements and direct preferences remain authoritative.
- Passed 42 default tests, formatting, strict TypeScript and production build.
  Extended the opt-in live runner to exercise two individual profiles without
  exceeding ten upstream calls. Browser/visual QA remains reserved for Varun.
- Passed the extended live test at `f57a3aa`: nine HTTP 200 calls, two per-person
  comparisons against a shared venue set, cached repeat and no automatic plan
  selection. Evidence: `docs/evidence/qloo-planning-live-2026-10-20.json`.

- Fixed development workspace creation being rejected by the origin check: the
  Vite proxy now preserves the browser-facing Host. Added three real HTTP proxy
  tests for ordinary/sample creation, session reopening and foreign-origin rejection.
- Verified the event-issued Qloo key through bounded live search and coverage probes.
- Implemented server-only Qloo search/insights, organizer-scoped routes, explicit
  favourite selection, source evidence and reviewed venue-library additions.
- Added cache, sanitized errors, timeouts and meaningful privacy/planner-boundary
  tests plus an opt-in live integration runner. The default suite now has 29 tests.
- Kept participant notes private and practical constraints authoritative; no
  bookings, payments, outreach or automatic plan changes were added.
- Passed the bounded live app-route test at `45f826c`: seven HTTP 200 calls, cache
  reuse, real source contributions and changed results for changed favourites.
  Sanitized evidence is retained in `docs/evidence/qloo-live-2026-10-20.json`.

## 2026-10-17

- Implemented the organizer and participant UI, persisted workspaces, scoped links,
  preferences, plans, quotes, locked replanning, confirmations, feedback and history.
- Added meaningful domain/API/storage tests and an isolated PostgreSQL test runner.
- Kept Qloo disconnected with a documented adapter boundary and no invented scores.
- Created an independent repository and recorded the authorized MVP and design direction.
