---
type: Reference
title: Verification
description: Code-level evidence for the complete MVP and the boundaries still pending.
timestamp: 2026-10-20
last_verified: 2026-10-20
---

# Verification

Verified locally on Node 24.15.0 on 2026-10-20:

- Strict TypeScript, including unused imports and parameters, passes.
- 42 default Vitest tests pass. The default run explicitly skips two Postgres
  tests; `npm run test:postgres` runs those separately and both passed against a
  fresh, private Unix-socket-only PostgreSQL instance on 2026-10-17. That instance
  was removed; the unchanged database adapter was not retested on 2026-10-20.
- The Vite production build succeeds. JavaScript is about 306 kB / 92 kB gzip;
  styles and all fonts are served locally.
- Source formatting and `git diff --check` are checked before delivery.
- The original 2026-10-17 dependency installation reported zero known audit
  vulnerabilities; no dependencies were added for Qloo.

Coverage includes budget reserves, schedule and travel buffers, hard dietary and
access constraints, exclusions, recent-event feedback, locked meal identity/time
and quote preservation, impossible plans, missing participant responses, stale
plans, changes invalidating prices/checks, organizer version conflicts, public
projection privacy, scoped personal invitations, link revocation, cross-origin
mutation rejection, secure production cookies, static/deep-link routes, restart
recovery, transaction rollback, and concurrent persistent updates. Most API tests
use Fastify injection. The development-proxy regression tests additionally send
real HTTP requests through Vite's API proxy to a temporary API/file store on
ephemeral loopback ports. They exercise ordinary and sample workspace creation,
session reopening, and rejection of foreign origins with forged forwarding headers.
Only API routes are requested; no browser is opened or UI rendered.

The proxy tests reproduced HTTP 403 for both workspace creation flows before the
fix. Vite's string proxy shorthand rewrote Host to the API's port, which no longer
matched the browser's Origin. The explicit proxy rule now preserves Host. A plain
GET health check did not detect this failure because origin checks apply to mutations.

Qloo tests additionally cover the fixed credential destination, redirects disabled,
search-domain validation, strict city and category parameters, cache reuse/expiry,
source contribution filtering, absent attribution, empty results, missing keys,
invalid responses, transport/auth/quota failures, organizer and cross-workspace
access, stale requests, outbound privacy, and unchanged saved plans. New planning
tests exercise per-person balanced ranking, direct-interest priority, unknown and
unlinked baseline positions, missing/failed profiles, candidate allowlisting,
zero/tied scores, bounded requests, identical-profile reuse, feasible-plan filtering,
profile persistence and copying, private projections, locked quote/check preservation,
revision receipts, one in-flight comparison and stale-result rejection.

Initial live coverage probes on 2026-10-20 returned HTTP 200 for three reference
searches, Bengaluru and New York place insights, and office music insights. These
establish API access and sample coverage, not better outcomes or venue availability.
The opt-in app-route integration runner is `npm run test:qloo`.

The live integration runner passed at code SHA `45f826c` on 2026-10-20 IST.
[Sanitized evidence](evidence/qloo-live-2026-10-20.json) records seven HTTP 200 calls
(three searches and four insight queries), a cached repeat with no additional
upstream request, real contribution metadata, and unchanged saved plans. Observed
upstream response times were 269–3305 ms. All test data was synthetic and its
temporary store was removed; the credential was supplied only in process memory.

Sample results included Linto Coffee, Cafe Noir and Kinya Coffee; cultural venues
included Chowdiah Memorial Hall and Bangalore International Centre. An office
music query returned Björk, AiR and Massive Attack, among others. Switching from
Daft Punk + Spirited Away to Arijit Singh changed four of the six cafe candidates.
This is input sensitivity, not evidence of improved quality. Some results name
large complexes or hotels, so venue/category suitability and current operation
still require review. No price, capacity, reservation or access claim was verified.

## Deliberate boundaries

- Browser/visual QA was not performed, per the fleet instructions. Varun reviews
  the interface. No screenshot, headless-browser test or UI rendering was used.
- Qloo discovery works when the server has a key. Live coverage is sampled, not
  exhaustive. Individual Qloo evidence can now break ties after direct preferences
  and history; improvement in actual team outcomes has not been established.
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
7. With a server key, open Cultural discovery. Search/select Daft Punk as an artist
   and Spirited Away as a film; discover cafes in the event city, cultural venues,
   or artists. Review the source contributions and matched locality. Review a place
   for the library and supply your own activity details and cost estimate. Confirm
   that discovering suggestions alone does not change a selected plan or checks.

8. Select a person in Cultural discovery, save their confirmed references, and repeat
   for another person. Refresh the page to check persistence. Review two places and
   enter activity duration/capacity/cost; these are your estimates, not Qloo facts.
9. On plan options, enable **Compare linked venues with Qloo**, refresh, and expand
   **Who is represented?**. Check direct-interest matches, missing profiles and venue
   query receipts. An unlinked office template retains ordinary ranking.
10. Choose a plan, lock its meal, confirm meal checks and replace the activity.
    Compare changed/kept blocks, quoted cost and carried-over checks before choosing.
    The selected agenda retains the revision summary.

The extended live runner passed on 2026-10-20 at code SHA `f57a3aa`.
[Planning evidence](evidence/qloo-planning-live-2026-10-20.json) records nine HTTP 200
requests (three searches, four discovery queries, two individual candidate comparisons),
238–3274 ms upstream latency, and cache reuse for both discovery and comparison.
Two synthetic profiles were assessed against the same two real Bengaluru venue IDs;
Linto Coffee ranked first for both in this sampled comparison. The test supplied
explicitly synthetic activity prices/capacities, kept selection manual, and removed
its temporary store. This proves API integration, not better event outcomes or
real-world venue suitability. No browser/visual QA was performed.
