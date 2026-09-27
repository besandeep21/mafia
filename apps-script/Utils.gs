/**
 * Utils.gs — small, dependency-free helpers used across the backend.
 */

/**
 * Structured error codes, per CLAUDE_PROJECT_INSTRUCTIONS.md Phase 9
 * ("Add structured error messages"). Every rejected request already had
 * a human-readable `error` string; this adds a stable machine-readable
 * `code` alongside it so the frontend can react differently to
 * different failure kinds (e.g. treat a genuinely deleted room
 * differently from a transient network hiccup) without parsing English
 * text. The message strings themselves are unchanged. See DECISIONS.md.
 */
const ERR = {
  INVALID_INPUT: "INVALID_INPUT",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_CODE_EXHAUSTED: "ROOM_CODE_EXHAUSTED",
  SESSION_INVALID: "SESSION_INVALID",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  NOT_HOST: "NOT_HOST",
  NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
  WRONG_PHASE: "WRONG_PHASE",
  DEAD_PLAYER: "DEAD_PLAYER",
  NO_ACTION: "NO_ACTION",
  INVALID_TARGET: "INVALID_TARGET",
  SELF_TARGET_FORBIDDEN: "SELF_TARGET_FORBIDDEN",
  ALREADY_FINALIZED: "ALREADY_FINALIZED",
  ABILITY_USED: "ABILITY_USED",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
  MALFORMED_REQUEST: "MALFORMED_REQUEST",
  SERVER_BUSY: "SERVER_BUSY",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

/**
 * Caps the durable, Drive-persisted event trail per room (see
 * `recordAudit_` below). A full game realistically produces a few dozen
 * to (generously) a couple hundred entries; 200 leaves comfortable
 * headroom without letting the room file grow unbounded across an
 * unusually long session.
 */
const MAX_AUDIT_ENTRIES = 200;

/**
 * Appends one compact record to `room.auditLog`, per
 * CLAUDE_PROJECT_INSTRUCTIONS.md Phase 9 ("Add audit/event history").
 *
 * Deliberately called only at points that were already about to call
 * `writeRoom_` anyway — this never triggers an *extra* Drive write on
 * its own, honoring ARCHITECTURE.md §19's "avoid excessive Drive
 * writes." Rejected/invalid requests are NOT recorded here (that would
 * mean writing to Drive on every failed request, including retries and
 * attacks) — genuinely unexpected failures are instead sent to
 * `Logger.log` by `handleUncaughtError_`, which costs no Drive quota.
 *
 * This is intentionally never returned by any API response — not even
 * to the host. Which players called `submitNightAction` on a given
 * night would itself leak partial role information (only non-Villagers
 * ever do), so exposing this log through the game's API would violate
 * the same "host gets no hidden information" principle the rest of the
 * backend enforces. It's readable only by opening the room's JSON file
 * directly in the host's Drive — the same trusted zone that already
 * stores `room.game.roles` in plaintext (see ARCHITECTURE.md §3), so
 * this adds no new privacy exposure beyond what already exists there.
 *
 * @param {object} room
 * @param {string} action e.g. "createRoom", "submitVote", "nightResolved"
 * @param {string|null} playerId the acting player, or null for a
 *   system/timeout-driven transition with no single actor
 * @param {string} [detail] short human-readable context, e.g. "round 2"
 */
function recordAudit_(room, action, playerId, detail) {
  if (!room.auditLog) room.auditLog = [];
  room.auditLog.push({
    at: nowIso_(),
    action: action,
    by: playerId || null,
    revision: room.revision,
    detail: detail || null,
  });
  if (room.auditLog.length > MAX_AUDIT_ENTRIES) {
    room.auditLog = room.auditLog.slice(room.auditLog.length - MAX_AUDIT_ENTRIES);
  }
}

/**
 * Logs an unexpected, uncaught exception (never a normal validation
 * rejection — those already return a structured `{ok:false}` response
 * on their own) and turns it into a safe, generic JSON error response
 * instead of letting Apps Script's raw HTML error page reach the
 * client, which the frontend can't parse as JSON. Real detail goes to
 * `Logger.log` (visible to the deploying host via Apps Script's own
 * execution log/Stackdriver), never to the player's browser.
 */
function handleUncaughtError_(err) {
  Logger.log("Unhandled error: " + (err && err.stack ? err.stack : err));
  const code = (err && err.code) || ERR.INTERNAL_ERROR;
  const message =
    code === ERR.SERVER_BUSY
      ? "The server is busy, please try again."
      : "Something went wrong on the server. Please try again.";
  return errorResponse_(message, code);
}

/**
 * Generates a random 6-digit numeric room code.
 * Per ARCHITECTURE.md: this is for human entry only, never a security
 * credential — the separate sessionToken is what actually authorizes
 * mutating requests.
 */
function generateRoomCode_() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

/**
 * Generates an unpredictable per-player session token. Not a JWT or
 * anything cryptographically fancy — Utilities.getUuid() is backed by a
 * proper random UUID generator, which is enough entropy for this app's
 * threat model (a casual social game, not a financial system), and
 * keeps the backend dependency-free.
 */
function generateSessionToken_() {
  return Utilities.getUuid() + "-" + Utilities.getUuid();
}

function generatePlayerId_() {
  return Utilities.getUuid();
}

function nowIso_() {
  return new Date().toISOString();
}

/**
 * Runs `fn` while holding the script-level lock, per ARCHITECTURE.md §13
 * ("Use LockService around state mutations... Never assume requests
 * arrive sequentially"). One lock for the whole script (not per-room) is
 * a deliberate simplicity trade-off: it serializes writes across *all*
 * rooms, which only matters at a scale this app was never meant to run
 * at (see DECISIONS.md). Always releases the lock, even if `fn` throws.
 */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(10000);
  if (!gotLock) {
    const err = new Error("The server is busy, please try again.");
    err.code = ERR.SERVER_BUSY;
    throw err;
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
