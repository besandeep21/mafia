/**
 * roomStore
 *
 * Phase 3 replaced the localStorage mock with real HTTP calls to the
 * Apps Script backend. Phase 4 extends this with the game actions
 * (startGame, acknowledgeRole, submitNightAction, submitVote) and
 * switches polling to always send this device's identity, since the
 * backend now has private (own role) and Mafia-faction (teammates +
 * selections) projections to return alongside the public room — per
 * ARCHITECTURE.md §6, screens must never see more than they're
 * entitled to, so authenticating every poll is what makes that
 * enforcement possible without a separate request per projection.
 *
 * subscribeRoom's callback now receives `{ room, private, mafia }`
 * instead of a bare room object.
 */

import { apiGet, apiPost } from "../services/apiClient.js";
import { getOrCreatePlayerId, setPlayerId, getSessionToken, setSessionToken } from "../services/identityService.js";

const POLL_INTERVAL_MS = 4000; // within ARCHITECTURE.md's suggested 3-5s lobby range
const POLL_BACKOFF_MAX_MS = 20000;

export async function createRoom(roomName, hostName) {
  const playerId = getOrCreatePlayerId();
  const data = await apiPost("createRoom", { roomName, hostName, playerId });
  if (data.playerId !== playerId) setPlayerId(data.playerId);
  setSessionToken(data.room.roomCode, data.sessionToken);
  return data.room;
}

/** @returns {Promise<{room}|{error}>} */
export async function joinRoom(roomCode, playerName) {
  const playerId = getOrCreatePlayerId();
  const existingToken = getSessionToken(roomCode);

  try {
    const data = await apiPost("joinRoom", {
      roomCode,
      playerName,
      playerId,
      sessionToken: existingToken || undefined,
    });
    if (data.playerId !== playerId) setPlayerId(data.playerId);
    setSessionToken(roomCode, data.sessionToken);
    return { room: data.room };
  } catch (err) {
    return { error: err.message };
  }
}

/** @returns {Promise<{room, private, mafia}|null>} */
export async function getRoomState(roomCode) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  try {
    const data = await apiGet("getRoom", { roomCode, playerId, sessionToken: sessionToken || "" });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch {
    return null;
  }
}

export async function setOwnReady(roomCode, ready) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return null;

  try {
    const data = await apiPost("setReady", { roomCode, playerId, sessionToken, ready });
    return data.room;
  } catch {
    return null;
  }
}

export async function leaveRoom(roomCode) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return;

  try {
    await apiPost("leaveRoom", { roomCode, playerId, sessionToken });
  } catch {
    // Best-effort — if this fails the player just stays in the lobby list
    // until the room is otherwise cleaned up. Not worth surfacing an error
    // for what the player experiences as "I clicked back and left."
  }
}

/** @returns {Promise<{room,private,mafia}|{error}>} */
export async function startGame(roomCode) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid." };

  try {
    const data = await apiPost("startGame", { roomCode, playerId, sessionToken });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message };
  }
}

/** @returns {Promise<{room,private,mafia}|{error}>} */
export async function acknowledgeRole(roomCode) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid." };

  try {
    const data = await apiPost("acknowledgeRole", { roomCode, playerId, sessionToken });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message };
  }
}

/** @returns {Promise<{room,private,mafia}|{error}>} */
export async function submitNightAction(roomCode, targetPlayerId, finalized) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid." };

  try {
    const data = await apiPost("submitNightAction", { roomCode, playerId, sessionToken, targetPlayerId, finalized });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message };
  }
}

/** @returns {Promise<{room,private,mafia}|{error}>} */
export async function submitVote(roomCode, targetPlayerId) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid." };

  try {
    const data = await apiPost("submitVote", { roomCode, playerId, sessionToken, targetPlayerId });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Polls the backend for changes to `roomCode`, calling
 * `callback({ room, private, mafia })` only when the room's revision
 * actually changes (or the room disappears, in which case `room` is null).
 * @returns {() => void} stop polling
 */
export function subscribeRoom(roomCode, callback) {
  let stopped = false;
  let lastRevision = null;
  let currentInterval = POLL_INTERVAL_MS;
  let timeoutId = null;

  async function poll() {
    if (stopped) return;

    try {
      const state = await getRoomState(roomCode);
      currentInterval = POLL_INTERVAL_MS; // reset backoff on success

      if (!state || !state.room) {
        if (lastRevision !== null) {
          lastRevision = null;
          callback({ room: null, private: null, mafia: null });
        }
      } else if (state.room.revision !== lastRevision) {
        lastRevision = state.room.revision;
        callback(state);
      }
    } catch {
      // Back off on repeated failures (network hiccup, Apps Script quota, etc.)
      // rather than hammering a struggling backend.
      currentInterval = Math.min(currentInterval * 2, POLL_BACKOFF_MAX_MS);
    }

    if (!stopped) {
      timeoutId = setTimeout(poll, currentInterval);
    }
  }

  timeoutId = setTimeout(poll, currentInterval);

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}
