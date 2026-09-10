/**
 * roomStore
 *
 * Phase 2's acceptance test is "several browser tabs can simulate a
 * lobby" — there is still no real backend (that's Phase 3, Apps
 * Script), so this module simulates one using the one thing multiple
 * browser tabs of the same origin already share: localStorage. Each
 * room is one localStorage entry, keyed by room code. Every tab that
 * touches a room reads-modifies-writes that entry, and other tabs pick
 * up the change via the native `storage` event (which fires in every
 * *other* tab, but not the one that made the change — that tab already
 * has the fresh value from its own call).
 *
 * This intentionally mirrors the shape ARCHITECTURE.md describes for
 * the real backend's room object and its "public projection" (§4, §6),
 * so Phase 3 can swap this module for real API calls without the
 * screens needing to change: same function names, same room shape.
 *
 * Known limitation: this only syncs across tabs of the *same browser*.
 * It cannot simulate multiple physical devices — that requires Phase 3's
 * real backend. See DECISIONS.md.
 */

import { getOrCreatePlayerId } from "../services/identityService.js";
import { generateRoomCode } from "../utils/roomCode.js";

const ROOM_KEY_PREFIX = "mafia.room.";

function roomKey(code) {
  return `${ROOM_KEY_PREFIX}${code}`;
}

function readRoom(code) {
  try {
    const raw = window.localStorage.getItem(roomKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRoom(room) {
  try {
    window.localStorage.setItem(roomKey(room.roomCode), JSON.stringify(room));
  } catch {
    // Storage unavailable — the room simply won't be visible to other tabs.
  }
  return room;
}

/**
 * Creates a room with the current tab's player as host.
 * Retries on the (extremely unlikely) chance of a code collision.
 */
export function createRoom(roomName, hostName) {
  const playerId = getOrCreatePlayerId();

  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateRoomCode();
    if (!readRoom(code)) break;
  }

  const room = {
    roomCode: code,
    roomName: roomName.trim() || "Untitled Room",
    phase: "LOBBY",
    hostPlayerId: playerId,
    revision: 1,
    players: [
      { id: playerId, name: hostName.trim() || "Host", isHost: true, ready: false, alive: true },
    ],
  };

  return writeRoom(room);
}

/**
 * Joins an existing room by code. Returns { room } on success or
 * { error } on failure ("NOT_FOUND" | "ALREADY_STARTED").
 * Reconnect-safe: if this tab's player id is already in the room
 * (e.g. a refresh), it's treated as the same player, not a duplicate.
 */
export function joinRoom(code, playerName) {
  const room = readRoom(code);
  if (!room) return { error: "NOT_FOUND" };
  if (room.phase !== "LOBBY") return { error: "ALREADY_STARTED" };

  const playerId = getOrCreatePlayerId();
  const existing = room.players.find((p) => p.id === playerId);

  if (existing) {
    existing.name = playerName.trim() || existing.name;
  } else {
    room.players.push({
      id: playerId,
      name: playerName.trim() || "Player",
      isHost: false,
      ready: false,
      alive: true,
    });
  }

  room.revision += 1;
  return { room: writeRoom(room) };
}

export function getRoom(code) {
  return readRoom(code);
}

export function setOwnReady(code, ready) {
  const room = readRoom(code);
  if (!room) return null;
  const playerId = getOrCreatePlayerId();
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  player.ready = ready;
  room.revision += 1;
  return writeRoom(room);
}

/** Explicit, deliberate leave (e.g. tapping back) — removes the player from the lobby list. */
export function leaveRoom(code) {
  const room = readRoom(code);
  if (!room) return null;
  const playerId = getOrCreatePlayerId();
  room.players = room.players.filter((p) => p.id !== playerId);
  room.revision += 1;
  if (room.players.length === 0) {
    try {
      window.localStorage.removeItem(roomKey(code));
    } catch {
      // Non-fatal — an empty stale room entry just lingers until overwritten.
    }
    return null;
  }
  return writeRoom(room);
}

/**
 * Subscribes to changes made to this room by OTHER tabs.
 * @returns {() => void} unsubscribe
 */
export function subscribeRoom(code, callback) {
  const key = roomKey(code);
  function handler(event) {
    if (event.key === key) {
      callback(readRoom(code));
    }
  }
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
