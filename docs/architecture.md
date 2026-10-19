---
type: Reference
title: Architecture
description: Independent React and Fastify app with a deterministic planner and scoped share links.
timestamp: 2026-10-20
last_verified: 2026-10-20
---

# Architecture

React + Vite serves the client. Fastify serves JSON APIs and the production client.
In development, Vite proxies `/api` from port 5192 to 3192 while preserving the
browser-facing Host (`changeOrigin: false`). This lets the API compare the browser's
Origin against its original host without trusting forwarded headers or relaxing
the cross-origin mutation check.
`shared/` owns domain types and Zod input validation. The planner in
`server/planner.ts` filters hard constraints before ranking explicitly stated
interests, penalizes recent repeats and negative repeat feedback, schedules an
activity and optional meal with arrival/closing/travel buffers, and includes a
10% reserve in its budget checks. Locks preserve an arrangement and its time.
Changing headcount/date invalidates quotes; changing requirements invalidates
logistics confirmations. New options do not replace the chosen plan until selected.

Default storage is an atomic private file per workspace in `.data/`; updates are
serialized within one server process. Run ONE process on a persistent filesystem
in this mode. Files and directory are mode 600/700. Atomic rename and flushed
writes protect against torn documents. A dedicated Deltabase Postgres URL enables
`PostgresStore`, whose JSONB row is locked transactionally during mutations.
Postgres creation is limited to the app-specific `common_hours_workspaces` table.
Do not set DATABASE_URL to an existing unrelated database.

Organizer access uses a random 192-bit capability in an HTTP-only SameSite cookie;
only its SHA-256 digest is stored. A private recovery link carries this capability
in the URL fragment, exchanged for a cookie and immediately removed from the URL.
Organizer mutations require a matching workspace version to prevent lost edits.
This is a small-team MVP authentication model, not organization SSO.

Event invitations and read-only agenda links have separate random capabilities.
Participants get an HTTP-only member cookie and may access only their own response.
Organizer-supplied personal invitations let existing/manual/copied participants
review their own response on another device; these capabilities never expose
another participant. Invitation rotation also revokes these old personal URLs.
Public projections omit names, notes, diets, budgets, all tokens and internal data.
Responses are non-cacheable; referrers are suppressed; mutating origins are checked;
inputs are bounded and validated. Rate limiting is process-local. Set APP_ORIGIN
to the exact HTTPS origin in deployment so cookies are Secure and origin checks
work behind a reverse proxy. No externally fetched URLs or automatic outreach.
Production responses use a restrictive same-origin content security policy. Fonts
are bundled locally. The API loads optional `.env` values at process startup.

Optional Qloo discovery is server-only and organizer-scoped. Explicit searches
resolve favourites before insights are requested; the event city comes from the
authenticated workspace, not arbitrary client fields. Discovery is read-only;
selected places become normal custom catalogue entries only after organizer review.
The key never reaches the client and the HTTP origin is fixed. See [Qloo](qloo.md).

The sample catalogue is illustrative; capacity/price/diet/access checks must be
confirmed before ready. Feedback opens only on completed events. Completed events
are immutable except feedback and link rotation. A new event can copy preferences.
