# Change log

## 2026-10-20

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
