import { renderShell, showToast, escapeHtml } from "./layout.js";
import { getRoomState, subscribeRoom, setOwnReady, leaveRoom, startGame } from "../state/roomStore.js";
import { getOrCreatePlayerId } from "../services/identityService.js";
import { buildJoinUrl, shareJoinLink } from "../services/shareService.js";
import { encodeQrToSvg } from "../services/qrRenderer.js";
import { isBackendConfigured } from "../config.js";
import { renderRoleReveal } from "./roleReveal.js";
import { renderNight } from "./night.js";
import { renderDay } from "./day.js";
import { renderVoting } from "./voting.js";
import { renderGameOver } from "./gameOver.js";

const PHASE_TITLES = {
  LOBBY: "Lobby",
  ROLE_REVEAL: "Your Role",
  NIGHT: "Night",
  DAY: "Day",
  DISCUSSION: "Discussion",
  VOTING: "Vote",
  GAME_OVER: "Game Over",
};

// Phases where leaving the room record entirely (vs. just navigating away
// and keeping your session for reconnect) makes sense. Per GAME_RULES.md,
// the game must survive a disconnect — pressing back mid-game should not
// erase a living player's role, vote, or night action.
const SAFE_TO_FULLY_LEAVE_PHASES = new Set(["LOBBY", "GAME_OVER"]);

export function renderLobby(root, navigate, params = {}) {
  const code = params.code;

  if (!code) {
    navigate("/");
    return;
  }

  if (!isBackendConfigured()) {
    const content = renderShell(root, { title: "Lobby", showBack: true, onBack: () => navigate("/") });
    content.innerHTML = `
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap: var(--space-base); text-align:center;">
        <p class="section-title">Backend not configured</p>
        <p class="status-text">See apps-script/README.md to deploy the backend, then set API_BASE_URL in src/js/config.js.</p>
        <button class="btn btn-primary" type="button" data-role="home" style="width:auto; padding-left:24px; padding-right:24px;">Back home</button>
      </div>
    `;
    content.querySelector('[data-role="home"]').addEventListener("click", () => navigate("/"));
    return;
  }

  const ownPlayerId = getOrCreatePlayerId();
  let latestPhase = null;
  let phaseCleanup = null;

  function onBack() {
    if (SAFE_TO_FULLY_LEAVE_PHASES.has(latestPhase) || latestPhase === null) {
      navigate("/");
      leaveRoom(code);
    } else {
      // Mid-game: just step away. Session token stays valid, so re-entering
      // the room code (or this same tab polling again) picks up right where
      // this player left off.
      navigate("/");
    }
  }

  function draw(state) {
    if (typeof phaseCleanup === "function") {
      phaseCleanup();
      phaseCleanup = null;
    }

    const { room } = state;

    const content = renderShell(root, {
      title: room ? PHASE_TITLES[room.phase] || "Room" : "Lobby",
      showBack: true,
      onBack,
    });

    if (!room) {
      drawUnavailable(content);
      return;
    }

    latestPhase = room.phase;

    const ownPlayer = room.players.find((p) => p.id === ownPlayerId);
    if (!ownPlayer && room.phase !== "GAME_OVER") {
      // Not (or no longer) a player in this room, and the game isn't over
      // (where spectating the final reveal without being a player is fine).
      navigate("/");
      return;
    }

    const ctx = { roomCode: code, ownPlayerId, navigate, onStateUpdate: draw };

    switch (room.phase) {
      case "LOBBY":
        phaseCleanup = drawLobbyView(content, state, ctx);
        break;
      case "ROLE_REVEAL":
        phaseCleanup = renderRoleReveal(content, state, ctx);
        break;
      case "NIGHT":
        phaseCleanup = renderNight(content, state, ctx);
        break;
      case "DAY":
        phaseCleanup = renderDay(content, state, ctx, "DAY");
        break;
      case "DISCUSSION":
        phaseCleanup = renderDay(content, state, ctx, "DISCUSSION");
        break;
      case "VOTING":
        phaseCleanup = renderVoting(content, state, ctx);
        break;
      case "GAME_OVER":
        phaseCleanup = renderGameOver(content, state, ctx);
        break;
      default:
        drawUnavailable(content);
    }
  }

  function drawUnavailable(content) {
    content.innerHTML = `
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap: var(--space-base); text-align:center;">
        <p class="section-title">This room isn't available</p>
        <p class="status-text">It may have ended, or the code was mistyped.</p>
        <button class="btn btn-primary" type="button" data-role="home" style="width:auto; padding-left:24px; padding-right:24px;">Back home</button>
      </div>
    `;
    content.querySelector('[data-role="home"]').addEventListener("click", () => navigate("/"));
  }

  drawLoading(root);
  getRoomState(code).then((state) => draw(state || { room: null, private: null, mafia: null }));
  const unsubscribe = subscribeRoom(code, draw);

  return () => {
    if (typeof phaseCleanup === "function") phaseCleanup();
    unsubscribe();
  };
}

function drawLoading(root) {
  const content = renderShell(root, { title: "Lobby", showBack: false });
  content.innerHTML = `
    <div style="flex:1; display:flex; align-items:center; justify-content:center;">
      <p class="status-text">Loading room…</p>
    </div>
  `;
}

function drawLobbyView(content, state, ctx) {
  const { room } = state;
  const ownPlayer = room.players.find((p) => p.id === ctx.ownPlayerId);
  const allReady = room.players.every((p) => p.ready);
  const enoughPlayers = room.players.length >= 3;
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
          ? `<button class="btn btn-primary" type="button" data-role="start" ${allReady && enoughPlayers ? "" : "disabled"}>Start game</button>
             <p class="status-text">${
               !enoughPlayers
                 ? "Need at least 3 players to start."
                 : allReady
                   ? "Everyone is ready!"
                   : "Waiting for everyone to be ready."
             }</p>`
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
        ${escapeHtml(p.name)}${p.id === ctx.ownPlayerId ? " (you)" : ""}
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

  const readyButton = content.querySelector('[data-role="ready"]');
  readyButton.addEventListener("click", async () => {
    readyButton.disabled = true;
    const updated = await setOwnReady(ctx.roomCode, !ownPlayer.ready);
    if (updated) ctx.onStateUpdate({ room: updated, private: null, mafia: null });
    else readyButton.disabled = false;
  });

  const startButton = content.querySelector('[data-role="start"]');
  if (startButton) {
    startButton.addEventListener("click", async () => {
      startButton.disabled = true;
      startButton.textContent = "Starting…";
      const result = await startGame(ctx.roomCode);
      if (result.error) {
        showToast(result.error);
        startButton.disabled = false;
        startButton.textContent = "Start game";
        return;
      }
      ctx.onStateUpdate(result);
    });
  }

  content.querySelector('[data-role="share"]').addEventListener("click", async () => {
    const result = await shareJoinLink(room.roomCode, room.roomName);
    if (result.method === "clipboard") showToast("Join link copied");
    if (result.method === "unsupported") showToast(joinUrl);
  });

  return () => {};
}
