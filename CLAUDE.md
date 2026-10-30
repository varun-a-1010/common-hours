# Common Hours

An independent workplace event planner. Never change another app from this repo.

- Work on `main`. Ship with `~/code/dev-env/bin/qloo-ship common-hours`; the standard is
  `~/code/qloo-submissions.md`.
- Follow `~/code/AGENTS.md`, especially no unsolicited browser or visual QA.
- `npm run check` runs type checking, meaningful domain/API tests, and a production build.
- Default storage is a private local file store. `DATABASE_URL` supports a dedicated
  Deltabase Postgres tenant. Never connect this app to another app's database.
- Sample activities and their prices are illustrative. Never present them as verified
  venues, bookings, or Qloo results. Hard requirements cannot be outweighed by taste.
- Organizer, participant, and public agenda capabilities have distinct access scopes.
- See `docs/index.md` for scope, architecture, verification and Qloo integration notes.

## Docs

Agent docs live in `docs/` as an OKF-flavored bundle. At session start, check
`docs/inbox/` for open requests. Update affected Reference docs and `docs/log.md`
with implementation changes. Stamp `last_verified` only after checking the code.
