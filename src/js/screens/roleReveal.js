import { escapeHtml, startCountdown } from "./layout.js";
import { acknowledgeRole } from "../state/roomStore.js";

const ROLE_COPY = {
  MAFIA: {
    name: "Mafia",
    description: "Work with your fellow Mafia to eliminate the town. Each night, agree unanimously on a target.",
  },
  VILLAGER: {
    name: "Villager",
    description: "You have no special ability. Use the day's discussion and your vote to find the Mafia.",
  },
  DOCTOR: {
    name: "Doctor",
    description: "Each night, protect one living player (yourself included) from the Mafia's kill.",
  },
  SEER: {
    name: "Seer",
    description: "Each night, investigate one living player. You'll privately learn whether they're Mafia.",
  },
  TRICKSTER: {
    name: "Trickster",
    description: "You're neutral — not Town, not Mafia. You have one kill for the entire game, and you win independently if you're still alive when the game ends.",
  },
  RESURRECTOR: {
    name: "Resurrector",
    description: "You have one revival for the entire game. Use it to bring an eliminated player back.",
  },
};

/**
 * @returns {() => void} cleanup
 */
export function renderRoleReveal(content, state, ctx) {
  const { room, private: privateState, mafia } = state;
  const role = privateState ? privateState.role : null;
  const copy = ROLE_COPY[role] || { name: "Unknown", description: "" };
  const acknowledged = !!(privateState && privateState.acknowledged);

  const acknowledgedCount = room.acknowledgedCount || 0;
  const totalLiving = room.players.filter((p) => p.alive).length;

  content.innerHTML = `
    <div style="flex:1; display:flex; flex-direction:column; gap: var(--space-xl); align-items:center; justify-content:center;">
      <div class="role-card">
        <span class="role-card__label">Your role</span>
        <span class="role-card__name">${escapeHtml(copy.name)}</span>
        <p class="role-card__description">${escapeHtml(copy.description)}</p>
      </div>

      ${
        role === "MAFIA" && mafia && mafia.teammates.length > 1
          ? `<div class="card" style="width:100%;">
              <p class="eyebrow" style="margin-bottom:var(--space-xs);">Your fellow Mafia</p>
              <p class="section-title" style="font-size:var(--type-body-md-size);">${mafia.teammates
                .filter((t) => t.id !== ctx.ownPlayerId)
                .map((t) => escapeHtml(t.name))
                .join(", ")}</p>
            </div>`
          : ""
      }
    </div>

    <div class="btn-block-group">
      <p class="status-text">${acknowledgedCount}/${totalLiving} ready · <span class="timer-badge" data-role="timer"></span></p>
      <button class="btn btn-accent" type="button" data-role="continue" ${acknowledged ? "disabled" : ""}>
        ${acknowledged ? "Waiting for others…" : "Got it"}
      </button>
    </div>
  `;

  const stopTimer = startCountdown(content.querySelector('[data-role="timer"]'), room.deadline);

  const continueButton = content.querySelector('[data-role="continue"]');
  if (!acknowledged) {
    continueButton.addEventListener("click", async () => {
      continueButton.disabled = true;
      continueButton.textContent = "Waiting for others…";
      await acknowledgeRole(ctx.roomCode);
    });
  }

  return () => stopTimer();
}
