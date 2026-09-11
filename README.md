# Mafia Webapp

A mobile-first Progressive Web App for playing Mafia with a physical
group, with no human moderator. See the project's `CLAUDE_PROJECT_INSTRUCTIONS.md`,
`ARCHITECTURE.md`, `GAME_RULES.md`, and `DESIGN.md` for the full spec —
this README only covers running and deploying what exists so far.

**Status: Phase 4 — Core game engine.** A full Mafia + Villager game
now runs start to finish: role assignment, role reveal, night actions
with live Mafia coordination, day results, discussion, voting, and win
detection. Doctor/Seer/Trickster/Resurrector are Phase 5. See
`DECISIONS.md` for the reasoning behind each choice made along the way.

## Project structure

```text
index.html                 App shell (single HTML entry point)
manifest.webmanifest        PWA install metadata
service-worker.js           Caches the static shell for install/offline
icons/                       App icons (192, 512, maskable 512)
apps-script/                 The real backend — deployed separately, see below
  README.md                   Deployment guide specific to this code
  appsscript.json, *.gs        The backend source itself
    Roles.gs                    Role assignment + centralized win check
    GameEngine.gs                Phase transitions, night/vote resolution
src/
  styles/
    tokens.css               Design tokens sourced from DESIGN.md
    base.css                 Resets, layout primitives, safe-area handling
    components.css           Buttons, cards, inputs, nav, badges, player rows, etc.
  js/
    app.js                   Hash router + service worker registration
    config.js                 API_BASE_URL — the one thing you must set (see below)
    screens/
      landing.js, create.js, join.js   Entry flow (unchanged since Phase 3)
      lobby.js                          Lobby UI + the phase router for everything after
      roleReveal.js                     Private role reveal
      night.js                          Shared night-action screen (content differs by role)
      day.js                            Shared DAY/DISCUSSION screen
      voting.js                         Voting screen
      gameOver.js                       Winner + final role reveal
    state/
      roomStore.js              Real room + game state via HTTP + polling
    services/
      apiClient.js               Fetch wrapper (handles the CORS workaround)
      identityService.js         Per-device player identity (localStorage) + session tokens
      shareService.js            Join-link building + Web Share API / clipboard
      qrEncoder.js                Self-contained QR Code encoder (ISO 18004)
      qrRenderer.js               Renders the encoder's output as inline SVG
    utils/
      roomCode.js               Room code validation
```

## Setting up the backend (required before anything works)

1. Follow `APPS_SCRIPT_SETUP.md` (project root) and `apps-script/README.md`
   to deploy the Google Apps Script Web App and get a `/exec` URL.
2. Open `src/js/config.js` and replace `API_BASE_URL`'s placeholder with
   that URL.
3. Commit and push.

Until you do this, the app clearly tells you the backend isn't
configured yet, rather than failing with a confusing network error.

## Run the frontend locally

```bash
cd mafia-webapp
python3 -m http.server 8080
# then open http://localhost:8080
```

The backend is a separate Google Apps Script project — see above. It
can't be run locally; it only exists once deployed to Google.

## What to test in Phase 4

1. **Full game, at least 3 devices** (more is more interesting — 5+
   gives a real Mafia-vs-town dynamic): host a room, join with the
   others, everyone readies up, host starts.
2. **Role reveal** — each device shows its own role privately; the
   Mafia player(s) see their teammates listed.
3. **Night** — the Mafia player(s) tap a living player to target; if
   there's more than one Mafia, each should see the others' current
   picks update live (within a poll cycle) and the kill should only
   happen once everyone's finalized on the *same* target. Villagers see
   a simple waiting screen — same layout, no action.
4. **Day** — everyone sees who died (or didn't) overnight.
5. **Discussion** — a timer; talk it through out loud.
6. **Voting** — living players tap someone to vote for; dead players
   can watch but can't vote; the game should resolve the moment everyone
   living has voted, without waiting for the timer.
7. **Win detection** — eliminate all Mafia (Town wins) or let Mafia
   reach parity (Mafia wins); confirm the Game Over screen reveals every
   real role.
8. **Reconnect mid-game** — refresh a device during Night or Voting; it
   should return to exactly where it left off, keep its role, and not
   duplicate. Pressing "back" mid-game should NOT remove you from the
   game (see `DECISIONS.md` #27) — only from the Lobby or after Game Over.
9. Everything from Phase 1–3's checklists still applies.

## Deploying to GitHub Pages

Same as before — see `APPS_SCRIPT_SETUP.md` Steps 8–9.

## Known limitations (intentional, deferred to later phases)

- Only Mafia and Villager exist — Doctor, Seer, Trickster, Resurrector
  are Phase 5.
- No host-configurable role counts — a sensible automatic default is
  used (see `DECISIONS.md` #21).
- No spectator-specific polish yet beyond "dead players see the same
  screens, minus the ability to act."
- Locking is script-level, not per-room; rooms are soft-deleted (Drive
  trash) rather than archived.
- Dark mode tokens are a placeholder, not a captured design decision.
- This was tested extensively against a local simulation of the real
  backend logic (133 passing assertions across unit tests and
  multi-browser end-to-end tests, including a full 5-player game played
  through to a win). What can only be confirmed by your own deployment:
  Google's actual Apps Script infrastructure's CORS behavior and true
  concurrent-execution model under real network conditions and real
  devices — see `apps-script/README.md`.
