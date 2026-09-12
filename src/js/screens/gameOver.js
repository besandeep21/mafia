import { escapeHtml } from "./layout.js";
import { leaveRoom } from "../state/roomStore.js";

const WINNER_COPY = {
  TOWN: { title: "Town wins!", description: "Every Mafia member has been eliminated." },
  MAFIA: { title: "Mafia wins!", description: "The Mafia have reached parity with the town." },
};

const ROLE_LABEL = {
  MAFIA: "Mafia",
  VILLAGER: "Villager",
  DOCTOR: "Doctor",
  SEER: "Seer",
  TRICKSTER: "Trickster",
  RESURRECTOR: "Resurrector",
};

function badgeClassFor(role) {
  if (role === "MAFIA") return "badge-critical";
  if (role === "TRICKSTER") return "badge-attention";
  return "badge-success";
}

/**
 * @returns {() => void} cleanup (no-op — nothing to tear down)
 */
export function renderGameOver(content, state, ctx) {
  const { room } = state;
  const winners = room.winners || [];
  const roles = room.roles || {};

  const primaryWinner = winners.find((w) => w === "TOWN" || w === "MAFIA");
  const primaryCopy = WINNER_COPY[primaryWinner] || { title: "Game over", description: "" };
  const tricksterAlsoWon = winners.includes("TRICKSTER");

  content.innerHTML = `
    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap: var(--space-xl); text-align:center;">
      <div>
        <h2 class="section-title" style="font-size:32px; font-weight:500; margin-bottom:var(--space-xs);">${escapeHtml(primaryCopy.title)}</h2>
        <p class="status-text">${escapeHtml(primaryCopy.description)}</p>
        ${
          tricksterAlsoWon
            ? `<p class="status-text" style="margin-top:var(--space-xs);"><strong>The Trickster also wins</strong> — they survived to the end of the game.</p>`
            : ""
        }
      </div>

      <div class="card" style="width:100%; text-align:left;">
        <p class="section-title" style="margin-bottom:var(--space-base);">Final roles</p>
        <ul class="player-list">
          ${room.players
            .map((p) => {
              const role = roles[p.id];
              return `
            <li class="player-row">
              <span class="player-row__name">
                <span class="player-avatar">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</span>
                ${escapeHtml(p.name)}${p.id === ctx.ownPlayerId ? " (you)" : ""}
              </span>
              <span class="badge ${badgeClassFor(role)}">${escapeHtml(ROLE_LABEL[role] || "?")}</span>
            </li>
          `;
            })
            .join("")}
        </ul>
      </div>
    </div>

    <button class="btn btn-primary" type="button" data-role="leave">Back home</button>
  `;

  content.querySelector('[data-role="leave"]').addEventListener("click", () => {
    ctx.navigate("/");
    leaveRoom(ctx.roomCode);
  });

  return () => {};
}
