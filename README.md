# Mafia Webapp

A mobile-first Progressive Web App for playing Mafia with a physical
group, with no human moderator. See the project's `CLAUDE_PROJECT_INSTRUCTIONS.md`,
`ARCHITECTURE.md`, `GAME_RULES.md`, and `DESIGN.md` for the full spec —
this README only covers running and deploying what exists so far.

**Status: Phase 5 — Special roles.** All six V1 roles now exist: Mafia,
Villager, Doctor, Seer, Trickster, Resurrector. Full night resolution
order (protection → Mafia kill → Trickster kill → Resurrector → deaths
applied together → Seer result), the Trickster's independent win
condition, and private-information leak prevention are all in place and
tested. See `DECISIONS.md` for the reasoning behind each choice.

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

## What to test in Phase 5

Best tested with **7-8 players** so every special role actually gets
assigned (see `DECISIONS.md` #30 for the exact thresholds: Doctor at 4+,
Seer at 5+, Trickster at 7+, Resurrector at 8+ players).

1. **Doctor** — protect a player the Mafia is targeting; confirm they
   survive and no death is reported for them.
2. **Seer** — investigate a Mafia player; confirm the result (correctly
   "Mafia") only appears once the night fully resolves, and only on the
   Seer's own screen.
3. **Trickster** — confirm you can't target yourself; use your one kill
   on a *different* target than the Mafia's — both should die (unless
   the Mafia's target was Doctor-protected); confirm the ability shows
   as used afterward and can't be used again.
4. **Resurrector** — skip on a night with no one dead yet (should work
   even with an empty target list); on a later night, revive someone
   who died — confirm they're alive again and the Day screen announces
   the revival; confirm the ability can't be used twice.
5. **Trickster win** — if the Trickster survives to Game Over, confirm
   the screen shows them as an *additional* winner alongside whichever
   of Town/Mafia actually won.
6. **Privacy** — at no point should any player's screen reveal another
   player's specific role, night action, or Seer result (aggregate
   counts and public deaths/revivals are fine; specifics are not).
7. Everything from Phase 1–4's checklists still applies.

## Deploying to GitHub Pages

Same as before — see `APPS_SCRIPT_SETUP.md` Steps 8–9.

## Known limitations (intentional, deferred to later phases)

- No host-configurable role counts — automatic thresholds are used
  (see `DECISIONS.md` #21, #30).
- No spectator-specific polish beyond "dead players see the same
  screens, minus the ability to act."
- Locking is script-level, not per-room; rooms are soft-deleted rather
  than archived.
- Dark mode tokens are a placeholder, not a captured design decision.
- Tested extensively against a local simulation of the real backend
  logic — 198 passing assertions across unit tests and multi-browser
  end-to-end tests, including full games exercising every role. Google's
  actual Apps Script infrastructure behavior can only be fully confirmed
  by your own deployment — see `apps-script/README.md`.
