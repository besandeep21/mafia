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

4. **QR code is a visual placeholder in Phase 1's mock lobby.** The lobby
   screen shows a static decorative QR-like graphic next to the real
   join URL (built from `shareService.buildJoinUrl`) and a "Share join
   link" button that uses the Web Share API / clipboard. A real,
   scannable QR encoding of the backend-issued join URL is deferred to
   the phase that introduces real room codes/tokens (Phase 2/3), since
   encoding a mock URL that no backend will resolve isn't useful to
   build correctly twice.

5. **Mock lobby includes simulated companion players** (e.g. "Priya",
   "Arjun") so the Create/Join flow has something believable to land on.
   These are in-memory only, not persisted, not synced across tabs/
   devices, and clearly scoped to `state/mockState.js` so Phase 2/3 can
   delete this module wholesale once real multiplayer state exists.

6. **Player display name is required**, room name is optional (defaults
   to "Untitled Room"). `GAME_RULES.md`/`ARCHITECTURE.md` don't specify
   required fields at creation; requiring a name matches "every player
   gets a random persistent player ID" plus a human-readable name for
   the player list.

7. **Montserrat is used as the display/body typeface**, per DESIGN.md's
   own documented fallback chain for Optimistic VF (a proprietary Meta
   typeface Claude cannot use): "Montserrat, Helvetica, Arial, Noto Sans."
