---
type: Reference
title: Qloo integration boundary
description: Explicit-preference baseline now; live cultural recommendations remain pending API access.
timestamp: 2026-10-17
---

# Qloo integration boundary

No Qloo key, data, score, or simulated live request is used in this release.
`server/taste.ts` defines a narrow provider interface with `not-connected` status.
The functioning planner uses the curated catalogue and direct preferences.
Optional cultural favourites are collected but do NOT currently influence ranking.

When access arrives:
1. Resolve user-supplied cultural favourites through real entity search; confirm
   ambiguous matches and retain unresolved text rather than inventing entity IDs.
2. Test place/category coverage for the chosen city and available account access.
3. Add a server-only adapter that returns actual entity IDs, request/source evidence,
   retrieval timestamps, and separate cultural-affinity suggestions.
4. Join candidates to our catalogue without treating taste as price, capacity,
   availability, safety/accessibility evidence, or a group happiness percentage.
5. Keep direct preferences and hard constraints authoritative. Scores are normalized
   per query; never average raw scores from unrelated person queries as probabilities.
6. Compare useful choices and participant feedback against the direct-preference
   baseline. Do not claim improvement by grading both versions with Qloo scores.

References checked during scoping:
- https://github.com/qloo/docs-public/blob/main/docs/entities.md
- https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md
- https://github.com/qloo/docs-public/blob/main/docs/interpreting-affinity-scores.md

Adding a key alone will not turn on Qloo: adapter implementation and validation are
intentionally still required. The sample catalogue is not a Qloo fixture dataset.
