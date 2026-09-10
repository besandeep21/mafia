import { renderShell } from "./layout.js";
import { getLastRoomCode } from "../services/identityService.js";

const MOON_MARK = `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
  <circle cx="28" cy="28" r="20" fill="var(--color-primary)"/>
  <circle cx="34" cy="24" r="17" fill="var(--color-canvas)"/>
</svg>`;

export function renderLanding(root, navigate) {
  const content = renderShell(root, { title: "" });
  const lastCode = getLastRoomCode();

  content.innerHTML = `
    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap: var(--space-xl); text-align:center;">
      ${MOON_MARK}
      <div>
        <h2 class="section-title" style="font-size:32px; font-weight:500; margin-bottom:var(--space-xs);">Mafia</h2>
        <p class="status-text">No moderator needed. Gather your group, pick a device to host, and everyone else joins from their own phone.</p>
      </div>
    </div>

    <div class="btn-block-group">
      <button class="btn btn-primary" type="button" data-role="host">Host a game</button>
      <button class="btn btn-secondary" type="button" data-role="join">Join a game</button>
      ${lastCode ? `<p class="status-text">Last room: ${lastCode}</p>` : ""}
    </div>
  `;

  content.querySelector('[data-role="host"]').addEventListener("click", () => navigate("/create"));
  content.querySelector('[data-role="join"]').addEventListener("click", () => navigate("/join"));
}
