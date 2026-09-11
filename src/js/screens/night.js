import { escapeHtml, startCountdown } from "./layout.js";
import { submitNightAction } from "../state/roomStore.js";

/**
 * @returns {() => void} cleanup
 */
export function renderNight(content, state, ctx) {
  const { room, private: privateState, mafia } = state;
  const isMafia = privateState && privateState.role === "MAFIA";
  const ownPlayer = room.players.find((p) => p.id === ctx.ownPlayerId);
  const isAlive = ownPlayer && ownPlayer.alive;
  const livingPlayers = room.players.filter((p) => p.alive);

  const currentTarget = isMafia && privateState.nightAction ? privateState.nightAction.targetId : null;
  const finalized = isMafia && privateState.nightAction ? privateState.nightAction.finalized : false;

  content.innerHTML = `
    <div style="text-align:center;">
      <p class="status-text">Time remaining: <span class="timer-badge" data-role="timer"></span></p>
    </div>

    <div class="card" style="flex:1;">
      <p class="section-title" style="margin-bottom:var(--space-base);">Your Action</p>
      ${
        !isAlive
          ? `<p class="status-text">You're out of the game, but you can keep watching as the night unfolds.</p>`
          : !isMafia
            ? `<p class="status-text">You have no action tonight. Sit tight while the Mafia decide.</p>`
            : `<p class="eyebrow" style="margin-bottom:var(--space-base);">Choose a target — every living Mafia member must agree</p>
               <ul class="player-list" data-role="target-list" style="margin-bottom:var(--space-base);"></ul>
               <button class="btn btn-accent" type="button" data-role="finalize" ${!currentTarget || finalized ? "disabled" : ""}>
                 ${finalized ? "Finalized — waiting for the others" : "Finalize this target"}
               </button>`
      }
    </div>

    <div>
      <p class="eyebrow" style="margin-bottom:var(--space-base);">Players</p>
      <ul class="player-list" data-role="status-list"></ul>
    </div>
  `;

  const stopTimer = startCountdown(content.querySelector('[data-role="timer"]'), room.deadline);

  if (isAlive && isMafia) {
    const selections = (mafia && mafia.selections) || {};
    const teammateIds = mafia.teammates.map((t) => t.id);
    const list = content.querySelector('[data-role="target-list"]');

    list.innerHTML = livingPlayers
      .map((p) => {
        const pickedBy = teammateIds.filter((id) => selections[id] && selections[id].targetId === p.id);
        const isSelected = p.id === currentTarget;
        return `
        <li>
          <button class="player-row-select ${isSelected ? "is-selected" : ""}" type="button"
            data-role="target-option" data-player-id="${p.id}" ${finalized ? "disabled" : ""}>
            <span class="player-row-select__name">
              <span class="player-avatar">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</span>
              ${escapeHtml(p.name)}${p.id === ctx.ownPlayerId ? " (you)" : ""}
            </span>
            ${pickedBy.length ? `<span class="badge badge-attention">${pickedBy.length} pick${pickedBy.length > 1 ? "s" : ""}</span>` : ""}
          </button>
        </li>
      `;
      })
      .join("");

    list.querySelectorAll('[data-role="target-option"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetId = btn.dataset.playerId;
        list.querySelectorAll('[data-role="target-option"]').forEach((b) => (b.disabled = true));
        const result = await submitNightAction(ctx.roomCode, targetId, false);
        if (!result.error) ctx.onStateUpdate(result);
      });
    });

    const finalizeButton = content.querySelector('[data-role="finalize"]');
    if (currentTarget && !finalized) {
      finalizeButton.addEventListener("click", async () => {
        finalizeButton.disabled = true;
        finalizeButton.textContent = "Finalizing…";
        const result = await submitNightAction(ctx.roomCode, currentTarget, true);
        if (!result.error) ctx.onStateUpdate(result);
      });
    }
  }

  const statusList = content.querySelector('[data-role="status-list"]');
  statusList.innerHTML = room.players
    .map(
      (p) => `
    <li class="player-row">
      <span class="player-row__name">
        <span class="player-avatar">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</span>
        ${escapeHtml(p.name)}${p.id === ctx.ownPlayerId ? " (you)" : ""}
      </span>
      ${p.alive ? "" : '<span class="badge badge-critical">Out</span>'}
    </li>
  `
    )
    .join("");

  return () => stopTimer();
}
