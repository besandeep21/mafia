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
