/**
 * roomStore
 *
 * Phase 3 replaces Phase 2's localStorage-simulated backend with real
 * HTTP calls to the deployed Apps Script Web App. Every function here
 * keeps the same name/shape screens already call (createRoom, joinRoom,
 * getRoom, setOwnReady, leaveRoom, subscribeRoom) — only now they're
 * async and can fail over the network, which screens must handle.
 *
 * There is still no push mechanism (Apps Script Web Apps can't do
 * WebSockets), so subscribeRoom polls, per ARCHITECTURE.md §19's quota
 * guidance: every few seconds, with backoff on failure, and an
 * immediate one-off refresh right after this device's own actions
 * (already covered since create/join/setOwnReady return the fresh room
 * directly from their own response).
 */

import { apiGet, apiPost } from "../services/apiClient.js";
import {
  getOrCreatePlayerId,
  setPlayerId,
  getSessionToken,
  setSessionToken,
} from "../services/identityService.js";

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

export async function getRoom(roomCode) {
  try {
    const data = await apiGet("getRoom", { roomCode });
    return data.room;
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

/**
 * Polls the backend for changes to `roomCode`, calling `callback(room)`
 * only when the revision actually changes (or the room disappears).
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
      const room = await getRoom(roomCode);
      currentInterval = POLL_INTERVAL_MS; // reset backoff on success

      if (!room) {
        if (lastRevision !== null) {
          lastRevision = null;
          callback(null);
        }
      } else if (room.revision !== lastRevision) {
        lastRevision = room.revision;
        callback(room);
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
