/**
 * Utils.gs — small, dependency-free helpers used across the backend.
 */

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
    throw new Error("The server is busy, please try again.");
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
