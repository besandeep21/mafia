import { renderShell } from "./layout.js";
import { joinRoom } from "../state/roomStore.js";
import { normalizeRoomCodeInput, isCompleteRoomCode } from "../utils/roomCode.js";
import { getStoredPlayerName, setStoredPlayerName, setLastRoomCode } from "../services/identityService.js";
import { isBackendConfigured } from "../config.js";

export function renderJoin(root, navigate, params = {}) {
  const content = renderShell(root, {
    title: "Join a game",
    showBack: true,
    onBack: () => navigate("/"),
  });

  const storedName = getStoredPlayerName();
  const prefillCode = normalizeRoomCodeInput(params.code || "");

  content.innerHTML = `
    <form data-role="form" class="btn-block-group" style="flex:1;">
      <div style="flex:1; display:flex; flex-direction:column; gap: var(--space-xl);">
        ${
          isBackendConfigured()
            ? ""
            : `<div class="card" style="border-color:var(--color-critical-strong);">
                <p class="field-error" style="margin:0;">The game backend isn't configured yet. See apps-script/README.md to deploy it, then set API_BASE_URL in src/js/config.js.</p>
              </div>`
        }
        <div class="field">
          <label for="room-code">Room code</label>
          <input class="text-input code-input" id="room-code" name="roomCode" type="text"
            inputmode="numeric" pattern="[0-9]*" placeholder="000000" maxlength="6"
            autocomplete="off" value="${prefillCode}" />
          <span class="field-error visually-hidden" data-role="code-error">Enter the 6-digit code shown on the host's screen.</span>
          <span class="field-error visually-hidden" data-role="join-error"></span>
        </div>

        <div class="field">
          <label for="player-name">Your name</label>
          <input class="text-input" id="player-name" name="playerName" type="text"
            placeholder="What should we call you?" maxlength="24" autocomplete="off"
            value="${storedName ? storedName.replace(/"/g, "&quot;") : ""}" />
          <span class="field-error visually-hidden" data-role="name-error">Enter a name so other players can recognize you.</span>
        </div>
      </div>

      <button class="btn btn-accent" type="submit" data-role="submit">Join room</button>
    </form>
  `;

  const form = content.querySelector('[data-role="form"]');
  const codeInput = content.querySelector("#room-code");
  const nameInput = content.querySelector("#player-name");
  const codeError = content.querySelector('[data-role="code-error"]');
  const joinError = content.querySelector('[data-role="join-error"]');
  const nameError = content.querySelector('[data-role="name-error"]');
  const submitButton = content.querySelector('[data-role="submit"]');

  codeInput.addEventListener("input", () => {
    codeInput.value = normalizeRoomCodeInput(codeInput.value);
    joinError.classList.add("visually-hidden");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = normalizeRoomCodeInput(codeInput.value);
    const name = nameInput.value.trim();
    let hasError = false;

    joinError.classList.add("visually-hidden");

    if (!isCompleteRoomCode(code)) {
      codeInput.classList.add("has-error");
      codeError.classList.remove("visually-hidden");
      hasError = true;
    } else {
      codeInput.classList.remove("has-error");
      codeError.classList.add("visually-hidden");
    }

    if (!name) {
      nameInput.classList.add("has-error");
      nameError.classList.remove("visually-hidden");
      hasError = true;
    } else {
      nameInput.classList.remove("has-error");
      nameError.classList.add("visually-hidden");
    }

    if (hasError) {
      (isCompleteRoomCode(code) ? nameInput : codeInput).focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Joining…";

    const result = await joinRoom(code, name);

    if (result.error) {
      codeInput.classList.add("has-error");
      joinError.textContent = result.error;
      joinError.classList.remove("visually-hidden");
      codeInput.focus();
      submitButton.disabled = false;
      submitButton.textContent = "Join room";
      return;
    }

    setStoredPlayerName(name);
    setLastRoomCode(code);
    navigate(`/lobby?code=${code}`);
  });
}
