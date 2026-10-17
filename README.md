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
Choose a new workspace or a clearly labeled sample workspace. Save the private
workspace recovery link from Settings to reopen it in another browser.

```sh
npm run check
npm run build
npm start
```

Production serves both UI and API on port 3192. Set APP_ORIGIN to your canonical
HTTPS origin behind a reverse proxy. Local file storage requires one Node process
and a persistent volume. For a dedicated Deltabase tenant, set DATABASE_URL;
the app creates only its own `common_hours_workspaces` table. Never reuse another
app's database or credentials. No remote repository or deployment is configured.

All starter activities and prices are illustrative. Add your own venue options
and quotes, then verify each arrangement. Qloo is not connected and is not claimed
as a working integration. [Integration plan](docs/qloo.md).

See [docs/index.md](docs/index.md) for scope, access controls and verification.
