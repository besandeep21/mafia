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
 * Shuffles and assigns roles to every player in `players`.
 * @returns {{ [playerId]: "MAFIA"|"VILLAGER" }}
 */
function assignRoles_(players) {
  const shuffled = players.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  const mafiaCount = defaultMafiaCount_(shuffled.length);
  const roles = {};
  shuffled.forEach((player, index) => {
    roles[player.id] = index < mafiaCount ? ROLE_MAFIA : ROLE_VILLAGER;
  });
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

/**
 * Centralized win check, per GAME_RULES.md: "The final implementation
 * must centralize victory evaluation in one function so rules are not
 * duplicated across screens." (This is the one function — both the
 * backend's phase engine and nothing else ever re-implements this.)
 * @returns {"TOWN"|"MAFIA"|null}
 */
function evaluateWinner_(room) {
  const mafiaCount = livingMafiaIds_(room).length;
  const otherCount = livingNonMafiaIds_(room).length;

  if (mafiaCount === 0) return "TOWN";
  if (mafiaCount >= otherCount) return "MAFIA";
  return null;
}
