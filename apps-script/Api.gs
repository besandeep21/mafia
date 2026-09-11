/**
 * Api.gs — one function per action, each responsible for validating
 * its own input (Validation.gs) before touching Rooms.gs. Code.gs's
 * doGet/doPost only route to these; no business logic lives there.
 */

function handleGetRoom_(params) {
  if (!isValidRoomCode_(params.roomCode)) {
    return errorResponse_("Room code must be 6 digits.");
  }
  const result = getRoomRecord_(params.roomCode);
  return result.ok ? okResponse_({ room: result.room }) : errorResponse_(result.error);
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
