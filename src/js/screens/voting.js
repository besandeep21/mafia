import { escapeHtml, startCountdown } from "./layout.js";
import { submitVote } from "../state/roomStore.js";

/**
 * @returns {() => void} cleanup
 */
export function renderVoting(content, state, ctx) {
  const { room, private: privateState } = state;
  const ownPlayer = room.players.find((p) => p.id === ctx.ownPlayerId);
  const isAlive = ownPlayer && ownPlayer.alive;
  const livingPlayers = room.players.filter((p) => p.alive);
  const votedFor = privateState ? privateState.votedFor : null;
  const votedCount = room.votedCount || 0;

  let actionAreaHtml;
  if (!isAlive) {
    actionAreaHtml = `<p class="status-text">You're out of the game, but you can still watch the vote.</p>`;
  } else {
    actionAreaHtml = `
      <p class="eyebrow" style="margin-bottom:var(--space-base);">Vote to eliminate someone — ${votedCount}/${livingPlayers.length} have voted</p>
      <ul class="player-list" data-role="vote-list"></ul>
    `;
  }

  content.innerHTML = `
    <div style="text-align:center;">
      <p class="status-text">Voting · <span class="timer-badge" data-role="timer"></span></p>
    </div>

    <div class="card" style="flex:1;">
      <p class="section-title" style="margin-bottom:var(--space-base);">Your Action</p>
      ${actionAreaHtml}
    </div>
  `;

  const stopTimer = startCountdown(content.querySelector('[data-role="timer"]'), room.deadline);

  const list = content.querySelector('[data-role="vote-list"]');
  if (list) {
    list.innerHTML = livingPlayers
      .map(
        (p) => `
      <li>
        <button class="player-row-select ${p.id === votedFor ? "is-selected" : ""}" type="button"
          data-role="vote-option" data-player-id="${p.id}">
          <span class="player-row-select__name">
            <span class="player-avatar">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</span>
            ${escapeHtml(p.name)}${p.id === ctx.ownPlayerId ? " (you)" : ""}
          </span>
          ${p.id === votedFor ? '<span class="badge badge-success">Your vote</span>' : ""}
        </button>
      </li>
    `
      )
      .join("");

    list.querySelectorAll('[data-role="vote-option"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetId = btn.dataset.playerId;
        list.querySelectorAll('[data-role="vote-option"]').forEach((b) => (b.disabled = true));
        const result = await submitVote(ctx.roomCode, targetId);
        if (!result.error) ctx.onStateUpdate(result);
      });
    });
  }

  return () => stopTimer();
}
