import { escapeHtml, startCountdown } from "./layout.js";
import { submitNightAction } from "../state/roomStore.js";

const ROLE_COPY = {
  DOCTOR: { verb: "Protect", instruction: "Choose someone to protect tonight — you may protect yourself." },
  SEER: { verb: "Investigate", instruction: "Choose someone to investigate. You'll learn the result once the night ends." },
  TRICKSTER: { verb: "Kill", instruction: "You have one kill for the whole game. Choose carefully — you cannot target yourself." },
  RESURRECTOR: { verb: "Revive", instruction: "You have one revival for the whole game. Choose a player who is currently out." },
};

/**
 * Renders the tappable target list shared by Doctor/Seer/Trickster/Resurrector:
 * tapping immediately submits (changeable until the night resolves, since the
 * backend only actually consumes a one-use ability at resolution time, not at
 * submission — see apps-script/GameEngine.gs).
 */
function renderSoloTargetPicker(content, { pool, currentTarget, ownPlayerId, roomCode, disabled, onSubmitted }) {
  const list = content.querySelector('[data-role="target-list"]');

  if (list) {
    list.innerHTML = pool
      .map(
        (p) => `
      <li>
        <button class="player-row-select ${p.id === currentTarget ? "is-selected" : ""}" type="button"
          data-role="target-option" data-player-id="${p.id}" ${disabled ? "disabled" : ""}>
          <span class="player-row-select__name">
            <span class="player-avatar">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</span>
            ${escapeHtml(p.name)}${p.id === ownPlayerId ? " (you)" : ""}
          </span>
          ${p.id === currentTarget ? '<span class="badge badge-success">Selected</span>' : ""}
        </button>
      </li>
    `
      )
      .join("");

    list.querySelectorAll('[data-role="target-option"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        list.querySelectorAll('[data-role="target-option"]').forEach((b) => (b.disabled = true));
        const result = await submitNightAction(roomCode, btn.dataset.playerId, false, false);
        if (!result.error) onSubmitted(result);
      });
    });
  }

  // Attaching the skip listener must NOT depend on a target list existing —
  // it's equally valid (and, for a role with no eligible targets yet, the
  // ONLY valid action) whether or not `pool` had anyone in it.
  const skipButton = content.querySelector('[data-role="skip"]');
  if (skipButton && !disabled) {
    skipButton.addEventListener("click", async () => {
      skipButton.disabled = true;
      const result = await submitNightAction(roomCode, undefined, false, true);
      if (!result.error) onSubmitted(result);
    });
  }
}

export function renderNight(content, state, ctx) {
  const { room, private: privateState, mafia } = state;
  const role = privateState ? privateState.role : null;
  const ownPlayer = room.players.find((p) => p.id === ctx.ownPlayerId);
  const isAlive = ownPlayer && ownPlayer.alive;
  const livingPlayers = room.players.filter((p) => p.alive);
  const deadPlayers = room.players.filter((p) => !p.alive);

  const nightAction = privateState && privateState.nightAction;
  const currentTarget = nightAction && !nightAction.skipped ? nightAction.targetId : null;
  const hasActed = !!nightAction; // acted this night, whether by target or explicit skip

  content.innerHTML = `
    <div style="text-align:center;">
      <p class="status-text">Time remaining: <span class="timer-badge" data-role="timer"></span></p>
    </div>

    <div class="card" style="flex:1;">
      <p class="section-title" style="margin-bottom:var(--space-base);">Your Action</p>
      <div data-role="action-area"></div>
    </div>

    <div>
      <p class="eyebrow" style="margin-bottom:var(--space-base);">Players</p>
      <ul class="player-list" data-role="status-list"></ul>
    </div>
  `;

  const stopTimer = startCountdown(content.querySelector('[data-role="timer"]'), room.deadline);
  const actionArea = content.querySelector('[data-role="action-area"]');

  if (!isAlive) {
    actionArea.innerHTML = `<p class="status-text">You're out of the game, but you can keep watching as the night unfolds.</p>`;
  } else if (role === "VILLAGER") {
    actionArea.innerHTML = `<p class="status-text">You have no action tonight. Sit tight while the Mafia decide.</p>`;
  } else if (role === "MAFIA") {
    const finalized = nightAction ? nightAction.finalized : false;
    const selections = (mafia && mafia.selections) || {};
    const teammateIds = mafia.teammates.map((t) => t.id);

    actionArea.innerHTML = `
      <p class="eyebrow" style="margin-bottom:var(--space-base);">Choose a target — every living Mafia member must agree</p>
      <ul class="player-list" data-role="target-list" style="margin-bottom:var(--space-base);"></ul>
      <button class="btn btn-accent" type="button" data-role="finalize" ${!currentTarget || finalized ? "disabled" : ""}>
        ${finalized ? "Finalized — waiting for the others" : "Finalize this target"}
      </button>
    `;

    const list = actionArea.querySelector('[data-role="target-list"]');
    list.innerHTML = livingPlayers
      .map((p) => {
        const pickedBy = teammateIds.filter((id) => selections[id] && selections[id].targetId === p.id);
        return `
        <li>
          <button class="player-row-select ${p.id === currentTarget ? "is-selected" : ""}" type="button"
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

    const finalizeButton = actionArea.querySelector('[data-role="finalize"]');
    if (currentTarget && !finalized) {
      finalizeButton.addEventListener("click", async () => {
        finalizeButton.disabled = true;
        finalizeButton.textContent = "Finalizing…";
        const result = await submitNightAction(ctx.roomCode, currentTarget, true);
        if (!result.error) ctx.onStateUpdate(result);
      });
    }
  } else if (role === "DOCTOR" || role === "SEER" || role === "TRICKSTER" || role === "RESURRECTOR") {
    const abilityUsed = privateState.abilityUsed; // undefined for Doctor/Seer (unlimited use)
    const copy = ROLE_COPY[role];

    if (abilityUsed) {
      actionArea.innerHTML = `<p class="status-text">You've already used your ${role === "TRICKSTER" ? "one kill" : "one revival"} earlier in the game. Nothing to do tonight.</p>`;
    } else {
      const pool = role === "RESURRECTOR" ? deadPlayers : role === "TRICKSTER" ? livingPlayers.filter((p) => p.id !== ctx.ownPlayerId) : livingPlayers;

      const seerHistoryHtml =
        role === "SEER" && privateState.seerResults && privateState.seerResults.length
          ? `<div style="margin-bottom:var(--space-base);">
              <p class="eyebrow" style="margin-bottom:var(--space-xs);">Your past results</p>
              ${privateState.seerResults
                .map((r) => {
                  const target = room.players.find((p) => p.id === r.targetId);
                  return `<p class="status-text">Round ${r.round}: ${escapeHtml(target ? target.name : "?")} — <strong>${r.result === "MAFIA" ? "Mafia" : "Not Mafia"}</strong></p>`;
                })
                .join("")}
            </div>`
          : "";

      actionArea.innerHTML = `
        ${seerHistoryHtml}
        <p class="eyebrow" style="margin-bottom:var(--space-base);">${escapeHtml(copy.instruction)}</p>
        ${
          pool.length === 0
            ? `<p class="status-text">No eligible players right now.</p>`
            : `<ul class="player-list" data-role="target-list" style="margin-bottom:var(--space-base);"></ul>`
        }
        <button class="btn btn-ghost" type="button" data-role="skip" ${hasActed ? "disabled" : ""}>
          ${hasActed && nightAction.skipped ? "Skipped for tonight" : hasActed ? "Already acted tonight" : "Skip — don't use ability tonight"}
        </button>
      `;

      renderSoloTargetPicker(content, {
        pool,
        currentTarget,
        ownPlayerId: ctx.ownPlayerId,
        roomCode: ctx.roomCode,
        disabled: hasActed,
        onSubmitted: ctx.onStateUpdate,
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
