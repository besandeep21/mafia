# Mafia Webapp

A mobile-first Progressive Web App for playing Mafia with a physical
group, with no human moderator. See the project's `CLAUDE_PROJECT_INSTRUCTIONS.md`,
`ARCHITECTURE.md`, `GAME_RULES.md`, and `DESIGN.md` for the full spec —
this README only covers running and deploying what exists so far.

**Status: Phase 3 — Apps Script backend.** Rooms are now real, persisted
in the host's Google Drive, and sync across *separate physical devices*
— not just tabs of one browser like Phase 2's mock. See `DECISIONS.md`
for the reasoning behind each choice made along the way.

## Project structure

```text
index.html                 App shell (single HTML entry point)
manifest.webmanifest        PWA install metadata
service-worker.js           Caches the static shell for install/offline
icons/                       App icons (192, 512, maskable 512)
apps-script/                 The real backend — deployed separately, see below
  README.md                   Deployment guide specific to this code
  appsscript.json, *.gs        The backend source itself
src/
  styles/
    tokens.css               Design tokens sourced from DESIGN.md
    base.css                 Resets, layout primitives, safe-area handling
    components.css           Buttons, cards, inputs, nav, badges, etc.
  js/
    app.js                   Hash router + service worker registration
    config.js                 API_BASE_URL — the one thing you must set (see below)
    screens/                 One module per screen (landing, create, join, lobby)
    state/
      roomStore.js             Real room state via HTTP + polling
    services/
      apiClient.js              Fetch wrapper (handles the CORS workaround)
      identityService.js        Per-device player identity (localStorage) + session tokens
      shareService.js           Join-link building + Web Share API / clipboard
      qrEncoder.js               Self-contained QR Code encoder (ISO 18004)
      qrRenderer.js              Renders the encoder's output as inline SVG
    utils/
      roomCode.js               Room code validation
```

## Setting up the backend (required before anything works)

Phase 3 needs a real backend — there's no more mock to fall back on.

1. Follow `APPS_SCRIPT_SETUP.md` (project root) and `apps-script/README.md`
   to deploy the Google Apps Script Web App and get a `/exec` URL.
2. Open `src/js/config.js` and replace `API_BASE_URL`'s placeholder with
   that URL.
3. Commit and push.

Until you do this, the app clearly tells you the backend isn't
configured yet (rather than failing with a confusing network error) —
you'll see this message on the Create/Join/Lobby screens.

## Run the frontend locally

No build step, no npm install required for the frontend itself:

```bash
cd mafia-webapp
python3 -m http.server 8080
# then open http://localhost:8080
```

The backend, though, is a separate Google Apps Script project — see
above. You can't run that part locally; it only exists once deployed to
Google's infrastructure.

## What to test in Phase 3

1. **Host on device A, join on device B** (two different phones/laptops,
   or at minimum two different browser profiles/incognito windows — see
   `DECISIONS.md` #13 for why plain tabs of the same browser now behave
   like the *same* player). Device B should appear on device A's lobby
   screen within a few seconds, with no manual refresh.
2. **Ready sync across devices** — toggling ready on one device updates
   the other automatically.
3. **Reconnect** — refresh a device's lobby tab; it should stay the same
   player, not create a duplicate.
4. **Wrong code** — joining with a made-up code shows a real error from
   the backend, not a client-side guess.
5. **QR scan** — scan the lobby's QR with an actual phone camera; it
   should open the join screen with the code pre-filled.
6. Everything from Phase 1 and 2's checklists still applies.

## Deploying to GitHub Pages

Same as before — see `APPS_SCRIPT_SETUP.md` Steps 8–9. `.nojekyll` is
included, though nothing here currently needs it.

## Known limitations (intentional, deferred to later phases)

- No role assignment, night/day phases, or voting — Phase 4+.
- The "Start game" button in the lobby is a visible placeholder — it's
  disabled and explains itself, but doesn't do anything yet.
- Locking is script-level, not per-room (see `DECISIONS.md` #16) — fine
  at this app's expected scale.
- Rooms are soft-deleted (Drive trash) when empty, not archived to a
  `history/` folder yet.
- Dark mode tokens are a reasonable placeholder, not a captured design
  decision (`DESIGN.md` documents no dark-mode tokens).
- The CORS workaround (GET reads / text-plain POST writes) was verified
  with a real headless browser against a local server running the exact
  backend code — but Google's own `/exec` endpoint's specific CORS
  behavior can only be fully confirmed by your own deployment and
  testing (this environment has no internet access to Google's
  infrastructure). See `apps-script/README.md`.
