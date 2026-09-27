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
 *
 * Phase 9: every rejection returned to a screen now carries a `code`
 * alongside `error` (see apiClient.js / apps-script/Utils.gs's `ERR`),
 * and `subscribeRoom` uses it to tell a genuinely deleted room
 * (ROOM_NOT_FOUND) apart from a transient request failure — previously
 * both collapsed to the same "this room isn't available" result, so a
 * single dropped poll could flash a false "gone" message. See
 * DECISIONS.md.
 *
 * Phase 10: `subscribeConnectionStatus` exposes a device-wide
 * "reconnecting" signal once polling has failed a couple of times in a
 * row, for layout.js's reconnect banner — see DECISIONS.md.
 */

import { apiGet, apiPost } from "../services/apiClient.js";
import { getOrCreatePlayerId, setPlayerId, getSessionToken, setSessionToken } from "../services/identityService.js";

const POLL_INTERVAL_MS = 4000; // within ARCHITECTURE.md's suggested 3-5s lobby range
const POLL_BACKOFF_MAX_MS = 20000;
const BACKGROUND_POLL_INTERVAL_MS = 30000; // ARCHITECTURE.md §19: reduce polling when backgrounded
const RECONNECTING_AFTER_FAILURES = 2; // don't flag a single blip — only a real streak

/**
 * Phase 10: a small pub-sub so the UI (layout.js's initReconnectIndicator)
 * can show a "Reconnecting…" cue when polling is degraded — distinct from
 * the browser's own online/offline events, which don't fire for "Apps
 * Script is momentarily busy" or a flaky connection that never actually
 * drops. Deliberately separate from subscribeRoom's per-room callback:
 * connectivity is a device-wide concept, not a per-room one.
 */
const connectionListeners = new Set();
let consecutiveFailures = 0;

function notifyConnection(status) {
  connectionListeners.forEach((cb) => cb(status));
}

/** @param {(status: "online"|"reconnecting") => void} callback @returns {() => void} unsubscribe */
export function subscribeConnectionStatus(callback) {
  connectionListeners.add(callback);
  return () => connectionListeners.delete(callback);
}

export async function createRoom(roomName, hostName) {
  const playerId = getOrCreatePlayerId();
  const data = await apiPost("createRoom", { roomName, hostName, playerId });
  if (data.playerId !== playerId) setPlayerId(data.playerId);
  setSessionToken(data.room.roomCode, data.sessionToken);
  return data.room;
}

/** @returns {Promise<{room}|{error,code}>} */
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
    return { error: err.message, code: err.code };
  }
}

/**
 * Fetches the current room state. Unlike the other actions here, this
 * lets failures propagate (throws) rather than swallowing them into a
 * `null` — `subscribeRoom`'s poll loop below is the only caller, and it
 * needs to distinguish "the room is genuinely gone" from "this one
 * request failed" to avoid the false-negative described above.
 * @returns {Promise<{room, private, mafia}>}
 */
export async function getRoomState(roomCode) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  const data = await apiGet("getRoom", { roomCode, playerId, sessionToken: sessionToken || "" });
  return { room: data.room, private: data.private, mafia: data.mafia };
}

/** @returns {Promise<{room}|{error,code}>} */
export async function setOwnReady(roomCode, ready) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid.", code: "SESSION_INVALID" };

  try {
    const data = await apiPost("setReady", { roomCode, playerId, sessionToken, ready });
    return { room: data.room };
  } catch (err) {
    return { error: err.message, code: err.code };
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

/** @returns {Promise<{room,private,mafia}|{error,code}>} */
export async function startGame(roomCode) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid.", code: "SESSION_INVALID" };

  try {
    const data = await apiPost("startGame", { roomCode, playerId, sessionToken });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message, code: err.code };
  }
}

/** @returns {Promise<{room,private,mafia}|{error,code}>} */
export async function acknowledgeRole(roomCode) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid.", code: "SESSION_INVALID" };

  try {
    const data = await apiPost("acknowledgeRole", { roomCode, playerId, sessionToken });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message, code: err.code };
  }
}

/**
 * @param {string} roomCode
 * @param {string} [targetPlayerId] required unless `skip` is true
 * @param {boolean} [finalized] Mafia-only: locks in the choice for the unanimity check
 * @param {boolean} [skip] Doctor/Seer/Trickster/Resurrector only: explicitly
 *   choosing not to act tonight rather than leaving it ambiguous
 * @returns {Promise<{room,private,mafia}|{error,code}>}
 */
export async function submitNightAction(roomCode, targetPlayerId, finalized, skip) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid.", code: "SESSION_INVALID" };

  try {
    const data = await apiPost("submitNightAction", { roomCode, playerId, sessionToken, targetPlayerId, finalized, skip });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message, code: err.code };
  }
}

/** @returns {Promise<{room,private,mafia}|{error,code}>} */
export async function submitVote(roomCode, targetPlayerId) {
  const playerId = getOrCreatePlayerId();
  const sessionToken = getSessionToken(roomCode);
  if (!sessionToken) return { error: "Your session for this room is no longer valid.", code: "SESSION_INVALID" };

  try {
    const data = await apiPost("submitVote", { roomCode, playerId, sessionToken, targetPlayerId });
    return { room: data.room, private: data.private, mafia: data.mafia };
  } catch (err) {
    return { error: err.message, code: err.code };
  }
}

/**
 * Polls the backend for changes to `roomCode`, calling
 * `callback({ room, private, mafia })` only when the room's revision
 * actually changes (or the room disappears, in which case `room` is null).
 *
 * Backgrounding-aware (phone lock, switching apps): while the tab is
 * hidden, polling slows to `BACKGROUND_POLL_INTERVAL_MS` rather than
 * stopping entirely — per ARCHITECTURE.md §19's "reduce polling when the
 * app is backgrounded." The moment the tab becomes visible again, a
 * fresh poll fires immediately rather than waiting out whatever's left
 * of the slow interval, so unlocking the phone shows current state
 * right away instead of stale data for up to 30 seconds.
 *
 * Phase 9: a request that merely FAILS (network hiccup, Apps Script
 * momentarily busy, etc.) no longer reports "room: null" — only a
 * request that the backend affirmatively answers with ROOM_NOT_FOUND
 * does. Everything else just backs off and quietly retries, keeping
 * whatever the screen was already showing.
 *
 * @returns {() => void} stop polling
 */
export function subscribeRoom(roomCode, callback) {
  let stopped = false;
  let lastRevision = null;
  let currentInterval = POLL_INTERVAL_MS;
  let timeoutId = null;

  function effectiveInterval() {
    const backgrounded = typeof document !== "undefined" && document.hidden;
    return backgrounded ? Math.max(currentInterval, BACKGROUND_POLL_INTERVAL_MS) : currentInterval;
  }

  async function poll() {
    if (stopped) return;

    try {
      const state = await getRoomState(roomCode);
      currentInterval = POLL_INTERVAL_MS; // reset backoff on success

      if (consecutiveFailures >= RECONNECTING_AFTER_FAILURES) notifyConnection("online");
      consecutiveFailures = 0;

      if (state.room.revision !== lastRevision) {
        lastRevision = state.room.revision;
        callback(state);
      }
    } catch (err) {
      if (err && err.code === "ROOM_NOT_FOUND") {
        // The backend affirmatively confirmed this room is gone — this is a
        // real, terminal state change, not a transient failure, and it says
        // nothing about connectivity.
        consecutiveFailures = 0;
        if (lastRevision !== null) {
          lastRevision = null;
          callback({ room: null, private: null, mafia: null });
        }
      } else {
        // Some other failure (network hiccup, Apps Script momentarily busy,
        // malformed response, etc.) — back off and retry, but don't tell the
        // screen the room is gone based on a single failed request.
        currentInterval = Math.min(currentInterval * 2, POLL_BACKOFF_MAX_MS);
        consecutiveFailures += 1;
        if (consecutiveFailures === RECONNECTING_AFTER_FAILURES) notifyConnection("reconnecting");
      }
    }

    if (!stopped) {
      timeoutId = setTimeout(poll, effectiveInterval());
    }
  }

  function handleVisibilityChange() {
    if (stopped) return;
    if (!document.hidden) {
      // Tab just came back into view -- don't make the player wait out
      // whatever's left of a slow background interval.
      if (timeoutId) clearTimeout(timeoutId);
      poll();
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  timeoutId = setTimeout(poll, effectiveInterval());

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}
