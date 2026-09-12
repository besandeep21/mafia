/**
 * Validation.gs
 *
 * ARCHITECTURE.md's trust model lists "Player-provided name" and
 * "Player-provided action" as untrusted. Every value from the client
 * passes through here before it's used, regardless of what the
 * frontend already validated client-side (client-side checks are a UX
 * convenience only, never a security boundary).
 */

const MAX_ROOM_NAME_LENGTH = 40;
const MAX_PLAYER_NAME_LENGTH = 24;

/** Trims and hard-caps length; never throws — callers decide what "empty after cleaning" means. */
function sanitizeText_(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidRoomCode_(value) {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

function isValidUuidLike_(value) {
  // Accepts our generatePlayerId_()/generateSessionToken_() shapes without being
  // overly strict about exact UUID formatting (defense in depth, not a parser).
  return typeof value === "string" && value.length >= 8 && value.length <= 100;
}

/**
 * Validates the fields needed to create a room.
 * @returns {{ roomName: string, hostName: string } | { error: string }}
 */
function validateCreateRoomPayload_(payload) {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid request." };
  }
  const hostName = sanitizeText_(payload.hostName, MAX_PLAYER_NAME_LENGTH);
  if (!hostName) return { error: "A player name is required." };

  const roomName = sanitizeText_(payload.roomName, MAX_ROOM_NAME_LENGTH) || "Untitled Room";
  const result = { roomName, hostName };
  if (isValidUuidLike_(payload.playerId)) {
    result.playerId = payload.playerId;
  }
  return result;
}

function validateJoinRoomPayload_(payload) {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid request." };
  }
  if (!isValidRoomCode_(payload.roomCode)) {
    return { error: "Room code must be 6 digits." };
  }
  const playerName = sanitizeText_(payload.playerName, MAX_PLAYER_NAME_LENGTH);
  if (!playerName) return { error: "A player name is required." };

  const result = { roomCode: payload.roomCode, playerName };

  // playerId (the device's persistent identity, per CLAUDE_PROJECT_INSTRUCTIONS.md §5)
  // and sessionToken (proof of a PRIOR join to this specific room) are validated
  // independently. A first-time join to this room legitimately has a playerId but
  // no sessionToken yet — requiring both together would silently discard a valid
  // playerId whenever a session token doesn't exist yet.
  if (isValidUuidLike_(payload.playerId)) {
    result.playerId = payload.playerId;
  }
  if (isValidUuidLike_(payload.sessionToken)) {
    result.sessionToken = payload.sessionToken;
  }
  return result;
}

function validateAuthedPayload_(payload) {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid request." };
  }
  if (!isValidRoomCode_(payload.roomCode)) {
    return { error: "Room code must be 6 digits." };
  }
  if (!isValidUuidLike_(payload.playerId) || !isValidUuidLike_(payload.sessionToken)) {
    return { error: "Missing or invalid session." };
  }
  return { roomCode: payload.roomCode, playerId: payload.playerId, sessionToken: payload.sessionToken };
}

/** Authed payload + a targetPlayerId (used by votes, which always require a target). */
function validateTargetedActionPayload_(payload) {
  const base = validateAuthedPayload_(payload);
  if (base.error) return base;
  if (!isValidUuidLike_(payload.targetPlayerId)) {
    return { error: "Choose a player to target." };
  }
  base.targetPlayerId = payload.targetPlayerId;
  return base;
}

/**
 * Authed payload + either a targetPlayerId OR an explicit skip flag —
 * used by night actions, where Doctor/Seer/Trickster/Resurrector may
 * deliberately choose not to act on a given night (see GameEngine.gs).
 */
function validateNightActionPayload_(payload) {
  const base = validateAuthedPayload_(payload);
  if (base.error) return base;

  if (payload.skip) {
    base.skip = true;
    return base;
  }
  if (!isValidUuidLike_(payload.targetPlayerId)) {
    return { error: "Choose a player to target, or skip." };
  }
  base.targetPlayerId = payload.targetPlayerId;
  base.finalized = !!payload.finalized;
  return base;
}
