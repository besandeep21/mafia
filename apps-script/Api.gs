/**
 * Api.gs — one function per action, each responsible for validating
 * its own input (Validation.gs) before touching Rooms.gs. Code.gs's
 * doGet/doPost only route to these; no business logic lives there.
 */

function handleGetRoom_(params) {
  if (!isValidRoomCode_(params.roomCode)) {
    return errorResponse_("Room code must be 6 digits.");
  }
  const result = getRoomRecord_(params.roomCode, params.playerId, params.sessionToken);
  return result.ok
    ? okResponse_({ room: result.room, private: result.private, mafia: result.mafia })
    : errorResponse_(result.error);
}

function handleCreateRoom_(payload) {
  const validated = validateCreateRoomPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = createRoomRecord_(validated.roomName, validated.hostName, validated.playerId);
  return result.ok
    ? okResponse_({ room: result.room, playerId: result.playerId, sessionToken: result.sessionToken })
    : errorResponse_(result.error);
}

function handleJoinRoom_(payload) {
  const validated = validateJoinRoomPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = joinRoomRecord_(
    validated.roomCode,
    validated.playerName,
    validated.playerId,
    validated.sessionToken
  );
  return result.ok
    ? okResponse_({ room: result.room, playerId: result.playerId, sessionToken: result.sessionToken })
    : errorResponse_(result.error);
}

function handleSetReady_(payload) {
  const validated = validateAuthedPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = setReadyRecord_(validated.roomCode, validated.playerId, validated.sessionToken, !!payload.ready);
  return result.ok ? okResponse_({ room: result.room }) : errorResponse_(result.error);
}

function handleLeaveRoom_(payload) {
  const validated = validateAuthedPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = leaveRoomRecord_(validated.roomCode, validated.playerId, validated.sessionToken);
  return result.ok ? okResponse_({ room: result.room }) : errorResponse_(result.error);
}

function handleStartGame_(payload) {
  const validated = validateAuthedPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = startGameRecord_(validated.roomCode, validated.playerId, validated.sessionToken);
  return result.ok
    ? okResponse_({ room: result.room, private: result.private, mafia: result.mafia })
    : errorResponse_(result.error);
}

function handleAcknowledgeRole_(payload) {
  const validated = validateAuthedPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = acknowledgeRoleRecord_(validated.roomCode, validated.playerId, validated.sessionToken);
  return result.ok
    ? okResponse_({ room: result.room, private: result.private, mafia: result.mafia })
    : errorResponse_(result.error);
}

function handleSubmitNightAction_(payload) {
  const validated = validateNightActionPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = submitNightActionRecord_(
    validated.roomCode,
    validated.playerId,
    validated.sessionToken,
    validated.targetPlayerId,
    validated.finalized,
    validated.skip
  );
  return result.ok
    ? okResponse_({ room: result.room, private: result.private, mafia: result.mafia })
    : errorResponse_(result.error);
}

function handleSubmitVote_(payload) {
  const validated = validateTargetedActionPayload_(payload);
  if (validated.error) return errorResponse_(validated.error);

  const result = submitVoteRecord_(validated.roomCode, validated.playerId, validated.sessionToken, validated.targetPlayerId);
  return result.ok
    ? okResponse_({ room: result.room, private: result.private, mafia: result.mafia })
    : errorResponse_(result.error);
}
