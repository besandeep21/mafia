import { escapeHtml, startCountdown } from "./layout.js";

function describeNightResult(room) {
  const lastNight = [...room.publicHistory].reverse().find((h) => h.type === "NIGHT_RESULT");
  if (!lastNight) return null;

  const lines = [];

  if (lastNight.deaths.length === 0) {
    lines.push("No one died last night.");
  } else {
    const names = lastNight.deaths
      .map((id) => room.players.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => p.name);
    if (names.length === 1) {
      lines.push(`${names[0]} was killed during the night.`);
    } else if (names.length > 1) {
      lines.push(`${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} were killed during the night.`);
    } else {
      lines.push("A player was killed during the night.");
    }
  }

  if (lastNight.revived) {
    const revivedPlayer = room.players.find((p) => p.id === lastNight.revived);
    if (revivedPlayer) lines.push(`${revivedPlayer.name} was mysteriously revived overnight!`);
  }

  return lines.join(" ");
}

function describeLastVote(room) {
  const lastVote = [...room.publicHistory].reverse().find((h) => h.type === "VOTE_RESULT");
  if (!lastVote) return null;
  if (lastVote.tie) return "Yesterday's vote ended in a tie — no one was eliminated.";
  if (!lastVote.eliminatedId) return "No one was eliminated in yesterday's vote.";
  const eliminated = room.players.find((p) => p.id === lastVote.eliminatedId);
  return eliminated ? `${eliminated.name} was voted out yesterday.` : null;
}

/**
 * @param {"DAY"|"DISCUSSION"} mode
 * @returns {() => void} cleanup
 */
export function renderDay(content, state, ctx, mode) {
  const { room } = state;
  const nightSummary = describeNightResult(room);
  const voteSummary = room.round > 1 ? describeLastVote(room) : null;

  content.innerHTML = `
    <div style="text-align:center;">
      <p class="status-text">${mode === "DAY" ? "Day" : "Discussion"} · Round ${room.round} · <span class="timer-badge" data-role="timer"></span></p>
    </div>

    <div class="card">
      <p class="section-title" style="margin-bottom:var(--space-base);">${mode === "DAY" ? "What happened" : "Discuss"}</p>
      ${nightSummary ? `<p class="status-text" style="margin-bottom:var(--space-xs);">${escapeHtml(nightSummary)}</p>` : ""}
      ${voteSummary ? `<p class="status-text">${escapeHtml(voteSummary)}</p>` : ""}
      ${
        mode === "DISCUSSION"
          ? `<p class="status-text" style="margin-top:var(--space-base);">Talk it over with the group. Voting starts when the timer runs out.</p>`
          : ""
      }
    </div>

    <div>
      <p class="eyebrow" style="margin-bottom:var(--space-base);">Players</p>
      <ul class="player-list" data-role="status-list"></ul>
    </div>
  `;

  const stopTimer = startCountdown(content.querySelector('[data-role="timer"]'), room.deadline);

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
