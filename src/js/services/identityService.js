/**
 * identityService
 *
 * Phase 1 stored player identity in localStorage, which is shared by
 * every tab of the same browser — fine for a single mock lobby, but it
 * breaks Phase 2's acceptance test ("several browser tabs can simulate
 * a lobby"), since every tab would resolve to the exact same player.
 *
 * sessionStorage is per-tab (each tab gets its own player id/name) while
 * still surviving a refresh within that tab, which is what
 * CLAUDE_PROJECT_INSTRUCTIONS.md's reconnection requirements actually need
 * at this stage. This is a testing-phase artifact: once Phase 3+ moves to
 * real separate physical devices, each device already has its own
 * browser storage, so this distinction stops mattering. See DECISIONS.md.
 *
 * Room data itself (state/roomStore.js) intentionally still uses
 * localStorage, since that's the thing multiple tabs need to *share* to
 * simulate a lobby before there's a real backend.
 */

const KEYS = {
  PLAYER_ID: "mafia.playerId",
  PLAYER_NAME: "mafia.playerName",
  LAST_ROOM_CODE: "mafia.lastRoomCode",
};

function safeGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota, etc.) — degrade silently.
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
