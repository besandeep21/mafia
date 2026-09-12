/**
 * Roles.gs
 *
 * Phase 4 implements exactly Mafia + Villager, per
 * CLAUDE_PROJECT_INSTRUCTIONS.md's own phase breakdown (Doctor, Seer,
 * Trickster, Resurrector are explicitly Phase 5). Kept in its own file
 * so adding those roles later touches this file and GameEngine.gs's
 * resolution order, not the room/session plumbing in Rooms.gs.
 */

const ROLE_MAFIA = "MAFIA";
const ROLE_VILLAGER = "VILLAGER";
const ROLE_DOCTOR = "DOCTOR";
const ROLE_SEER = "SEER";
const ROLE_TRICKSTER = "TRICKSTER";
const ROLE_RESURRECTOR = "RESURRECTOR";

/**
 * Decides how many Mafia to assign for a given player count.
 * No host-configurable role counts yet (see DECISIONS.md) — this is a
 * reasonable automatic default: roughly 1 Mafia per 4 players, at
 * least 1, capped so Mafia never starts at or above parity (which
 * would make the game a foregone conclusion before it begins).
 */
function defaultMafiaCount_(playerCount) {
  const count = Math.max(1, Math.floor(playerCount / 4));
  return Math.min(count, Math.ceil(playerCount / 2) - 1);
}

/**
 * Decides which special Town/neutral roles to include for a given
 * player count. Still no host-configurable role counts (see
 * DECISIONS.md) — these thresholds are a reasonable default that scales
 * up the special-role roster only once there are enough players for
 * each addition to still leave a real villager base. Order matters:
 * Doctor and Seer (the more foundational, higher-frequency-use roles)
 * unlock before the one-use Trickster and Resurrector.
 */
function defaultSpecialRoles_(playerCount) {
  const roles = [];
  if (playerCount >= 4) roles.push(ROLE_DOCTOR);
  if (playerCount >= 5) roles.push(ROLE_SEER);
  if (playerCount >= 7) roles.push(ROLE_TRICKSTER);
  if (playerCount >= 8) roles.push(ROLE_RESURRECTOR);
  return roles;
}

/**
 * Shuffles and assigns roles to every player in `players`.
 * Always leaves at least one Villager when possible, so a game is never
 * entirely special roles with no plain townsfolk.
 * @returns {{ [playerId]: string }}
 */
function assignRoles_(players) {
  const shuffled = players.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  const roles = {};
  let index = 0;

  const mafiaCount = defaultMafiaCount_(shuffled.length);
  for (let i = 0; i < mafiaCount; i++) {
    roles[shuffled[index].id] = ROLE_MAFIA;
    index++;
  }

  const specialRoles = defaultSpecialRoles_(shuffled.length);
  for (const specialRole of specialRoles) {
    if (index >= shuffled.length - 1) break; // always leave at least 1 Villager
    roles[shuffled[index].id] = specialRole;
    index++;
  }

  for (; index < shuffled.length; index++) {
    roles[shuffled[index].id] = ROLE_VILLAGER;
  }

  return roles;
}

function livingPlayerIds_(room) {
  return room.players.filter((p) => p.alive).map((p) => p.id);
}

function livingMafiaIds_(room) {
  return livingPlayerIds_(room).filter((id) => room.game.roles[id] === ROLE_MAFIA);
}

function livingNonMafiaIds_(room) {
  return livingPlayerIds_(room).filter((id) => room.game.roles[id] !== ROLE_MAFIA);
}

/** Living players holding a given role. At most one is expected per role in V1. */
function livingPlayerWithRole_(room, role) {
  return livingPlayerIds_(room).find((id) => room.game.roles[id] === role) || null;
}

function hasUsedAbility_(room, playerId) {
  return !!(room.game.roleState[playerId] && room.game.roleState[playerId].abilityUsed);
}

function markAbilityUsed_(room, playerId) {
  if (!room.game.roleState[playerId]) room.game.roleState[playerId] = {};
  room.game.roleState[playerId].abilityUsed = true;
}

/**
 * Centralized win check, per GAME_RULES.md: "The final implementation
 * must centralize victory evaluation in one function so rules are not
 * duplicated across screens." (This is the one function — both the
 * backend's phase engine and nothing else ever re-implements this.)
 *
 * Returns the primary Town/Mafia result. The Trickster's independent
 * "alive when the game ends" win (GAME_RULES.md) is evaluated
 * separately in GameEngine.gs's checkWinAndMaybeEnd_, since it's a
 * secondary condition layered on top of — never instead of — this one.
 * @returns {"TOWN"|"MAFIA"|null}
 */
function evaluateWinner_(room) {
  const mafiaCount = livingMafiaIds_(room).length;
  const otherCount = livingNonMafiaIds_(room).length;

  if (mafiaCount === 0) return "TOWN";
  if (mafiaCount >= otherCount) return "MAFIA";
  return null;
}
