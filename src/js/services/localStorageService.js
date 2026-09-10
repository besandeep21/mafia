/**
 * localStorageService
 *
 * Per CLAUDE_PROJECT_INSTRUCTIONS.md and the master instructions:
 * local storage may hold player session / reconnection identity and
 * UI preferences, but is never the authoritative game database.
 * Phase 1 only needs a persistent player identity and a "last room"
 * hint so a later phase's reconnect flow has something to build on.
 */

const KEYS = {
  PLAYER_ID: "mafia.playerId",
  PLAYER_NAME: "mafia.playerName",
  LAST_ROOM_CODE: "mafia.lastRoomCode",
};

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
    // Session simply won't survive a refresh; this is a known limitation.
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
