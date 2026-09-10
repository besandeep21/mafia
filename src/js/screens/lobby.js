import { renderShell, showToast } from "./layout.js";
import { getRoom, subscribeRoom, setOwnReady, leaveRoom } from "../state/roomStore.js";
import { getOrCreatePlayerId } from "../services/identityService.js";
import { buildJoinUrl, shareJoinLink } from "../services/shareService.js";
import { encodeQrToSvg } from "../services/qrRenderer.js";

export function renderLobby(root, navigate, params = {}) {
  const code = params.code;

  const content = renderShell(root, {
    title: "Lobby",
    showBack: true,
    onBack: () => {
      leaveRoom(code);
      navigate("/");
    },
  });

  if (!code) {
    navigate("/");
    return;
  }

  const ownPlayerId = getOrCreatePlayerId();

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function draw(room) {
    if (!room) {
      // The room disappeared (e.g. everyone else left, or it only exists
      // in a different browser/device — rooms don't sync across devices
      // until Phase 3's real backend).
      content.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap: var(--space-base); text-align:center;">
          <p class="section-title">This room isn't available</p>
          <p class="status-text">It may have ended, or it only exists in a different browser/device.</p>
          <button class="btn btn-primary" type="button" data-role="home" style="width:auto; padding-left:24px; padding-right:24px;">Back home</button>
        </div>
      `;
      content.querySelector('[data-role="home"]').addEventListener("click", () => navigate("/"));
      return;
    }

    const ownPlayer = room.players.find((p) => p.id === ownPlayerId);
    if (!ownPlayer) {
      // We're not (or no longer) a player in this room.
      navigate("/");
      return;
    }

    const allReady = room.players.every((p) => p.ready);
    const joinUrl = buildJoinUrl(room.roomCode);
    const qrSvg = encodeQrToSvg(joinUrl);

    content.innerHTML = `
      <div class="room-code-display">
        <span class="eyebrow">${escapeHtml(room.roomName)}</span>
        <span class="room-code-display__value">${room.roomCode}</span>
        <div class="qr-frame">${qrSvg || '<span class="status-text">Link too long for a QR code — use share instead.</span>'}</div>
        <p class="status-text">Scan with a phone camera, or share the link below.</p>
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
          <span class="player-avatar">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</span>
          ${escapeHtml(p.name)}${p.id === ownPlayerId ? " (you)" : ""}
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
      const updated = setOwnReady(code, !ownPlayer.ready);
      if (updated) draw(updated);
    });

    content.querySelector('[data-role="share"]').addEventListener("click", async () => {
      const result = await shareJoinLink(room.roomCode, room.roomName);
      if (result.method === "clipboard") showToast("Join link copied");
      if (result.method === "unsupported") showToast(joinUrl);
    });
  }

  draw(getRoom(code));
  const unsubscribe = subscribeRoom(code, draw);

  return () => unsubscribe();
}
