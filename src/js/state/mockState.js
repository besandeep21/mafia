/**
 * Mock game state for Phase 1.
 *
 * There is no backend yet (Phase 3 introduces Apps Script). This module
 * simulates the shape of the "public projection" described in
 * ARCHITECTURE.md section 6 so that Phase 2/3 can replace the functions
 * below with real API calls without the screens needing to change.
 *
 * Nothing here is persisted or shared between browser tabs — it is
 * in-memory only, scoped to a single page session, purely to let the
 * Create/Join UI demonstrate a believable lobby.
 */

import { createStore } from "./gameStateStore.js";
import { generateRoomCode } from "../utils/roomCode.js";
import { getOrCreatePlayerId } from "../services/localStorageService.js";

const MOCK_COMPANIONS = ["Priya", "Arjun", "Neha", "Rohit", "Divya"];

const store = createStore({
  room: null, // shape mirrors the future public projection (ARCHITECTURE.md §6)
  ownPlayerId: null,
});

export function getMockState() {
  return store.getState();
}

export function subscribeMockState(listener) {
  return store.subscribe(listener);
}

/**
 * Creates a room with the current device as host, matching the public
 * projection shape: { roomName, phase, round, players, ... }.
 */
export function createMockRoom(roomName, hostName) {
  const ownPlayerId = getOrCreatePlayerId();
  const companionCount = 2 + Math.floor(Math.random() * 2); // 2-3 mock players
  const companions = MOCK_COMPANIONS.slice(0, companionCount).map((name, i) => ({
    id: `mock_${i}`,
    name,
    alive: true,
    ready: Math.random() > 0.4,
    isHost: false,
  }));

  const room = {
    roomCode: generateRoomCode(),
    roomName: roomName.trim() || "Untitled Room",
    phase: "LOBBY",
    players: [
      { id: ownPlayerId, name: hostName.trim() || "Host", alive: true, ready: true, isHost: true },
      ...companions,
    ],
  };

  store.setState({ room, ownPlayerId });
  return room;
}

/**
 * Simulates joining an existing room by code. In this mock, any
 * well-formed 6-digit code "succeeds" and fabricates a plausible room,
 * since there is no real backend to check against yet.
 */
export function joinMockRoom(roomCode, playerName) {
  const ownPlayerId = getOrCreatePlayerId();
  const companions = MOCK_COMPANIONS.slice(0, 3).map((name, i) => ({
    id: `mock_${i}`,
    name,
    alive: true,
    ready: i === 0,
    isHost: i === 0,
  }));

  const room = {
    roomCode,
    roomName: "Friday Mafia",
    phase: "LOBBY",
    players: [
      ...companions,
      { id: ownPlayerId, name: playerName.trim() || "Player", alive: true, ready: false, isHost: false },
    ],
  };

  store.setState({ room, ownPlayerId });
  return room;
}

export function toggleOwnReady() {
  const { room, ownPlayerId } = store.getState();
  if (!room) return;
  const players = room.players.map((p) =>
    p.id === ownPlayerId ? { ...p, ready: !p.ready } : p
  );
  store.setState({ room: { ...room, players } });
}

export function leaveMockRoom() {
  store.setState({ room: null, ownPlayerId: null });
}
