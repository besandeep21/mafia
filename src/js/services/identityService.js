/**
 * identityService
 *
 * Phase 2 stored identity in sessionStorage so multiple tabs in one
 * browser could simulate different players against the mock, tab-local
 * lobby. Now that Phase 3 introduces a real backend, that trick is no
 * longer appropriate: production reconnection needs identity to survive
 * a full browser close/reopen on the same device, which sessionStorage
 * doesn't do. localStorage is correct here — see DECISIONS.md.
 *
 * (To test with multiple simulated players against the real backend
 * from one machine now, use separate browser profiles or an incognito
 * window per player — each gets its own localStorage. Plain multiple
 * tabs of the same browser will all resolve to the same player, which
 * is the correct, expected behavior for a real device.)
 *
 * Session tokens are issued by the backend per room (see
 * apps-script/Rooms.gs) and are the actual authorization credential for
 * mutating requests — the backend never trusts a bare playerId. They're
 * stored per room code since a device could join more than one room
 * over time.
 */

const KEYS = {
  PLAYER_ID: "mafia.playerId",
  PLAYER_NAME: "mafia.playerName",
  LAST_ROOM_CODE: "mafia.lastRoomCode",
};

function sessionKey(roomCode) {
  return `mafia.session.${roomCode}`;
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota, etc.) — degrade silently.
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Non-fatal.
  }
}

function generatePlayerId() {
  if (window.crypto && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreatePlayerId() {
  let id = safeGet(KEYS.PLAYER_ID);
  if (!id) {
    id = generatePlayerId();
    safeSet(KEYS.PLAYER_ID, id);
  }
  return id;
}

/**
 * Overwrites this device's stored player id. Only needed for the rare
 * case where the backend couldn't honor the id this device asked for
 * (see apps-script/Rooms.gs's collision-fallback path) and assigned a
 * different one — the client must adopt whatever the server actually
 * used, or later requests (and its own lobby screen) won't recognize it.
 */
export function setPlayerId(id) {
  safeSet(KEYS.PLAYER_ID, id);
}

export function getStoredPlayerName() {
  return safeGet(KEYS.PLAYER_NAME) || "";
}

export function setStoredPlayerName(name) {
  safeSet(KEYS.PLAYER_NAME, name);
}

export function getLastRoomCode() {
  return safeGet(KEYS.LAST_ROOM_CODE) || "";
}

export function setLastRoomCode(code) {
  safeSet(KEYS.LAST_ROOM_CODE, code);
}

/** @returns {string|null} the session token this device holds for `roomCode`, if any. */
export function getSessionToken(roomCode) {
  return safeGet(sessionKey(roomCode));
}

export function setSessionToken(roomCode, token) {
  safeSet(sessionKey(roomCode), token);
}

export function clearSessionToken(roomCode) {
  safeRemove(sessionKey(roomCode));
}
