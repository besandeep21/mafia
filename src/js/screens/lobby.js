import { renderShell, showToast } from "./layout.js";
import { getMockState, subscribeMockState, toggleOwnReady, leaveMockRoom } from "../state/mockState.js";
import { buildJoinUrl, shareJoinLink } from "../services/shareService.js";

const QR_ICON = `<svg width="120" height="120" viewBox="0 0 100 100" aria-hidden="true">
  <rect width="100" height="100" fill="var(--color-canvas)"/>
  <g fill="var(--color-ink-deep)">
    <rect x="4" y="4" width="24" height="24"/>
    <rect x="10" y="10" width="12" height="12" fill="var(--color-canvas)"/>
    <rect x="72" y="4" width="24" height="24"/>
    <rect x="78" y="10" width="12" height="12" fill="var(--color-canvas)"/>
    <rect x="4" y="72" width="24" height="24"/>
    <rect x="10" y="78" width="12" height="12" fill="var(--color-canvas)"/>
    <rect x="40" y="4" width="6" height="6"/><rect x="52" y="4" width="6" height="6"/>
    <rect x="40" y="16" width="6" height="6"/><rect x="60" y="16" width="6" height="6"/>
    <rect x="40" y="40" width="20" height="20"/>
    <rect x="4" y="40" width="6" height="6"/><rect x="16" y="46" width="6" height="6"/>
    <rect x="72" y="40" width="6" height="6"/><rect x="84" y="52" width="6" height="6"/>
    <rect x="40" y="72" width="6" height="6"/><rect x="52" y="84" width="6" height="6"/>
    <rect x="72" y="72" width="24" height="24"/>
    <rect x="78" y="78" width="12" height="12" fill="var(--color-canvas)"/>
  </g>
</svg>`;

export function renderLobby(root, navigate) {
  let unsubscribe = null;

  const content = renderShell(root, {
    title: "Lobby",
    showBack: true,
    onBack: () => {
      leaveMockRoom();
      navigate("/");
    },
  });

  function draw() {
    const { room } = getMockState();

    if (!room) {
      navigate("/");
      return;
    }

    const ownPlayer = room.players.find((p) => p.id === getMockState().ownPlayerId);
    const allReady = room.players.every((p) => p.ready);
    const joinUrl = buildJoinUrl(room.roomCode);

    content.innerHTML = `
      <div class="room-code-display">
        <span class="eyebrow">${room.roomName}</span>
        <span class="room-code-display__value">${room.roomCode}</span>
        <div class="qr-frame">${QR_ICON}</div>
        <p class="status-text">Scan with a phone camera, or share the link below.<br>Placeholder QR — becomes a live scannable code once the backend issues real join links.</p>
        <button class="btn btn-ghost" type="button" data-role="share" style="width:auto; padding-left:24px; padding-right:24px;">Share join link</button>
      </div>

      <div>
        <p class="section-title" style="margin-bottom:var(--space-base);">Players (${room.players.length})</p>
        <ul class="player-list" data-role="player-list"></ul>
      </div>

      <div class="btn-block-group" style="margin-top:auto;">
        <button class="btn ${ownPlayer.ready ? "btn-secondary" : "btn-accent"}" type="button" data-role="ready">
          ${ownPlayer.ready ? "Not ready" : "I'm ready"}
        </button>
        ${
          ownPlayer.isHost
            ? `<button class="btn btn-primary" type="button" data-role="start" disabled>Start game</button>
               <p class="status-text">${allReady ? "Everyone is ready — starting the game arrives in Phase 4." : "Waiting for everyone to be ready."}</p>`
            : `<p class="status-text">Waiting for the host to start the game.</p>`
        }
      </div>
    `;

    const list = content.querySelector('[data-role="player-list"]');
    list.innerHTML = room.players
      .map(
        (p) => `
      <li class="player-row ${p.isHost ? "player-row--host" : ""}">
        <span class="player-row__name">
          <span class="player-avatar">${p.name.slice(0, 1).toUpperCase()}</span>
          ${p.name}${p.id === getMockState().ownPlayerId ? " (you)" : ""}
        </span>
        ${
          p.ready
            ? '<span class="badge badge-success">Ready</span>'
            : '<span class="badge badge-attention">Not ready</span>'
        }
      </li>
    `
      )
      .join("");

    content.querySelector('[data-role="ready"]').addEventListener("click", () => {
      toggleOwnReady();
    });

    content.querySelector('[data-role="share"]').addEventListener("click", async () => {
      const result = await shareJoinLink(room.roomCode, room.roomName);
      if (result.method === "clipboard") showToast("Join link copied");
      if (result.method === "unsupported") showToast(joinUrl);
    });
  }

  draw();
  unsubscribe = subscribeMockState(draw);

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
