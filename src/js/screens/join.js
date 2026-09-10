import { renderShell } from "./layout.js";
import { joinRoom } from "../state/roomStore.js";
import { normalizeRoomCodeInput, isCompleteRoomCode } from "../utils/roomCode.js";
import { getStoredPlayerName, setStoredPlayerName, setLastRoomCode } from "../services/identityService.js";

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
        <div class="field">
          <label for="room-code">Room code</label>
          <input class="text-input code-input" id="room-code" name="roomCode" type="text"
            inputmode="numeric" pattern="[0-9]*" placeholder="000000" maxlength="6"
            autocomplete="off" value="${prefillCode}" />
          <span class="field-error visually-hidden" data-role="code-error">Enter the 6-digit code shown on the host's screen.</span>
          <span class="field-error visually-hidden" data-role="code-not-found">No room found with that code. Check with your host and try again.</span>
        </div>

        <div class="field">
          <label for="player-name">Your name</label>
          <input class="text-input" id="player-name" name="playerName" type="text"
            placeholder="What should we call you?" maxlength="24" autocomplete="off"
            value="${storedName ? storedName.replace(/"/g, "&quot;") : ""}" />
          <span class="field-error visually-hidden" data-role="name-error">Enter a name so other players can recognize you.</span>
        </div>
      </div>

      <button class="btn btn-accent" type="submit">Join room</button>
    </form>
  `;

  const form = content.querySelector('[data-role="form"]');
  const codeInput = content.querySelector("#room-code");
  const nameInput = content.querySelector("#player-name");
  const codeError = content.querySelector('[data-role="code-error"]');
  const codeNotFound = content.querySelector('[data-role="code-not-found"]');
  const nameError = content.querySelector('[data-role="name-error"]');

  codeInput.addEventListener("input", () => {
    codeInput.value = normalizeRoomCodeInput(codeInput.value);
    codeNotFound.classList.add("visually-hidden");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = normalizeRoomCodeInput(codeInput.value);
    const name = nameInput.value.trim();
    let hasError = false;

    codeNotFound.classList.add("visually-hidden");

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

    const result = joinRoom(code, name);

    if (result.error === "NOT_FOUND") {
      codeInput.classList.add("has-error");
      codeNotFound.textContent = "No room found with that code. Check with your host and try again.";
      codeNotFound.classList.remove("visually-hidden");
      codeInput.focus();
      return;
    }

    if (result.error === "ALREADY_STARTED") {
      codeInput.classList.add("has-error");
      codeNotFound.textContent = "That game has already started.";
      codeNotFound.classList.remove("visually-hidden");
      codeInput.focus();
      return;
    }

    setStoredPlayerName(name);
    setLastRoomCode(code);
    navigate(`/lobby?code=${code}`);
  });
}
