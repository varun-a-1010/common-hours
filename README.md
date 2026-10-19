# Common Hours

A workplace event planner for thoughtful outings and activities inside the office.
Works without API keys: explicit preferences, sample/custom activities, event plans,
locked-arrangement replanning, logistics, share links, feedback and event history.

## Local development

Requires Node 22.12+ (built with Node 24).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5192. The API runs on 3192. Records persist in the ignored
`.data/` directory. Use the same hostname consistently to retain your session.
The API reads an optional `.env` file; no environment values are required locally.
Choose a new workspace or a clearly labeled sample workspace. Save the private
workspace recovery link from Settings to reopen it in another browser.

The invitation dialog provides a general response link and individual links for
participants added manually or copied from a previous event. Share a personal link
only with that person. Participant links work on other devices when the app is
hosted at an address those devices can reach; loopback URLs are local to your Mac.

```sh
npm run check
npm run build
npm start
```

`npm run test:postgres` also verifies the optional database adapter using a newly
created local Postgres instance reachable only over its private Unix socket. It
requires `initdb` and `pg_ctl`, and cleans up after itself. It never uses an existing
app database. `npm run format:check` checks source formatting.

Production serves both UI and API on port 3192. Set APP_ORIGIN to your canonical
HTTPS origin behind a reverse proxy. Local file storage requires one Node process
and a persistent volume. For a dedicated Deltabase tenant, set DATABASE_URL;
the app creates only its own `common_hours_workspaces` table. Never reuse another
app's database or credentials. No remote repository or deployment is configured.
The Postgres adapter has been tested against isolated PostgreSQL; a live Deltabase
tenant has not been provisioned or connected in this task.

All starter activities and prices are illustrative. Add your own venue options
and quotes, then verify each arrangement.

## Qloo discovery

Supply `QLOO_API_KEY` to the server process to enable the **Cultural discovery** tab.
It searches real favourites and returns places in the event city, or artists,
films and books for office activities. Select matches explicitly, review the
source evidence, then optionally add a place to the activity library with your
own cost, duration and capacity. Saved plans and logistics remain authoritative.
The key stays on the server; never use a `VITE_` variable for it. The event API
origin is fixed to `https://hackathon.api.qloo.com`.

With the key present, `npm run test:qloo` runs an isolated live integration check
with at most ten API requests, prints sanitized evidence and removes its test data.
Normal tests do not call Qloo. [Integration details and boundaries](docs/qloo.md).

See [docs/index.md](docs/index.md) for scope, access controls and verification.
