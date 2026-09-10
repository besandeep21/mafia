# Mafia Webapp

A mobile-first Progressive Web App for playing Mafia with a physical
group, with no human moderator. See the project's `CLAUDE_PROJECT_INSTRUCTIONS.md`,
`ARCHITECTURE.md`, `GAME_RULES.md`, and `DESIGN.md` for the full spec —
this README only covers running and deploying what exists so far.

**Status: Phase 1 — Foundation.** Static frontend shell, design system,
Landing/Create/Join screens, and a mock (non-persistent, non-networked)
lobby preview. There is no backend yet — see `DECISIONS.md` for the
assumptions made along the way.

## Project structure

```text
index.html                 App shell (single HTML entry point)
manifest.webmanifest        PWA install metadata
service-worker.js           Caches the static shell for install/offline
icons/                       App icons (192, 512, maskable 512)
src/
  styles/
    tokens.css               Design tokens sourced from DESIGN.md
    base.css                 Resets, layout primitives, safe-area handling
    components.css           Buttons, cards, inputs, nav, badges, etc.
  js/
    app.js                   Hash router + service worker registration
    screens/                 One module per screen (landing, create, join, lobby)
    state/                   In-memory store + mock game state (Phase 1 only)
    services/                localStorage, share/QR-link helpers
    utils/                   Room code generation/validation
```

## Run it locally

No build step, no npm install required. Any static file server works,
for example:

```bash
cd mafia-webapp
python3 -m http.server 8080
# then open http://localhost:8080
```

or, with Node installed:

```bash
npx serve .
```

Open the printed URL on your phone (same Wi-Fi network) to test the
mobile layout on a real device, or use your browser's device toolbar.

## What to test in Phase 1

1. **Landing** → "Host a game" and "Join a game" both navigate correctly.
2. **Host flow**: enter a room name + your name → Create room → lands on
   a mock Lobby showing a room code, a few simulated players, and a
   "Share join link" button.
3. **Join flow**: enter any 6-digit code + your name → Join room → lands
   on a mock Lobby with you added to the player list.
4. **Ready toggle**: tapping "I'm ready" / "Not ready" updates your row
   in the player list immediately.
5. **Back navigation**: the header back button returns to the previous
   screen; leaving the lobby clears the mock room.
6. **Responsive check**: resize down to ~360px width (a small Android
   phone) and up to tablet/desktop widths — layout should stay usable
   and centered, never overflow horizontally.
7. **Install check**: on a phone browser, "Add to Home Screen" should
   work and open the app in standalone mode with the correct icon.
8. **Reduced motion**: enabling "reduce motion" in OS accessibility
   settings should stop the screen-transition animation.

## Deploying to GitHub Pages (once you're ready)

1. Push this folder's contents to the root of a GitHub repository (or a
   `docs/` folder — either works with GitHub Pages).
2. In the repo, go to **Settings → Pages**, choose the branch/folder
   containing these files, and save.
3. Wait for the Pages deployment to finish, then open the generated URL.
4. No `.nojekyll` workaround is required for the current file set, but
   one is included for safety since none of the folders here start with
   an underscore that Jekyll would otherwise ignore incorrectly.

There is nothing to configure yet for the backend — `APPS_SCRIPT_SETUP.md`
covers that when Phase 3 introduces the Google Apps Script backend and a
real `CONFIG.API_BASE_URL` value.

## Known limitations (intentional, deferred to later phases)

- No real backend: room creation/joining is entirely client-side mock
  state, not persisted, not shared across devices or browser tabs.
- QR code in the lobby is a static placeholder graphic, not a real
  scannable encoding (see `DECISIONS.md` item 4).
- No reconnect logic yet beyond a stored player ID/name in localStorage.
- No role assignment, night/day phases, or voting — those are Phase 4+.
- Dark mode tokens are a reasonable placeholder, not a captured design
  decision (DESIGN.md documents no dark-mode tokens).
