/**
 * GameEngine.gs
 *
 * Owns every phase transition for LOBBY -> ROLE_REVEAL -> NIGHT -> DAY
 * -> DISCUSSION -> VOTING -> (NIGHT again, or GAME_OVER). Per
 * ARCHITECTURE.md §7, phase transitions are backend-owned; per §8,
 * "if completedActors === requiredActors, resolve immediately;
 * otherwise, when deadline passes, resolve according to timeout rules."
 *
 * The state machine's purely computational sub-steps (role assignment
 * itself, night-kill resolution, vote-tally resolution, win-check) are
 * never persisted as their own observable phase — a client polling
 * mid-resolution would never actually see "NIGHT_RESOLUTION" as a
 * value, because nothing waits on it. They happen synchronously inside
 * whichever request triggers them and the room lands on the next
 * *waiting* phase before it's ever written to Drive. See DECISIONS.md.
 */

const PHASE_DURATIONS_MS = {
  ROLE_REVEAL: 15000,
  NIGHT: 60000,
  DAY: 8000,
  DISCUSSION: 90000,
  VOTING: 45000,
};

const MIN_PLAYERS_TO_START = 3;

function nowMs_() {
  return Date.now();
}

/**
 * Applies every timeout-driven transition the room is currently overdue
 * for, in order, until it lands on a phase whose deadline hasn't passed
 * (or GAME_OVER, which has none). Mutates `room` in place.
 * @returns {boolean} whether anything changed (caller must persist if so)
 */
function resolvePendingTimeouts_(room) {
  let changed = false;
  let iterations = 0;

  while (room.phase !== "GAME_OVER" && room.game && room.game.deadline && nowMs_() >= room.game.deadline) {
    if (++iterations > 20) break; // safety valve against any transition-logic bug looping forever

    switch (room.phase) {
      case "ROLE_REVEAL":
        startNightPhase_(room);
        break;
      case "NIGHT":
        resolveNight_(room); // forced: uses whatever was finalized, likely no kill if incomplete
        break;
      case "DAY":
        room.phase = "DISCUSSION";
        room.game.deadline = nowMs_() + PHASE_DURATIONS_MS.DISCUSSION;
        break;
      case "DISCUSSION":
        room.phase = "VOTING";
        room.game.deadline = nowMs_() + PHASE_DURATIONS_MS.VOTING;
        break;
      case "VOTING":
        resolveVote_(room); // forced: unsubmitted votes are abstentions
        break;
      default:
        return changed; // LOBBY or an unexpected phase — nothing to do
    }
    room.revision += 1; // every timeout-driven transition must bump this, or polling clients (which
    changed = true;     // only re-render when revision changes) will silently never see it happen
  }

  return changed;
}

function startNightPhase_(room) {
  room.phase = "NIGHT";
  room.game.deadline = nowMs_() + PHASE_DURATIONS_MS.NIGHT;
  room.game.nightActions = {};
  room.game.votes = {};
}

/** Marks a winner and freezes the room, if the current state already decides the game. */
function checkWinAndMaybeEnd_(room) {
  const winner = evaluateWinner_(room);
  if (winner) {
    room.phase = "GAME_OVER";
    room.game.winner = winner;
    room.game.deadline = null;
    room.game.publicHistory.push({ round: room.game.round, type: "GAME_OVER", winner });
    return true;
  }
  return false;
}

/**
 * Resolves the night kill if the Mafia are unanimous (or forces a
 * no-kill result if called because the deadline passed and they
 * weren't). Per GAME_RULES.md: "Mafia kill succeeds only if every
 * living Mafia member finalized the same target."
 */
function resolveNight_(room) {
  const livingMafia = livingMafiaIds_(room);
  const allFinalized =
    livingMafia.length > 0 &&
    livingMafia.every((id) => room.game.nightActions[id] && room.game.nightActions[id].finalized);

  let killedId = null;
  if (allFinalized) {
    const targets = livingMafia.map((id) => room.game.nightActions[id].targetId);
    const unanimous = targets.every((t) => t === targets[0]);
    if (unanimous) killedId = targets[0];
  }

  if (killedId) {
    const victim = room.players.find((p) => p.id === killedId);
    if (victim) victim.alive = false;
  }

  room.game.publicHistory.push({
    round: room.game.round,
    type: killedId ? "NIGHT_DEATH" : "NO_NIGHT_DEATH",
    playerId: killedId,
  });

  if (checkWinAndMaybeEnd_(room)) return;

  room.phase = "DAY";
  room.game.deadline = nowMs_() + PHASE_DURATIONS_MS.DAY;
}

/** Called any time a Mafia action might have just completed the night early. */
function tryResolveNightIfComplete_(room) {
  const livingMafia = livingMafiaIds_(room);
  const allFinalized =
    livingMafia.length > 0 &&
    livingMafia.every((id) => room.game.nightActions[id] && room.game.nightActions[id].finalized);
  if (allFinalized) resolveNight_(room);
}

/**
 * Resolves the day's vote. Per GAME_RULES.md's V1 tie rule: a tie for
 * the most votes eliminates no one. Unsubmitted votes count as
 * abstentions, never as a vote for anyone.
 */
function resolveVote_(room) {
  const livingPlayers = livingPlayerIds_(room);
  const tally = {};
  livingPlayers.forEach((id) => {
    const target = room.game.votes[id];
    if (target) tally[target] = (tally[target] || 0) + 1;
  });

  let maxVotes = 0;
  Object.keys(tally).forEach((id) => {
    if (tally[id] > maxVotes) maxVotes = tally[id];
  });
  const topCandidates = Object.keys(tally).filter((id) => tally[id] === maxVotes);

  const eliminatedId = maxVotes > 0 && topCandidates.length === 1 ? topCandidates[0] : null;
  if (eliminatedId) {
    const victim = room.players.find((p) => p.id === eliminatedId);
    if (victim) victim.alive = false;
  }

  const votesCast = livingPlayers.map((id) => ({ voterId: id, targetId: room.game.votes[id] || null }));

  room.game.publicHistory.push({
    round: room.game.round,
    type: "VOTE_RESULT",
    votes: votesCast,
    tally,
    eliminatedId,
    tie: maxVotes > 0 && topCandidates.length > 1,
  });

  if (checkWinAndMaybeEnd_(room)) return;

  room.game.round += 1;
  startNightPhase_(room);
}

function tryResolveVoteIfComplete_(room) {
  const livingPlayers = livingPlayerIds_(room);
  const allVoted = livingPlayers.length > 0 && livingPlayers.every((id) => !!room.game.votes[id]);
  if (allVoted) resolveVote_(room);
}

/** @returns {{ok:true, room, private, mafia}|{ok:false, error}} */
function startGameRecord_(roomCode, callerPlayerId, callerSessionToken) {
  return withLock_(() => {
    const room = readRoom_(roomCode);
    if (!room) return { ok: false, error: "No room found with that code." };
    if (room.phase !== "LOBBY") return { ok: false, error: "The game has already started." };

    const caller = findAuthedPlayer_(room, callerPlayerId, callerSessionToken);
    if (!caller) return { ok: false, error: "Your session for this room is no longer valid." };
    if (room.hostPlayerId !== callerPlayerId) return { ok: false, error: "Only the host can start the game." };
    if (room.players.length < MIN_PLAYERS_TO_START) {
      return { ok: false, error: `Need at least ${MIN_PLAYERS_TO_START} players to start.` };
    }

    room.game = {
      round: 1,
      roles: assignRoles_(room.players),
      acknowledged: {},
      nightActions: {},
      votes: {},
      publicHistory: [],
      winner: null,
      deadline: nowMs_() + PHASE_DURATIONS_MS.ROLE_REVEAL,
    };
    room.phase = "ROLE_REVEAL";
    room.revision += 1;

    writeRoom_(room);
    return projectionResult_(room, callerPlayerId);
  });
}

/** @returns {{ok:true, room, private, mafia}|{ok:false, error}} */
function acknowledgeRoleRecord_(roomCode, playerId, sessionToken) {
  return withLock_(() => {
    const room = readRoom_(roomCode);
    if (!room) return { ok: false, error: "No room found with that code." };

    const player = findAuthedPlayer_(room, playerId, sessionToken);
    if (!player) return { ok: false, error: "Your session for this room is no longer valid." };

    resolvePendingTimeouts_(room);
    if (room.phase !== "ROLE_REVEAL") {
      writeRoom_(room);
      return projectionResult_(room, playerId);
    }

    room.game.acknowledged[playerId] = true;
    room.revision += 1;

    const living = livingPlayerIds_(room);
    if (living.every((id) => room.game.acknowledged[id])) {
      startNightPhase_(room);
    }

    writeRoom_(room);
    return projectionResult_(room, playerId);
  });
}

/** @returns {{ok:true, room, private, mafia}|{ok:false, error}} */
function submitNightActionRecord_(roomCode, playerId, sessionToken, targetId, finalized) {
  return withLock_(() => {
    const room = readRoom_(roomCode);
    if (!room) return { ok: false, error: "No room found with that code." };

    const player = findAuthedPlayer_(room, playerId, sessionToken);
    if (!player) return { ok: false, error: "Your session for this room is no longer valid." };

    resolvePendingTimeouts_(room);
    if (room.phase !== "NIGHT") {
      writeRoom_(room);
      return { ok: false, error: "It's not the night phase right now." };
    }
    if (!player.alive) return { ok: false, error: "Dead players can't act." };
    if (room.game.roles[playerId] !== ROLE_MAFIA) {
      return { ok: false, error: "You have no night action." };
    }
    const target = room.players.find((p) => p.id === targetId);
    if (!target || !target.alive) return { ok: false, error: "Choose a living player to target." };

    room.game.nightActions[playerId] = { targetId, finalized: !!finalized };
    room.revision += 1;

    tryResolveNightIfComplete_(room);

    writeRoom_(room);
    return projectionResult_(room, playerId);
  });
}

/** @returns {{ok:true, room, private, mafia}|{ok:false, error}} */
function submitVoteRecord_(roomCode, playerId, sessionToken, targetId) {
  return withLock_(() => {
    const room = readRoom_(roomCode);
    if (!room) return { ok: false, error: "No room found with that code." };

    const player = findAuthedPlayer_(room, playerId, sessionToken);
    if (!player) return { ok: false, error: "Your session for this room is no longer valid." };

    resolvePendingTimeouts_(room);
    if (room.phase !== "VOTING") {
      writeRoom_(room);
      return { ok: false, error: "It's not the voting phase right now." };
    }
    if (!player.alive) return { ok: false, error: "Dead players can't vote." };
    const target = room.players.find((p) => p.id === targetId);
    if (!target || !target.alive) return { ok: false, error: "Choose a living player to vote for." };

    room.game.votes[playerId] = targetId;
    room.revision += 1;

    tryResolveVoteIfComplete_(room);

    writeRoom_(room);
    return projectionResult_(room, playerId);
  });
}
