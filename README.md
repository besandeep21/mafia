# Mafia Webapp

A mobile-first Progressive Web App for playing Mafia with a physical
group, with no human moderator. See the project's `CLAUDE_PROJECT_INSTRUCTIONS.md`,
`ARCHITECTURE.md`, `GAME_RULES.md`, and `DESIGN.md` for the full spec —
this README only covers running and deploying what exists so far.

**Status: Phase 2 — Lobby.** Real room creation/joining with a working
6-digit code, a functioning scannable QR code, a share link, and ready
states — all synced live across multiple browser tabs. There's still no
real backend (that's Phase 3), so rooms only sync across tabs of the
*same browser*, not across separate devices yet. See `DECISIONS.md` for
the reasoning behind each choice made along the way.

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
    state/
      roomStore.js             Shared room state (localStorage + cross-tab sync)
    services/
      identityService.js       Per-tab player identity (sessionStorage)
      shareService.js           Join-link building + Web Share API / clipboard
      qrEncoder.js              Self-contained QR Code encoder (ISO 18004)
      qrRenderer.js             Renders the encoder's output as inline SVG
    utils/
      roomCode.js               Room code generation/validation
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

## What to test in Phase 2

1. **Host flow**: "Host a game" → enter a room name + your name → lands
   on a Lobby showing a real 6-digit code, a scannable QR code, and a
   "Share join link" button.
2. **Multi-tab join**: open a second tab (or an incognito window) to the
   same site, choose "Join a game", enter the code from tab 1 → you
   should appear in tab 1's player list within a moment, with no manual
   refresh needed. This is the core Phase 2 test — it simulates multiple
   players without a real backend yet.
3. **Ready sync**: toggle "I'm ready" in one tab → the other tab's badge
   for that player updates automatically (via the browser's `storage`
   event).
4. **Wrong code**: try joining with a code that doesn't exist → a clear
   inline error appears instead of silently succeeding (Phase 1's mock
   accepted any code; Phase 2 validates against real rooms).
5. **QR scan**: on a phone, scan the lobby's QR code with the camera —
   it should open the join screen with the code pre-filled.
6. **Leave**: tap back from the lobby in one tab → that player disappears
   from the other tab's player list. If every player leaves, the room is
   gone (joining that code afterward correctly fails as NOT_FOUND).
7. **Refresh**: refreshing a lobby tab keeps you as the same player (no
   duplicate entry), because identity persists per-tab via `sessionStorage`.
8. Everything from Phase 1's checklist (responsive layout, install,
   reduced motion) still applies.

## Deploying to GitHub Pages

1. Push this folder's contents to the root of a GitHub repository (or a
   `docs/` folder — either works with GitHub Pages).
2. In the repo, go to **Settings → Pages**, choose the branch/folder
   containing these files, and save.
3. Wait for the Pages deployment to finish, then open the generated URL.
4. `.nojekyll` is included for safety, though nothing here currently
   needs it.

There is nothing to configure yet for the backend — `APPS_SCRIPT_SETUP.md`
covers that when Phase 3 introduces the Google Apps Script backend and a
real `CONFIG.API_BASE_URL` value.

## Known limitations (intentional, deferred to later phases)

- **No cross-device sync.** Rooms only sync across tabs of the *same
  browser* via `localStorage` + the `storage` event. Two people on two
  different phones cannot yet see the same room — that requires Phase
  3's real Apps Script backend.
- No reconnect logic beyond same-tab refresh (see `DECISIONS.md` #9).
- No role assignment, night/day phases, or voting — Phase 4+.
- No host-transfer if the host leaves the lobby (see `DECISIONS.md` #12).
- Dark mode tokens are a reasonable placeholder, not a captured design
  decision (`DESIGN.md` documents no dark-mode tokens).
