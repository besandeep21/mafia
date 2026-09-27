# Mafia Webapp

A mobile-first Progressive Web App for playing Mafia with a physical
group, with no human moderator. See the project's `CLAUDE_PROJECT_INSTRUCTIONS.md`,
`ARCHITECTURE.md`, `GAME_RULES.md`, and `DESIGN.md` for the full spec —
this README only covers running and deploying what exists so far.

**Status: Phase 10 — Polish (final phase in the current plan).** This
phase touched only the frontend (no `apps-script/*.gs` changes): proper
loading/empty/error states everywhere a screen previously showed plain
placeholder text, a "Reconnecting…" indicator for degraded connectivity
that the pre-existing offline banner didn't cover, a handful of
subtle entrance animations (respecting `prefers-reduced-motion`
throughout), and an accessibility pass that fixed two real WCAG AA
contrast failures plus a genuine pre-existing bug (`.badge-critical`
had no CSS definition at all — see `DECISIONS.md` #56-61).

## Project structure

```text
index.html                 App shell (single HTML entry point)
manifest.webmanifest        PWA install metadata
service-worker.js           Caches the static shell for install/offline
icons/                       App icons (192, 512, maskable 512)
apps-script/                 The real backend — deployed separately, see below
  README.md                   Deployment guide specific to this code
  appsscript.json, *.gs        The backend source itself
    Roles.gs                    Role assignment (all 6 roles) + centralized win check
    GameEngine.gs                 Phase transitions + full night/vote resolution order
src/
  styles/                     Design tokens, resets, components
  js/
    app.js                   Hash router + service worker registration
    config.js                 API_BASE_URL — the one thing you must set (see below)
    screens/
      landing.js, create.js, join.js   Entry flow
      lobby.js                          Lobby UI + the phase router for everything after
      roleReveal.js                     Private role reveal (all 6 roles)
      night.js                          Shared night-action screen — content differs per role
      day.js                            Shared DAY/DISCUSSION screen
      voting.js                         Voting screen
      gameOver.js                       Winner(s) + final role reveal
    state/
      roomStore.js              Real room + game state via HTTP + polling
    services/
      apiClient.js, identityService.js, shareService.js, qrEncoder.js, qrRenderer.js
    utils/
      roomCode.js
```

## Setting up the backend (required before anything works)

1. Follow `APPS_SCRIPT_SETUP.md` (project root) and `apps-script/README.md`
   to deploy the Google Apps Script Web App and get a `/exec` URL.
2. Open `src/js/config.js` and replace `API_BASE_URL`'s placeholder with
   that URL.
3. Commit and push.

## Run the frontend locally

```bash
cd mafia-webapp
python3 -m http.server 8080
# then open http://localhost:8080
```

The backend is a separate Google Apps Script project — see above.

## What to test in Phase 10

This phase is visual/UX polish, not new game logic — every rule, phase
transition, and win condition should behave exactly as before. What's
different is how the app *feels* while all of that happens.

1. **First load on a slow connection.** Throttle your browser/phone to
   "Slow 3G" and load the site fresh. You should see a plain spinner
   (not a blank white screen) until the app is ready, then it should
   fade out cleanly.
2. **Every async button shows a spinner while working**, not just
   changed text — Create room, Join room, Ready, Start game, Finalize
   (night actions), Got it (role reveal acknowledge).
3. **Reconnect banner.** Mid-game, throttle your network to something
   flaky (not fully offline — e.g. Chrome DevTools "Slow 3G" with high
   packet loss, or block the Apps Script domain specifically) for 15-20
   seconds. You should see a small "Reconnecting…" banner at the top
   that goes away once requests succeed again. Fully disabling the
   network (airplane mode / DevTools "Offline") should show the
   existing offline banner instead, never both at once.
4. **Empty/error states look intentional.** Load `#/lobby?code=000000`
   for a room that doesn't exist, and load the app once with
   `config.js`'s `API_BASE_URL` still a placeholder — both should show
   a centered icon + message + "Back home" button, not bare text.
5. **The "Out" badge and the Mafia role badge on the final reveal are
   red pills**, not plain unstyled text — this was a real bug (see
   `DECISIONS.md` #57) fixed this phase; worth specifically confirming
   it looks right on your own device/browser.
6. **The timer pulses red once ≤10 seconds remain** on any night/voting
   phase, and turn on a screen reader (VoiceOver/TalkBack) to confirm
   it announces "10 seconds left" once at that same moment.
7. **Dark mode** (your OS/browser dark setting) and **reduced motion**
   (OS "reduce motion" setting) should both still render every screen
   correctly — nothing should look broken or missing, just calmer with
   reduced motion on.
8. Everything from Phase 1-9's checklists still applies.

## Deploying to GitHub Pages

Same as before — see `APPS_SCRIPT_SETUP.md` Steps 8-9. One addition
worth restating clearly: **whenever you change any file, bump
`CACHE_VERSION` in `service-worker.js`** (currently `mafia-shell-v7`
after this phase's changes; bump to `-v8` next time you edit anything).
Without this, returning players' browsers may keep serving old cached
files indefinitely — the version bump is what tells the service worker
a new cache is needed.

This phase does **not** touch any backend file — there is nothing to
redeploy in Apps Script, and no new deployment version to create. If
you already have a working `/exec` URL from an earlier phase, it's
untouched and still correct.

## Known limitations (intentional)

- No host-configurable role counts — automatic thresholds are used
  (see `DECISIONS.md` #21, #30).
- No spectator-specific polish beyond "dead players see the same
  screens, minus the ability to act."
- Locking is script-level, not per-room; rooms are soft-deleted rather
  than archived.
- Background polling slows to 30s rather than stopping outright while a
  tab is hidden — a deliberate balance between quota-consciousness and
  not missing a phase transition for too long; see `DECISIONS.md` #40.
- No manifest screenshots (optional desktop install-prompt polish) —
  deferred twice and now closed for good; see `DECISIONS.md` #48, #60.
- The structured error `code`s (`DECISIONS.md` #49) are mostly used for
  a couple of concrete behaviors (telling a deleted room apart from a
  flaky connection, #52; and this phase's "Reconnecting…" banner, which
  reuses that same distinction) plus consistent toasts everywhere (#53)
  — tailoring individual screens' reactions to more specific codes (e.g.
  auto-recovering from `SESSION_INVALID`) was considered and not
  pursued as not worth the added complexity for a finished V1.
- The audit log (`DECISIONS.md` #51) is intentionally Drive-file-only,
  with no in-app viewer — reading it means opening the room's JSON file
  directly in Drive.
- One accepted, documented near-miss from this phase's contrast audit:
  `--color-critical-strong`'s ~4.34:1 against the dark-mode canvas,
  just under the 4.5:1 text threshold — left as-is since its only
  dark-mode usage is a border/UI-boundary (3:1 threshold, passes
  comfortably), not body text. See `DECISIONS.md` #56.
- This phase's testing used a local static server plus two
  purpose-built Playwright scripts (see `DECISIONS.md` #59) — a real
  browser driving the compiled app end-to-end, plus a render harness
  exercising every role's night-action UI and both game-over outcomes
  with fabricated state, since no live Apps Script backend was
  available in this chat. Neither script is included in this delivery.
  Google's actual Apps Script infrastructure, and real-device quirks
  across iOS/Android/desktop, can only be fully confirmed by your own
  deployment and testing — see `apps-script/README.md`.
