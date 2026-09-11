import { renderShell } from "./layout.js";
import { createRoom } from "../state/roomStore.js";
import { getStoredPlayerName, setStoredPlayerName, setLastRoomCode } from "../services/identityService.js";
import { isBackendConfigured } from "../config.js";
import { BackendNotConfiguredError } from "../services/apiClient.js";

export function renderCreate(root, navigate) {
  const content = renderShell(root, {
    title: "Host a game",
    showBack: true,
    onBack: () => navigate("/"),
  });

  const storedName = getStoredPlayerName();

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
          <label for="room-name">Room name</label>
          <input class="text-input" id="room-name" name="roomName" type="text"
            placeholder="Friday Mafia" maxlength="40" autocomplete="off" />
          <span class="field-hint">Shown to players before they join. You can leave this as-is.</span>
        </div>

        <div class="field">
          <label for="host-name">Your name</label>
          <input class="text-input" id="host-name" name="hostName" type="text"
            placeholder="What should we call you?" maxlength="24" autocomplete="off"
            value="${storedName ? storedName.replace(/"/g, "&quot;") : ""}" />
          <span class="field-error visually-hidden" data-role="name-error">Enter a name so other players can recognize you.</span>
        </div>

        <span class="field-error visually-hidden" data-role="network-error"></span>
      </div>

      <button class="btn btn-accent" type="submit" data-role="submit">Create room</button>
    </form>
  `;

  const form = content.querySelector('[data-role="form"]');
  const hostNameInput = content.querySelector("#host-name");
  const nameError = content.querySelector('[data-role="name-error"]');
  const networkError = content.querySelector('[data-role="network-error"]');
  const submitButton = content.querySelector('[data-role="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const roomName = content.querySelector("#room-name").value;
    const hostName = hostNameInput.value.trim();

    networkError.classList.add("visually-hidden");

    if (!hostName) {
      hostNameInput.classList.add("has-error");
      nameError.classList.remove("visually-hidden");
      hostNameInput.focus();
      return;
    }

    hostNameInput.classList.remove("has-error");
    nameError.classList.add("visually-hidden");

    submitButton.disabled = true;
    submitButton.textContent = "Creating room…";

    try {
      setStoredPlayerName(hostName);
      const room = await createRoom(roomName, hostName);
      setLastRoomCode(room.roomCode);
      navigate(`/lobby?code=${room.roomCode}`);
    } catch (err) {
      networkError.textContent =
        err instanceof BackendNotConfiguredError
          ? "The game backend isn't configured yet. See apps-script/README.md."
          : `Couldn't create the room: ${err.message}`;
      networkError.classList.remove("visually-hidden");
      submitButton.disabled = false;
      submitButton.textContent = "Create room";
    }
  });
}
