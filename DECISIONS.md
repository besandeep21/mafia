# DECISIONS.md

Record of assumptions made where the spec left an axis open, per
CLAUDE_PROJECT_INSTRUCTIONS.md §21 and the master instructions'
"Documentation" section.

## Phase 1

1. **No build tool / bundler.** The app is plain HTML/CSS/JS using native
   ES modules, with no TypeScript compiler, bundler, or npm dependency
   graph. `CLAUDE_PROJECT_INSTRUCTIONS.md` prefers "vanilla TypeScript/
   JavaScript unless a framework materially improves maintainability" and
   asks to "keep the final GitHub Pages deployment simple." A dependency-free
   static site satisfies both and needs zero CI/build step to deploy to
   Pages. If the project later wants compile-time type checking, JSDoc
   type annotations (already used throughout) can be checked with `tsc
   --checkJs` without changing the runtime output.

2. **Single-page app with hash-based routing**, not multiple `.html`
   files or the History API. Reasons:
   - Every player must see the same overall screen structure regardless
     of role (see "Role Privacy" in the master instructions) — a shared
     SPA shell makes that structural consistency the default rather than
     something to maintain across separate pages.
   - Hash routes (`#/join?code=...`) need no server-side rewrite rules,
     which matters because GitHub Pages serves static files with no
     control over 404/rewrite behavior.

3. **Dark mode token values.** `DESIGN.md`'s "Known Gaps" section
   explicitly states no dark-mode tokens were captured from the source
   pages. Phase 1 adds a `prefers-color-scheme: dark` block that inverts
   canvas/surface/ink roles while keeping the cobalt/black CTA roles,
   all radii, spacing, and type scale identical. This is a placeholder
   direction, not a captured brand decision — flag for design review
   before Phase 10 polish.

4. **QR code was a visual placeholder in Phase 1's mock lobby.**
   Superseded in Phase 2 — see item 8 below.

5. **Mock lobby includes simulated companion players** (e.g. "Priya",
   "Arjun") so the Create/Join flow has something believable to land on.
   Superseded in Phase 2 — this mock module was deleted once real
   cross-tab room state existed (see item 7).

6. **Player display name is required**, room name is optional (defaults
   to "Untitled Room"). `GAME_RULES.md`/`ARCHITECTURE.md` don't specify
   required fields at creation; requiring a name matches "every player
   gets a random persistent player ID" plus a human-readable name for
   the player list.

7. **Montserrat is used as the display/body typeface**, per DESIGN.md's
   own documented fallback chain for Optimistic VF (a proprietary Meta
   typeface Claude cannot use): "Montserrat, Helvetica, Arial, Noto Sans."

## Phase 2

8. **QR codes are now real, not a placeholder — implemented as a
   self-contained encoder rather than a third-party service call.**
   `CLAUDE_PROJECT_INSTRUCTIONS.md` §21 says "Do not add ... unnecessary
   third-party services ... unless explicitly approved," and the app's
   own architecture philosophy is a dependency-free static frontend. A
   public QR-image API (e.g. api.qrserver.com) would have been far less
   code, but it's a runtime third-party dependency for a core join flow
   with no fallback if that service is ever down or blocked, and it
   sends every room's join URL to an outside party. The hand-written
   encoder (ISO 18004, byte mode, versions 1–6 only — long enough for any
   realistic GitHub Pages URL, short enough to avoid needing version-info
   BCH bits) avoids both problems. It was verified by cross-checking the
   Reed-Solomon and BCH math against independently-written reference
   implementations, and by rendering real output and decoding it with
   OpenCV's QR detector at realistic on-screen sizes (see the Phase 2
   completion notes for what was actually tested). If a join URL is ever
   too long to encode (extremely long custom domains), the lobby falls
   back to showing just the link/share button — no QR, no crash.

9. **Player identity moved from `localStorage` to `sessionStorage`**
   (`identityService.js`, renamed from `localStorageService.js`).
   Phase 2's acceptance test is "several browser tabs can simulate a
   lobby," but `localStorage` is shared by every tab of the same origin —
   every tab would have resolved to the *same* player, making the test
   meaningless. `sessionStorage` is per-tab (so multiple tabs = multiple
   simulated players) while still surviving a same-tab refresh, which is
   all the reconnection requirement needs at this stage. This is a
   testing-phase artifact: once Phase 3+ moves to real separate physical
   devices, each device already has its own browser storage, so per-tab
   vs per-origin stops being a meaningful distinction. Flag for removal/
   simplification once real devices are the only way to test.

10. **Room data lives in `localStorage`, not `sessionStorage`, and is
    the thing multiple tabs deliberately share** (`state/roomStore.js`).
    This is the intentional mirror image of decision 9: identity must be
    per-tab, but room state must be shared, so the two use different
    storage APIs on purpose. Cross-tab updates are delivered via the
    native `storage` event, which fires in every *other* tab automatically
    with no polling and no `BroadcastChannel` — one less API surface for
    a mechanism that's explicitly temporary (deleted once Phase 3 lands).

11. **Leaving the lobby (back button) actually removes the player from
    the room; accidental tab close does not.** `GAME_RULES.md`/
    `ARCHITECTURE.md` say not to punish accidental mid-game disconnects
    (dead/disconnected players stay as spectators, never auto-removed).
    But the lobby is pre-game, and tapping "back" is a deliberate action,
    not a disconnect — removing the player from the visible lobby list in
    that case is correct and expected. If every player leaves a room, the
    room entry is deleted outright rather than left as an empty stale
    `localStorage` entry.

12. **Host reassignment on host-leaves-lobby is out of scope for Phase 2.**
    If the host taps back and leaves, they're simply removed like any
    other player — no new host is promoted. `CLAUDE_PROJECT_INSTRUCTIONS.md`'s
    "host is also a normal player" requirement is about the host not
    getting hidden game-state privileges, not about lobby host-transfer
    mechanics, which aren't specified anywhere in the project knowledge.
    Deferred until a phase that actually needs it (if ever).
    **Superseded in Phase 3** — see item 17.

## Phase 3

13. **Player identity moved back from `sessionStorage` to `localStorage`**
    (`identityService.js`). Phase 2 deliberately used `sessionStorage` so
    multiple tabs of one browser could simulate different players against
    the tab-local mock. Now that Phase 3 introduces a real backend,
    production correctness matters more than that testing convenience:
    `CLAUDE_PROJECT_INSTRUCTIONS.md` §5 requires identity to survive a
    full browser close/reopen on the same device, which `sessionStorage`
    doesn't do. To simulate multiple players against the real backend
    from one machine now, use separate browser profiles or incognito
    windows (each gets its own `localStorage`) — plain tabs will
    correctly all resolve to the same player, matching real device
    behavior.

14. **The client generates and owns its own persistent `playerId`; the
    server only issues the `sessionToken`.** `CLAUDE_PROJECT_INSTRUCTIONS.md`
    §5 says "every player gets a random persistent player ID stored
    locally on their device" — device-generated, reused across every
    room that device ever joins. The backend trusts this ID as a label
    (not a security claim) and issues a separate, per-room secret
    `sessionToken` as the actual authorization credential for mutating
    requests. A first implementation had the server mint a fresh
    `playerId` on every room join instead, which technically worked but
    contradicted "persistent... reused" — corrected before it reached
    the frontend. If a client's claimed `playerId` ever collides with a
    different, already-present player in the same room (astronomically
    unlikely with UUIDs, but checked defensively), the join still
    succeeds — under a freshly-minted ID — rather than being rejected or
    allowed to impersonate the existing player.

15. **GET for reads, POST with `Content-Type: text/plain` for writes** —
    a deliberate workaround for a well-known Apps Script + browser CORS
    interaction (Web Apps can't reliably answer a CORS preflight
    `OPTIONS` request, which a cross-origin JSON POST would otherwise
    trigger). GET requests and POST requests with a CORS-safelisted
    content type like `text/plain` never trigger a preflight in the
    first place. `doPost` parses the JSON string itself. See
    `apps-script/README.md` for the full explanation and how this was
    verified (a real headless-browser test against a local server
    running the actual backend code, confirming no preflight fires and
    responses parse correctly end to end).

16. **One script-level lock, not a per-room lock**
    (`apps-script/Utils.gs`'s `withLock_`). Serializes writes across
    *all* rooms rather than just the one being mutated — simpler, and
    it's the pattern Apps Script's own documentation recommends for this
    exact scenario. This app's expected scale (a handful of concurrent
    physical game sessions in someone's living room, not a public
    service) makes the simplicity worth the small throughput cost.
    Revisit only if that assumption ever stops holding.

17. **Host reassignment on leave, implemented.** When the host leaves a
    room, the longest-standing remaining player is promoted to host
    (`apps-script/Rooms.gs`'s `leaveRoomRecord_`). This supersedes item
    12's Phase 2 deferral: once there's a real, persistent room record
    that other phases (4+) will need a valid, unambiguous host for, an
    orphaned `hostPlayerId` pointing at nobody is a real correctness gap
    worth closing now rather than later, and the fix was small and
    self-contained within code this phase was already touching.

18. **Rooms are soft-deleted (Drive trash), not permanently erased**, once
    the last player leaves (`apps-script/Persistence.gs`'s `deleteRoom_`).
    Cheap safety margin against a mistaken "everyone left" detection
    permanently destroying a room's data — Drive's own 30-day trash
    retention handles eventual cleanup for free, with no `history/`
    archive folder needed yet.

19. **Polling interval: 4 seconds, exponential backoff on failure, capped
    at 20 seconds** (`roomStore.js`). Within `ARCHITECTURE.md` §19's
    suggested 3–5 second lobby range. Backing off on failure (rather than
    retrying immediately) avoids hammering a struggling backend or
    burning through Apps Script's daily quota during a network hiccup;
    resetting to the base interval on the next success keeps the lobby
    feeling responsive again as soon as things recover.

## Phase 4

20. **Only Mafia + Villager exist**, per `CLAUDE_PROJECT_INSTRUCTIONS.md`'s
    own phase breakdown — Doctor/Seer/Trickster/Resurrector are
    explicitly Phase 5. `Roles.gs` and the resolution order in
    `GameEngine.gs` are structured so adding them later touches those
    two files, not the room/session plumbing.

21. **No host-configurable role counts yet.** `defaultMafiaCount_()` in
    `Roles.gs` picks automatically (~1 Mafia per 4 players, capped below
    parity) rather than exposing a settings screen. Phase 4's acceptance
    criterion is "Mafia + Villager game works end-to-end," not a host
    configuration UI — that's a reasonable later addition, not required
    here. Minimum 3 players to start, enforced server-side.

22. **Intermediate computational phases (role assignment, night
    resolution, vote resolution, win-check) are never persisted as their
    own observable phase.** `ARCHITECTURE.md` §7 lists NIGHT_RESOLUTION,
    VOTE_RESOLUTION, and WIN_CHECK as states in the machine, but nothing
    ever *waits* during them — they're synchronous computations that
    happen inside whichever request triggers them, and the room lands on
    the next actually-waiting phase before it's ever written to Drive. A
    polling client could never observe them as a distinct value even if
    they were stored. See `GameEngine.gs`'s top comment.

23. **A single, centralized `evaluateWinner_()` function decides the
    winner** (`Roles.gs`), called from exactly one place after every
    death (`checkWinAndMaybeEnd_()` in `GameEngine.gs`). This directly
    satisfies `GAME_RULES.md`'s explicit instruction: "The final
    implementation must centralize victory evaluation in one function so
    rules are not duplicated across screens."

24. **DAY and DISCUSSION share one frontend renderer** (`day.js`'s
    `renderDay(content, state, ctx, mode)`), since both are "no action,
    just watch a timer" screens differing only in copy. This also means
    a client whose poll happens to land after DAY's deadline but before
    DISCUSSION's remainder ever renders is not a real information loss —
    both modes show the same night-result summary.

25. **Backend-verified bug: timeout-driven phase transitions weren't
    bumping `revision`.** Every *explicit* action (submitVote,
    submitNightAction, etc.) incremented `room.revision` itself before
    triggering any resulting resolution — but the purely time-driven
    transitions applied lazily inside `getRoomRecord_`
    (`resolvePendingTimeouts_()` advancing DAY→DISCUSSION→VOTING, or
    forcing an unfinalized night/vote to resolve) did not. Since
    `roomStore.js`'s polling only re-renders when the revision number
    changes, this meant a phase could genuinely change on the backend
    while every polling client's screen silently never updated — a
    freeze bug that would only show up under real timeout conditions,
    not under normal "everyone acted before the deadline" play. Caught
    by a 5-real-browser Playwright test that hung waiting for the Voting
    screen; fixed by making `resolvePendingTimeouts_()` bump revision on
    every transition it applies; confirmed with both a dedicated
    regression test (asserting revision strictly increases across each
    forced transition) and by re-running the full multi-browser game to
    completion.

26. **Once `GAME_OVER`, all roles are revealed in the public
    projection.** `ARCHITECTURE.md`'s public/private/faction split exists
    to protect information that still matters to outstanding decisions;
    once the game has actually ended there are none left, so a full
    reveal (matching common Mafia practice) costs nothing and the
    Game Over screen would otherwise have no way to show final roles.

27. **Mid-game "back" doesn't remove the player from the game.**
    `GAME_RULES.md` requires the game to survive a disconnect — pressing
    back is functionally equivalent to a disconnect while a game is
    active (as opposed to in the LOBBY or after GAME_OVER, where leaving
    the room record entirely is correct). `lobby.js` tracks the latest
    known phase and only calls `leaveRoom()` for LOBBY/GAME_OVER; during
    an active game it just navigates away, leaving the session token
    valid for whenever that player returns.

## Phase 5

28. **Doctor/Seer/Trickster/Resurrector actions are optional each night;
    only Mafia's unanimous kill gates early night resolution.** Mafia's
    kill genuinely requires every living member to coordinate — that's
    the one thing GAME_RULES.md makes mandatory. The other four roles
    act independently with no coordination requirement, so waiting on
    them before the night can resolve would let a slow or undecided
    Doctor/Seer/Trickster/Resurrector block the whole table indefinitely
    for no rules-mandated reason. They can still act any time before the
    night actually resolves (whether that's triggered by Mafia finishing
    early or by the deadline) — same as before, just not a *requirement*
    for early resolution.

29. **An explicit "skip" action, not silence, is how an optional role
    declines to act.** Given item 28's design, there needed to be a way
    to tell "hasn't decided yet" apart from "deliberately saving the
    ability" — especially for the Trickster and Resurrector, who might
    want to hold their one-time ability for a later round. `skip: true`
    records a real decision (and satisfies "acted this phase" for
    display purposes) without applying any actual effect at resolution.
    Mafia can't skip — their action is mandatory, so skip there would be
    meaningless.

30. **Automatic special-role thresholds, still no host configuration
    UI**, consistent with item 21's Mafia-count decision: Doctor unlocks
    at 4 players, Seer at 5, Trickster at 7, Resurrector at 8
    (`Roles.gs`'s `defaultSpecialRoles_`). Higher-frequency, more
    foundational roles (Doctor, Seer) unlock before the one-use
    Trickster and Resurrector, and at least one Villager is always left
    once assignment is possible, so a game is never *all* special roles.

31. **Ability consumption timing: Trickster/Resurrector are marked
    "used" at night *resolution*, not at submission.** A player can
    freely change their target (or switch to skip, or back) any number
    of times before the night actually resolves — nothing is
    irreversibly spent by a stray tap. This also means a submitted
    Resurrector action that later turns out ineligible (target no
    longer dead by resolution time — vanishingly rare in practice, but
    possible in principle) still consumes the ability, matching
    GAME_RULES.md: "If the selected dead player is no longer eligible by
    resolution time, the action fails" — fails, not retries.

32. **Seer's investigation result is delivered when the night resolves,
    not immediately at submission.** `ARCHITECTURE.md` §10 lists
    "Generate private results" as the *final* step of night resolution,
    after all the kill/protection/revival steps — so this was the more
    spec-faithful choice over an instant reveal. In practice this means
    a Seer might submit their investigation and see no result yet if
    Mafia hasn't finished coordinating; the result appears once the
    whole night concludes, the same moment everyone else learns who
    died. `night.js` and the private projection reflect this: an empty
    `seerResults` array is a normal, expected state mid-night.

33. **`room.game.winner` (singular) became `room.game.winners` (array).**
    The Trickster's win (GAME_RULES.md: "wins if alive when the game
    reaches a terminal game-over state") is independent of, and can
    coexist with, the primary Town/Mafia result — a Trickster who
    survives to the end wins *regardless* of which side actually won.
    `evaluateWinner_()` still returns the single primary result (Town or
    Mafia) exactly as before; `checkWinAndMaybeEnd_()` layers the
    Trickster check on top and assembles the final array. No backward
    compatibility with the old field name was preserved — this is
    pre-release software, and carrying a deprecated field just to avoid
    a rename would have added confusion for no benefit.

34. **Public night history changed from a single-death `NIGHT_DEATH`/
    `NO_NIGHT_DEATH` pair to one unified `NIGHT_RESULT` entry with a
    `deaths` array and an optional `revived` field.** Multiple deaths in
    one night are now possible (Mafia and Trickster can strike different
    targets the same night), and a revival is public knowledge the
    instant it happens (everyone can see a dead player is suddenly alive
    again, even though *who* revived them stays private) — a single
    richer event type captures all of this without the frontend needing
    to reassemble it from several history entries.

35. **This phase's engine work was verified with the same rigor as
    Phases 3-4, and it found a real bug before it shipped.**
    `renderSoloTargetPicker` (the shared Doctor/Seer/Trickster/Resurrector
    UI) returned early when a role's target pool was empty — which
    happens legitimately for the Resurrector on any night nobody's dead
    yet — and the skip button's click listener was attached *after* that
    early return, so it silently never got wired up. A real-browser test
    using a Resurrector with zero eligible targets caught this (the test
    hung waiting for the skip button to respond); the fix moved the skip
    listener out from behind the early return. Caught before reaching
    the delivered zip, the same way Phase 4's revision-bump bug was.

## Phase 6

36. **Finalizing now actually locks a Mafia member's selection at the
    backend, not just in the frontend's disabled buttons.**
    `GAME_RULES.md` says a Mafia member "can change their own selection
    until finalization" — worded to imply not after. Testing this
    specifically (a real gap-check, not an assumption) found the backend
    had no such enforcement: only the frontend disabled the buttons once
    finalized, so a replayed or forged request could still silently
    overwrite an already-finalized target. `GameEngine.gs`'s
    `submitNightActionRecord_` now rejects any further change to a
    Mafia member's target once they've finalized, with a clear error;
    the frontend's existing disabled state was already correct and
    needed no change.

37. **The Mafia coordination view was upgraded from an aggregate count
    to named, per-teammate status.** Phase 4/5 already showed "N picks"
    next to each potential target, but `GAME_RULES.md` specifically says
    Mafia should "see each Mafia member's current selection" — singular,
    attributable, not just a tally. `night.js` now also renders a "Your
    team's decisions" panel listing each teammate by name with their
    live status ("hasn't chosen yet" / "currently leaning X" /
    "finalized on X"), sourced from the same `mafia.selections`
    projection the aggregate badges already used — no backend change
    needed for this part, just a fuller use of data that was already
    being sent.

38. **Reconnection during a Mafia action needed no new backend
    mechanism** — it was validated, not built. The existing private/
    Mafia-faction projections (returned on every authenticated `getRoom`
    poll, per Phase 3's design) already restore a player's own
    unfinalized-or-finalized selection and their teammates' current
    state on any fresh load, including a genuine page reload mid-night.
    This phase added explicit backend and real-browser tests confirming
    that specifically (reload after a non-finalized pick; resume and
    finalize normally afterward; teammates who never disconnected see
    no interruption in their view of the reconnected player).

## Phase 7

39. **Two real bugs found by systematically testing each reliability
    scenario against its exact wording, not just "does it seem to work."**
    - `joinRoomRecord_` checked `room.phase !== "LOBBY"` *before* checking
      whether the request was actually a legitimate reconnect (matching
      `playerId` + `sessionToken` already in the room). This meant a
      genuinely-already-joined player calling `joinRoom` again after the
      game started — e.g. a stray resubmission from a join screen left
      open, or a retried request — was incorrectly told "the game has
      already started" instead of being recognized and let back in. Fixed
      by checking for a matching reconnect first, regardless of phase;
      only a genuinely *new* join attempt is still blocked once a game is
      underway.
    - The Phase 6 finalize-lock fix (a Mafia member can't change their
      target after finalizing) was *too* strict: it also rejected an
      exact duplicate resubmission of the same already-finalized target —
      which is exactly what a network-level retry of a player's own
      request looks like. Fixed so only a genuine *change* to a different
      target is rejected; resubmitting the identical target is now a
      harmless no-op. Both were caught by writing tests for the literal
      scenario names in `CLAUDE_PROJECT_INSTRUCTIONS.md`'s Phase 7 list
      ("duplicate requests") rather than assuming the existing design
      already covered them.

40. **Visibility-aware polling was added for the "phone lock" scenario.**
    There was previously no `visibilitychange` handling at all:
    `ARCHITECTURE.md` §19's "reduce polling when the app is backgrounded"
    guidance wasn't implemented, and a backgrounded tab would show stale
    data for however long was left on its last scheduled poll after being
    unlocked. `roomStore.js`'s `subscribeRoom` now slows to a 30-second
    interval while `document.hidden` is true, and fires an immediate
    poll the instant the tab becomes visible again — verified with a
    real browser test that toggles `document.hidden` mid-game and
    confirms the tab catches up promptly rather than waiting out the
    slow interval.

41. **Host disconnect and total player disconnect were confirmed to
    need no special-case handling, by design.** No in-game action
    (`acknowledgeRole`, `submitNightAction`, `submitVote`) checks host
    status — only `startGame` does, and only while still in the LOBBY.
    Once a game is running, the backend's deadline-driven phase
    resolution doesn't care whether the host (or any specific player) is
    present; an absent player just has no effect on that phase's
    outcome, identical to any other AFK player. Tested explicitly: a
    game where the host never acts again after starting it, and a
    separate game where a living player never acts at all, both still
    progress correctly to resolution via the existing timeout mechanism.

42. **A dead Mafia member's reconnect correctly loses the live
    Mafia-faction view.** `toMafiaProjection_` already gated on
    `player.alive` before this phase (see Phase 4/5's leak-prevention
    work) — Phase 7 added an explicit test confirming this holds
    specifically through a *reconnect* after death, not just while
    already dead and never having left. A dead player still sees their
    own historical role (not a live secret) but not their former team's
    ongoing coordination, matching the general principle that death ends
    a player's need for privileged live information, not their identity.

43. **"Phase changes while disconnected" was tested across multiple
    missed rounds, not just one.** A player who disconnects during round
    1's NIGHT and doesn't reconnect until round 2's DAY (having missed an
    entire night-day-discussion-voting-night cycle) lands exactly on the
    current real phase and round on reconnect, with both rounds' deaths
    correctly reflected in their history and no stale round-1 private
    state (like an old night action) leaking into the fresh view. This
    was a natural consequence of the stateless-per-request polling design
    (every `getRoom` call computes projections fresh from current state,
    never from what the caller last saw) rather than something that
    needed new code — but it's exactly the kind of assumption worth
    testing explicitly rather than leaving implicit.

## Phase 8

44. **Service worker updates deliberately do NOT force a page reload.**
    The service worker already used `skipWaiting()`/`clients.claim()`
    (in place since Phase 1) so a new version takes over promptly in the
    background — but silently reloading a player's page out from under
    them mid-vote to apply that update would be far more disruptive than
    letting the update wait. `layout.js`'s `initUpdatePrompt()` instead
    shows a small, dismissible, non-forcing toast ("A new version has
    loaded — Refresh") the moment a *second* service worker takes
    control (the first-ever install is deliberately not treated as an
    "update", since there was nothing to update from). The player decides
    when to refresh — e.g., once the current game ends — rather than
    having it decided for them. Verified with a real test that swaps the
    service worker file on disk mid-session and confirms the toast
    appears without any forced navigation.

45. **A visible offline indicator was added — `navigator.onLine`/
    `online`/`offline` events, not inferred from failed requests.**
    Previously the only feedback for a lost connection was silent
    polling backoff (Phase 7) — correct for the underlying reliability,
    but gave the player no visible signal that anything was wrong versus
    the app just being slow. `layout.js`'s `initOfflineIndicator()` shows
    a persistent top banner whenever the browser itself reports no
    connectivity, and removes it the instant connectivity returns. This
    is explicitly a hint for the player, not an authority the rest of
    the app depends on — `roomStore.js`'s actual request handling and
    backoff logic (Phase 7) works identically regardless of whether this
    banner is showing.

46. **Manifest gained an explicit `id` field.** Modern PWA installability
    guidance recommends a stable `id` independent of `start_url`, so an
    installed app's identity doesn't get treated as "new" if `start_url`
    or query parameters ever change across a future deploy. Set to `"."`
    to match the existing `scope`.

47. **Real installability and offline behavior were tested, not just
    assumed from the presence of a manifest and service worker file.**
    A real headless browser was used to: fetch and validate every
    manifest field and icon URL actually resolves; confirm the service
    worker actually reaches the `activated` state and its cache actually
    contains the expected files under the current `CACHE_VERSION`; and —
    the test that matters most — actually go offline
    (`browserContext.setOffline(true)`) after a first load and confirm
    the app shell genuinely renders and client-side navigation genuinely
    works with zero network access, not merely that the caching code
    exists.

48. **No app screenshots were added to the manifest.** Richer desktop
    install-prompt screenshots are optional PWA polish with real
    production value mainly for desktop Chrome's install dialog — for a
    phone-first game meant to be added via "Add to Home Screen," the
    effort of producing accurate, meaningful screenshots wasn't
    justified relative to the phases still ahead. Revisit during Phase
    10's final polish if there's time.

## Phase 9

Before writing any code, every backend file was re-read against
CLAUDE_PROJECT_INSTRUCTIONS.md's Phase 9 checklist item by item. Several
items ("prevent unauthorized room access," "prevent invalid role
actions," "prevent actions after deadline," "prevent dead players
voting," "prevent stale state overwrites") were already fully
implemented since earlier phases and are noted below as *verified*
rather than *added*. Two items had no implementation at all yet
("structured error messages," "audit/event history") and are the bulk
of this phase's actual new code. A few concrete, previously-unnoticed
bugs also turned up during the re-read and are fixed here too.

49. **Every rejected request now carries a structured `code` alongside
    its existing human-readable `error` string.** A shared `ERR`
    constant map lives in `apps-script/Utils.gs`; `Validation.gs`,
    `Rooms.gs`, and `GameEngine.gs` attach a code to every rejection
    they return, `Api.gs` forwards it, and `Responses.gs`'s
    `errorResponse_()` puts it in the JSON envelope. This is additive —
    no `error` message text changed, so nothing that already worked
    (e.g. `showToast(result.error)` call sites) needed to change on its
    own account. The value of the codes is that a screen can now react
    to a *kind* of failure without parsing English text (see #52 below
    for the concrete case this made possible).

50. **`Code.gs`'s `doGet`/`doPost` are now wrapped in a top-level
    try/catch.** Previously, any uncaught exception anywhere in the
    engine (a bug, `LockService` timing out, a corrupt read) would let
    Apps Script's own raw HTML error page escape as the HTTP response.
    That isn't valid JSON, so `apiClient.js`'s `res.json()` would fail
    to parse it, and the player would see a confusing "the server sent
    back something unexpected" with no real explanation of what
    actually went wrong. `handleUncaughtError_()` (`Utils.gs`) now
    catches this, logs the real error and stack via `Logger.log` (which
    only the deploying host can see, via the Apps Script editor's
    execution log), and returns a safe, generic, well-formed JSON error
    response instead. `withLock_()`'s existing "server is busy" error
    is tagged with `ERR.SERVER_BUSY` specifically, so that case reaches
    the player as a clear, accurate message rather than the generic
    fallback.

51. **A durable per-room audit log (`room.auditLog`) was added, and
    deliberately never exposed through any API response.** Every
    successful state-changing action appends one compact entry
    (`{at, action, by, revision, detail}`) via `recordAudit_()`
    (`Utils.gs`), capped to the last 200 entries per room. This was
    designed around one hard constraint: it must add **zero** extra
    Drive writes, per ARCHITECTURE.md §19 and this project's existing
    quota-consciousness (Phase 3's persistence design already avoids
    writing on every request). `recordAudit_()` is therefore only ever
    called immediately before a `writeRoom_()` that was going to happen
    anyway — it rides along for free. Rejected/invalid requests are
    NOT logged here (that would mean a Drive write on every failed
    request, including retries or abuse) — those go to `Logger.log`
    only, via #50 above, which costs no Drive quota.

    The harder decision was *never returning this to any client, not
    even the host*. Which players called `submitNightAction` on a given
    night is itself partial role information — only non-Villagers ever
    do — so exposing the log through the game's own API, even
    host-only, would violate the same "host gets no hidden information"
    principle (CLAUDE_PROJECT_INSTRUCTIONS.md §14) the rest of the
    backend already enforces. It's readable only by opening the room's
    JSON file directly in the host's own Drive folder — the same
    trusted zone that already stores `room.game.roles` in plaintext
    since Phase 3/4 (ARCHITECTURE.md §3's "host's Drive" is a trusted
    zone), so this adds no new privacy exposure beyond what already
    exists there. If a host ever needs to settle a dispute ("did the
    app actually resolve that vote correctly?"), they can open
    `rooms/<code>.json` in Drive and read the trail directly — nothing
    in-game surfaces it.

52. **Bug found: a single failed request could make a live room falsely
    flash "This room isn't available."** `roomStore.js`'s old
    `getRoomState()` caught every error internally and collapsed it to
    `null`; `subscribeRoom`'s poll loop treated *any* `null` result —
    whether from a genuinely deleted room or a one-off network hiccup
    or Apps Script being briefly busy — identically, by telling
    `lobby.js` the room is gone. That undermined part of Phase 7's own
    reliability work (backoff-and-retry) by making a transient failure
    indistinguishable from a permanent one. Fixed using the new error
    codes from #49: `getRoomState()` now lets failures propagate
    instead of swallowing them, and `subscribeRoom`'s poll loop only
    reports "room: null" when the backend affirmatively answers with
    `ERR.ROOM_NOT_FOUND` — any other failure just backs off and quietly
    retries, leaving whatever the screen was already showing in place.
    `lobby.js`'s very first (pre-polling) load was updated to match:
    it only shows the "not available" screen on a confirmed
    `ROOM_NOT_FOUND`; any other failure leaves the loading placeholder
    up until the first successful poll a few seconds later.

53. **Bug found: several action buttons could get stuck permanently
    disabled with no explanation on a rejected request.**
    `night.js` (target picks, skip, Mafia finalize), `voting.js` (vote
    picks), `roleReveal.js` ("Got it"), and `lobby.js`'s ready toggle
    all disabled their button immediately, then only ever re-drew or
    re-enabled it on *success* — a rejected request (session expired,
    wrong phase from a race with a timeout, a network blip) left the
    button disabled with zero feedback, since nothing else was going to
    trigger a re-render. All five now show `showToast(result.error)`
    and restore the control to its pre-click state on any `result.error`,
    using the codes from #49 as context for anyone extending this later
    (e.g. a future phase could special-case `ALREADY_FINALIZED`
    differently from `SESSION_INVALID` if that becomes worth doing —
    not done here, to keep this phase's scope to what's actually
    broken today).

54. **Verified, not changed: several Phase 9 checklist items were
    already fully correct.**
    - *Prevent stale state overwrites* — `LockService.getScriptLock()`
      in `withLock_()` (`Utils.gs`) already serializes every mutating
      request script-wide, and every handler already follows
      read-inside-lock -> validate -> mutate -> write, so a lost update
      is already structurally impossible, not just usually avoided.
    - *Prevent actions after deadline* — every mutating handler already
      calls `resolvePendingTimeouts_()` before checking the current
      phase, so a request arriving after a deadline either finds the
      room already moved to the next phase (and is rejected as
      `WRONG_PHASE`) or triggers that transition itself first.
    - *Prevent dead players voting/acting* — already checked explicitly
      in both `submitVoteRecord_` and `submitNightActionRecord_`.
    - *Prevent duplicate player identities* — `joinRoomRecord_`'s
      existing "id collision fallback" path (Phase 3, decision #14)
      already guarantees `room.players` can never end up with two
      entries sharing one `id`: a colliding id always gets a
      freshly-minted replacement, never a silent overwrite or a second
      copy. Re-read carefully for this phase and found sound as-is.
    No code changes were made for these four — re-verifying them was
    the work.

55. **Testing for this phase used a purpose-built, minimal mocked-GAS
    harness, not the original 301-assertion suite.** The uploaded
    codebase (this chat's starting point) didn't include the `tests/`
    directory referenced in earlier phases' history — only the
    deployable `apps-script/` and frontend source were present. Rather
    than skip testing, a small Node `vm`-based harness (mocking
    `DriveApp`, `LockService`, `Logger`, `ContentService`, `Utilities`,
    `MimeType`) was written to load and exercise the real `.gs` files
    end-to-end for this phase's specific changes: every new error code
    path, the lock-busy path, an injected uncaught exception (confirming
    it returns well-formed JSON rather than crashing), and confirming
    the audit log is populated in Drive but never appears anywhere in
    an API response body. This harness is intentionally not included in
    the delivered zip (it's a throwaway smoke test, not a maintained
    suite) — if a full regression suite is wanted going forward, it
    should be rebuilt or restored from wherever the original `tests/`
    directory lives outside this chat's uploaded snapshot.

## Phase 10

Frontend-only phase — no `apps-script/*.gs` files were touched, so
nothing here changes the backend deployment (see the phase's own README
update instructions, unchanged).

56. **Accessibility contrast audit — two real WCAG AA failures fixed,
    one accepted near-miss documented.** `DESIGN.md`'s own
    badge-success/badge-attention pairings (white text on
    `{colors.success}`/`{colors.attention}`) were computed at ~3.3:1 and
    ~2.0:1 against white — both fail the 4.5:1 text threshold at the
    12px badge size used here. Fixed with two new tokens
    (`--color-success-strong`, a darkened green kept white-on-top; and
    swapping badge-attention's text to `--color-ink-deep`, mirroring
    DESIGN.md's own badge-promo-yellow pairing rather than inventing a
    new one). Separately, `.field-error`'s text (`--color-critical-strong`
    on canvas) measured ~4.1:1 — just under threshold — fixed with a new
    `--color-critical-text` token, themed per light/dark mode since a
    color tuned for a white canvas fails on the dark one and vice versa
    (light: `#c31c40`, ~5.9:1; dark: `#ff5470`, ~5.7:1). One near-miss was
    *not* chased further: `--color-critical-strong` itself against the
    dark canvas measures ~4.34:1, just under 4.5:1 — left as-is since it's
    only used for borders/UI-component boundaries in dark mode (3:1
    threshold, comfortably passes), not body text. All button/status
    text colors (ink/ink-deep/steel-on-canvas combinations) were spot
    checked and clear 5:1+ with wide margins.

57. **A real, pre-existing bug was found and fixed: `.badge-critical` had
    no CSS definition at all.** `gameOver.js` (the Mafia role badge),
    `night.js`, and `day.js` (the "Out" status badge) all reference
    `class="badge badge-critical"`, but `components.css` only ever
    defined `.badge-success` and `.badge-attention` — `.badge-critical`
    fell through to unstyled plain text with no pill background, on
    every screen that used it, since whichever earlier phase introduced
    it. Caught by this phase's render-harness testing (see item 59)
    rather than by inspection — it's exactly the kind of gap that's easy
    to miss reading code but obvious the moment the actual DOM output is
    screenshotted. Fixed by adding the missing rule using the existing
    `--color-critical` token (white text, ~4.6:1, already clears the
    same threshold the two fixes above needed new tokens for).

58. **Dark-mode tokens (Phase 1, item 3) — reviewed, not changed.**
    Flagged since Phase 1 as "a placeholder direction, not a captured
    brand decision." Re-audited now: computed contrast for every
    text/surface pairing in the dark block (ink-deep/ink/steel-on-canvas,
    on-primary/on-ink-button-on-CTA) and all clear AA with comfortable
    margins (5:1+). No DESIGN.md dark-mode spec exists to defer to
    (confirmed again in its own "Known Gaps" section), so this system's
    values are adopted as the final direction rather than left as an
    open placeholder.

59. **Testing used a local static server plus two purpose-built
    Playwright scripts, not the (unavailable in this chat) original
    301-assertion suite** — consistent with Phase 9's approach (item 55).
    One script drove the actual compiled app through a browser
    (landing → create/join, including the "backend not configured" and
    validation-error paths, dark mode, and `prefers-reduced-motion`) and
    checked for thrown page errors. The other imported the real screen
    modules (`night.js`, `day.js`, `voting.js`, `roleReveal.js`,
    `gameOver.js`) directly and rendered them against fabricated
    `room`/`private`/`mafia` state — covering the Mafia-coordination
    view, Doctor/Seer/Trickster/Resurrector branches, the Seer's result
    history, a critical (≤10s) timer, and both Town/Trickster game-over
    outcomes — without needing a live Apps Script backend. Neither
    script is included in the delivered zip.

60. **No app screenshots were added to the manifest (Phase 8, item 48)
    — deferred again, now finally.** Re-read at the top of this phase as
    instructed; the reasoning holds (phone-first "Add to Home Screen"
    installs don't surface the desktop install-dialog screenshots this
    would serve) and there's no higher-value use for the effort this
    phase. Treat as closed, not "revisit next time" — there is no next
    phase after Polish in the current plan.

61. **No new files were added to the shipped app.** Every Phase 10
    change fit into existing files (`tokens.css`, `base.css`,
    `components.css`, `layout.js`, `roomStore.js`, `app.js`,
    `index.html`, and the screen modules that needed a busy-button or
    empty-state call site). `service-worker.js`'s `CACHE_VERSION` was
    bumped (`v6` → `v7`) so installed PWA clients pick up the changed
    assets on next load rather than serving stale cached CSS/JS.
