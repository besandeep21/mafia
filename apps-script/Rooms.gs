/**
 * Rooms.gs — room lifecycle logic. No Drive calls or HTTP concerns
 * here directly except through Persistence.gs's functions, per
 * ARCHITECTURE.md §12's isolation goal.
 *
 * Room shape (mirrors ARCHITECTURE.md §4, extended with player session
 * data per §5):
 * {
 *   roomCode, roomName, phase: "LOBBY", hostPlayerId, revision,
 *   createdAt,
 *   players: [
 *     { id, name, isHost, ready, alive, sessionToken, joinedAt, lastSeenAt }
 *   ]
 * }
 */

/**
 * Strips fields that must never leave the backend — currently just
 * session tokens, per ARCHITECTURE.md §5: "Never return session tokens
 * belonging to other players." (We strip our own too; the caller
 * already has it from the original create/join response.)
 */
function toPublicRoom_(room) {
  if (!room) return null;
  return {
    roomCode: room.roomCode,
    roomName: room.roomName,
    phase: room.phase,
    hostPlayerId: room.hostPlayerId,
    revision: room.revision,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      ready: p.ready,
      alive: p.alive,
    })),
  };
}

/**
 * @param {string} roomName
 * @param {string} hostName
 * @param {string} [clientPlayerId] the device's own persistent player id
 *   (CLAUDE_PROJECT_INSTRUCTIONS.md §5: generated and stored on-device,
 *   reused across rooms — the server trusts it as a label, not a secret;
 *   the separately-issued sessionToken is the real authorization credential).
 * @returns {{ok:true, room, playerId, sessionToken}|{ok:false, error}}
 */
function createRoomRecord_(roomName, hostName, clientPlayerId) {
  return withLock_(() => {
    let roomCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      roomCode = generateRoomCode_();
      if (!roomExists_(roomCode)) break;
    }
    if (roomExists_(roomCode)) {
      return { ok: false, error: "Could not allocate a room code, please try again." };
    }

    const playerId = clientPlayerId || generatePlayerId_();
    const sessionToken = generateSessionToken_();
    const timestamp = nowIso_();

    const room = {
      roomCode,
      roomName,
      phase: "LOBBY",
      hostPlayerId: playerId,
      revision: 1,
      createdAt: timestamp,
      players: [
        {
          id: playerId,
          name: hostName,
          isHost: true,
          ready: false,
          alive: true,
          sessionToken,
          joinedAt: timestamp,
          lastSeenAt: timestamp,
        },
      ],
    };

    writeRoom_(room);
    return { ok: true, room: toPublicRoom_(room), playerId, sessionToken };
  });
}

/**
 * @param {string} roomCode
 * @param {string} playerName
 * @param {string} [clientPlayerId] this device's persistent player id, if it has one
 * @param {string} [clientSessionToken] the token this device holds for THIS room, if any
 * @returns {{ok:true, room, playerId, sessionToken}|{ok:false, error}}
 */
function joinRoomRecord_(roomCode, playerName, clientPlayerId, clientSessionToken) {
  return withLock_(() => {
    const room = readRoom_(roomCode);
    if (!room) return { ok: false, error: "No room found with that code." };
    if (room.phase !== "LOBBY") return { ok: false, error: "That game has already started." };

    const timestamp = nowIso_();
    const existingPlayer = clientPlayerId
      ? room.players.find((p) => p.id === clientPlayerId)
      : null;

    if (existingPlayer) {
      if (clientSessionToken && existingPlayer.sessionToken === clientSessionToken) {
        // Legitimate reconnect: same device, same room, proven by the matching
        // session token (the playerId alone is just a label, not proof).
        existingPlayer.name = playerName;
        existingPlayer.lastSeenAt = timestamp;
        room.revision += 1;
        writeRoom_(room);
        return {
          ok: true,
          room: toPublicRoom_(room),
          playerId: existingPlayer.id,
          sessionToken: existingPlayer.sessionToken,
        };
      }
      // This playerId is already taken in this room and the caller couldn't
      // prove ownership of it (wrong/missing session token) — extremely
      // unlikely in practice (it would require a real UUID collision), but
      // rather than reject outright, fall back to minting a fresh id so this
      // join still succeeds without impersonating the existing player.
      const playerId = generatePlayerId_();
      const sessionToken = generateSessionToken_();
      room.players.push({
        id: playerId,
        name: playerName,
        isHost: false,
        ready: false,
        alive: true,
        sessionToken,
        joinedAt: timestamp,
        lastSeenAt: timestamp,
      });
      room.revision += 1;
      writeRoom_(room);
      return { ok: true, room: toPublicRoom_(room), playerId, sessionToken };
    }

    // Fresh join: either no playerId was supplied, or it's not yet in this room.
    const playerId = clientPlayerId || generatePlayerId_();
    const sessionToken = generateSessionToken_();
    room.players.push({
      id: playerId,
      name: playerName,
      isHost: false,
      ready: false,
      alive: true,
      sessionToken,
      joinedAt: timestamp,
      lastSeenAt: timestamp,
    });
    room.revision += 1;
    writeRoom_(room);
    return { ok: true, room: toPublicRoom_(room), playerId, sessionToken };
  });
}

/** @returns {{ok:true, room}|{ok:false, error}} */
function getRoomRecord_(roomCode) {
  const room = readRoom_(roomCode);
  if (!room) return { ok: false, error: "No room found with that code." };
  return { ok: true, room: toPublicRoom_(room) };
}

function findAuthedPlayer_(room, playerId, sessionToken) {
  return room.players.find((p) => p.id === playerId && p.sessionToken === sessionToken);
}

/** @returns {{ok:true, room}|{ok:false, error}} */
function setReadyRecord_(roomCode, playerId, sessionToken, ready) {
  return withLock_(() => {
    const room = readRoom_(roomCode);
    if (!room) return { ok: false, error: "No room found with that code." };

    const player = findAuthedPlayer_(room, playerId, sessionToken);
    if (!player) return { ok: false, error: "Your session for this room is no longer valid." };
    if (room.phase !== "LOBBY") return { ok: false, error: "That game has already started." };

    player.ready = !!ready;
    player.lastSeenAt = nowIso_();
    room.revision += 1;
    writeRoom_(room);
    return { ok: true, room: toPublicRoom_(room) };
  });
}

/** @returns {{ok:true, room}|{ok:false, error}} — room is null if the room is now empty and was deleted. */
function leaveRoomRecord_(roomCode, playerId, sessionToken) {
  return withLock_(() => {
    const room = readRoom_(roomCode);
    if (!room) return { ok: true, room: null };

    const player = findAuthedPlayer_(room, playerId, sessionToken);
    if (!player) return { ok: false, error: "Your session for this room is no longer valid." };

    room.players = room.players.filter((p) => p.id !== playerId);
    room.revision += 1;

    if (room.players.length === 0) {
      deleteRoom_(roomCode);
      return { ok: true, room: null };
    }

    // If the host left, promote the longest-standing remaining player.
    // (Deferred host-transfer UX beyond this — see DECISIONS.md.)
    if (room.hostPlayerId === playerId) {
      room.players.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
      room.players[0].isHost = true;
      room.hostPlayerId = room.players[0].id;
    }

    writeRoom_(room);
    return { ok: true, room: toPublicRoom_(room) };
  });
}
