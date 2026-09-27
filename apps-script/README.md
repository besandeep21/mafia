# Mafia Backend — Apps Script

This is the real multiplayer backend for Phase 3+. It replaces the
mock (`localStorage`-across-tabs) state from Phase 2 with a real
Google Apps Script Web App, using the room owner's Google Drive for
persistence — exactly as described in `ARCHITECTURE.md` and
`APPS_SCRIPT_SETUP.md`.

**Read `APPS_SCRIPT_SETUP.md` (in the project root) first** — it's the
general, beginner-friendly walkthrough for creating the Drive folder,
the Apps Script project, and deploying it. This file only covers what's
specific to the actual code below.

## Files in this folder

| File | Purpose |
|---|---|
| `appsscript.json` | Manifest: V8 runtime, web app executes as the deploying user, accessible to anyone anonymously |
| `Setup.gs` | `CONFIG.DRIVE_ROOT_FOLDER_ID` + one-time `initializeMafiaStorage()` |
| `Code.gs` | `doGet`/`doPost` — the only two functions Apps Script calls directly, wrapped in a top-level try/catch (Phase 9) |
| `Api.gs` | One handler per action, validates input then calls into `Rooms.gs`/`GameEngine.gs` |
| `Rooms.gs` | Room lifecycle: create, join, ready, leave — all under a lock |
| `GameEngine.gs` | Phase transitions, night/vote resolution, win detection — all under a lock |
| `Roles.gs` | The six V1 roles, assignment, and small per-room role helpers |
| `Persistence.gs` | The only file that touches Drive |
| `Validation.gs` | Server-side input validation (never trusts the client) |
| `Utils.gs` | Room code / token generation, the locking helper, structured error codes (`ERR`) and the audit-log helper (Phase 9) |
| `Responses.gs` | Consistent `{ok, ...}` / `{ok:false, error, code}` JSON envelopes |

## Deploying this specific code

1. Follow `APPS_SCRIPT_SETUP.md` Steps 1–2 to create your Drive folder
   and a new Apps Script project.
2. Create each file listed above in the Apps Script editor (matching
   names, including the `.gs` — the editor adds that automatically) and
   paste in the corresponding contents from this folder.
3. In `Setup.gs`, replace `PASTE_YOUR_DRIVE_FOLDER_ID_HERE` with your
   actual folder ID.
4. Run `initializeMafiaStorage` once from the editor (select it in the
   function dropdown, click ▶ Run). Authorize when prompted — this is
   expected the first time.
5. Deploy as a Web App per `APPS_SCRIPT_SETUP.md` Steps 6–7. Test the
   `/exec` URL directly in a browser — you should see:
   `OK — Mafia backend is running.`
6. Copy the `/exec` URL into `src/js/config.js`'s `API_BASE_URL` in the
   frontend, commit, and push.

## Updating an already-deployed backend

If you already have this backend deployed from an earlier phase and are
just applying this phase's changes, you don't need to redo the steps
above — only:

1. In the Apps Script editor, open each changed file (this phase
   changed `Utils.gs`, `Responses.gs`, `Validation.gs`, `Api.gs`,
   `Code.gs`, `Rooms.gs`, and `GameEngine.gs`) and replace its entire
   contents with the version from this delivery.
2. Click **Save** (the floppy disk icon, or Ctrl/Cmd+S).
3. **Deploy → Manage deployments → click the pencil/edit icon on your
   existing production deployment → Version: "New version" → Deploy.**
   This is the step that's easy to miss: saving a file in the editor
   does NOT update your live `/exec` URL — only creating a new version
   of the existing deployment does. (Creating a brand-new deployment
   instead of a new version of the existing one would give you a
   different `/exec` URL, which would mean also updating
   `src/js/config.js` — stick to "new version" of the *same*
   deployment to keep your URL stable.)
4. Open your `/exec` URL directly in a browser — you should still see
   `OK — Mafia backend is running.`
5. No `CONFIG.DRIVE_ROOT_FOLDER_ID` or other setup changes are needed
   for this phase — nothing new was added that requires configuration.

## Why GET for reads and POST-as-text/plain for writes

This is the single most important — and least obvious — thing about
this backend's design, so it's worth repeating here as well as in the
code comments (`Code.gs`, `apiClient.js`):

Apps Script Web Apps have a well-documented rough edge with CORS: a
cross-origin `fetch()` with `Content-Type: application/json` triggers a
preflight `OPTIONS` request, which Apps Script Web Apps don't reliably
answer. The fix used here:

- **Reads** (`getRoom`, used for polling) go through `doGet` via query
  parameters — a GET request has no body, so it never triggers a
  preflight at all.
- **Writes** (`createRoom`, `joinRoom`, `setReady`, `leaveRoom`) go
  through `doPost`, but the frontend sends the body with
  `Content-Type: text/plain` (a browser "CORS-safelisted" content type)
  containing a JSON *string*. `doPost` parses that string itself.
  `Content-Type: text/plain` also skips the preflight.

**This was verified in this sandbox** using a real headless Chromium
browser (via Playwright) making genuinely cross-origin requests against
a local Node server running this exact backend code — confirming no
preflight is triggered and the responses parse correctly. What
*couldn't* be verified here is Google's own infrastructure's specific
CORS header behavior on the real `/exec` endpoint (no internet access
in this environment) — that part is standard, widely-relied-upon Apps
Script behavior, but only your own deployment and testing (Step 7 of
`APPS_SCRIPT_SETUP.md` — test the `/exec` URL from an incognito browser)
can fully confirm it end to end.

## Structured error codes (Phase 9)

Every error response now looks like:

```json
{ "ok": false, "error": "It's not the night phase right now.", "code": "WRONG_PHASE" }
```

`error` is the same human-readable message the frontend has always
shown (via `showToast`) — nothing about it changed. `code` is new: a
stable, machine-readable string the frontend can branch on without
matching English text. Full list, defined in `Utils.gs`'s `ERR`:

| Code | When |
|---|---|
| `INVALID_INPUT` | Malformed request shape (bad room code format, missing name, etc.) |
| `ROOM_NOT_FOUND` | No room exists with that code |
| `ROOM_CODE_EXHAUSTED` | Couldn't allocate a fresh 6-digit code (retry) |
| `SESSION_INVALID` | The player's `playerId`/`sessionToken` pair doesn't match any player in the room |
| `GAME_ALREADY_STARTED` | Tried to join or start a room that's past `LOBBY` |
| `NOT_HOST` | A non-host tried to start the game |
| `NOT_ENOUGH_PLAYERS` | Fewer than 3 players tried to start |
| `WRONG_PHASE` | Action doesn't match the room's current phase (e.g. voting during NIGHT) |
| `DEAD_PLAYER` | A dead player tried to vote or act |
| `NO_ACTION` | A Villager tried to submit a night action |
| `INVALID_TARGET` | Missing/dead/otherwise-ineligible target for the role's action |
| `SELF_TARGET_FORBIDDEN` | The Trickster tried to target themselves |
| `ALREADY_FINALIZED` | Mafia tried to change target after finalizing |
| `ABILITY_USED` | Trickster/Resurrector's one-time ability already spent |
| `UNKNOWN_ACTION` | The `action` field didn't match any known endpoint |
| `MALFORMED_REQUEST` | The POST body wasn't valid JSON |
| `SERVER_BUSY` | `LockService` couldn't get the lock within 10s — safe to retry |
| `INTERNAL_ERROR` | An uncaught exception — see `Code.gs`'s try/catch; check Executions in the editor for the real detail |

The frontend currently acts on exactly one of these programmatically
(`ROOM_NOT_FOUND`, to tell a genuinely deleted room apart from a
transient failure — see the root `README.md`/`DECISIONS.md` #52) and
shows every other one as a toast using its `error` message. Nothing
requires you to add new codes if you extend the game later, but if you
do add a new rejection, giving it a code (reusing one of the above if
it fits, or adding a new one to `ERR`) costs nothing and keeps this
list accurate for whoever reads it next.

## Audit log (Phase 9)

Every successful state-changing action (create/join/ready/leave/start/
acknowledge/night-action/vote, plus forced timeout transitions) appends
a small entry to that room's own `auditLog` array, right inside its
Drive JSON file — you'll see it if you open
`MafiaGames/rooms/<code>.json` directly in Drive:

```json
{ "at": "2026-09-26T10:13:28.950Z", "action": "submitVote", "by": "uuid-...", "revision": 9, "detail": "voted" }
```

This is **never returned by any API response** — not to the frontend,
not to the host, not through any endpoint. Two reasons: first, which
players called `submitNightAction` on a given night is itself partial
role information (only non-Villagers ever do), so exposing it would
leak roles the same way sending every player's role to every browser
would; second, it doesn't need an endpoint to be useful — the host
already has direct Drive access to this same file (which has always
contained the plaintext roles, since Phase 3/4), so reading the audit
trail is just "open the file," not a feature that needs building. If
you ever need to investigate a dispute ("did the app really resolve
that vote right?"), that JSON file is where to look. It's capped at the
last 200 entries per room so it can't grow the file unboundedly across
an unusually long session.

## Testing after deployment

Beyond `APPS_SCRIPT_SETUP.md`'s general Step 10 checklist:

1. Open your GitHub Pages URL on two different devices (or a normal +
   incognito window as a stand-in).
2. Host a room on device 1, note the code.
3. Join with device 2 using that code — device 1's player list should
   update within a few seconds with no manual refresh.
4. Toggle ready on device 2 — device 1 should reflect it, again without
   refreshing.
5. Refresh device 2's lobby tab — it should stay the same player, not
   duplicate.
6. Try joining with a made-up code — you should get a clear "No room
   found" message, not a silent failure.

## Known limitations

- **Script-level locking, not per-room.** `Utils.gs`'s `withLock_`
  serializes *all* rooms' writes through one script-wide lock, not a
  separate lock per room. Simpler, and Apps Script's own docs recommend
  exactly this pattern — but it means writes to unrelated rooms briefly
  queue behind each other. Fine at this app's expected scale (a handful
  of concurrent physical game sessions), worth revisiting only if that
  ever changes.
- **Rooms are soft-deleted** (moved to Drive's trash, not permanently
  erased) when the last player leaves. They'll disappear from Drive's
  trash on Google's normal 30-day schedule. No `history/` archive folder
  yet (`ARCHITECTURE.md` §12 mentions one as a future option).
- **No real concurrency stress test against Google's actual
  infrastructure.** This backend's logic was tested against true
  concurrent requests in a local simulation (5 simultaneous joins, no
  lost updates) — but Apps Script's real multi-instance execution model
  is something only a real deployment under real concurrent load can
  fully validate.
