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
| `Code.gs` | `doGet`/`doPost` — the only two functions Apps Script calls directly |
| `Api.gs` | One handler per action, validates input then calls into `Rooms.gs` |
| `Rooms.gs` | Room lifecycle: create, join, ready, leave — all under a lock |
| `Persistence.gs` | The only file that touches Drive |
| `Validation.gs` | Server-side input validation (never trusts the client) |
| `Utils.gs` | Room code / token generation, the locking helper |
| `Responses.gs` | Consistent `{ok, ...}` / `{ok:false, error}` JSON envelopes |

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
