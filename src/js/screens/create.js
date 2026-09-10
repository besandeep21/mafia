import { renderShell } from "./layout.js";
import { createMockRoom } from "../state/mockState.js";
import { getStoredPlayerName, setStoredPlayerName, setLastRoomCode } from "../services/localStorageService.js";

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
      </div>

      <button class="btn btn-accent" type="submit">Create room</button>
    </form>
  `;

  const form = content.querySelector('[data-role="form"]');
  const hostNameInput = content.querySelector("#host-name");
  const nameError = content.querySelector('[data-role="name-error"]');

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const roomName = content.querySelector("#room-name").value;
    const hostName = hostNameInput.value.trim();

    if (!hostName) {
      hostNameInput.classList.add("has-error");
      nameError.classList.remove("visually-hidden");
      hostNameInput.focus();
      return;
    }

    hostNameInput.classList.remove("has-error");
    nameError.classList.add("visually-hidden");

    setStoredPlayerName(hostName);
    const room = createMockRoom(roomName, hostName);
    setLastRoomCode(room.roomCode);
    navigate("/lobby");
  });
}
