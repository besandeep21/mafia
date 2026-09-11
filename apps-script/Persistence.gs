/**
 * Persistence.gs
 *
 * Everything that touches Drive lives here, isolated from the business
 * logic in Rooms.gs, per ARCHITECTURE.md §12 ("Keep Drive storage
 * implementation isolated so it can be replaced later").
 *
 * Layout inside the configured Drive folder:
 *   MafiaGames/
 *     rooms/
 *       583214.json
 *       042817.json
 */

let cachedRoomsFolder_ = null;

function getRoomsFolder_() {
  if (cachedRoomsFolder_) return cachedRoomsFolder_;

  const root = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  const existing = root.getFoldersByName("rooms");
  cachedRoomsFolder_ = existing.hasNext() ? existing.next() : root.createFolder("rooms");
  return cachedRoomsFolder_;
}

function roomFileName_(roomCode) {
  return roomCode + ".json";
}

function findRoomFile_(roomCode) {
  const folder = getRoomsFolder_();
  const it = folder.getFilesByName(roomFileName_(roomCode));
  return it.hasNext() ? it.next() : null;
}

function roomExists_(roomCode) {
  return findRoomFile_(roomCode) !== null;
}

/** @returns {object|null} */
function readRoom_(roomCode) {
  const file = findRoomFile_(roomCode);
  if (!file) return null;
  try {
    return JSON.parse(file.getBlob().getDataAsString());
  } catch (err) {
    // A corrupted room file shouldn't crash the whole request; treat it as missing.
    Logger.log("Failed to parse room file " + roomCode + ": " + err);
    return null;
  }
}

/** Creates or overwrites the room's JSON file. @returns {object} the same room passed in */
function writeRoom_(room) {
  const folder = getRoomsFolder_();
  const existing = findRoomFile_(room.roomCode);
  const content = JSON.stringify(room);

  if (existing) {
    existing.setContent(content);
  } else {
    folder.createFile(roomFileName_(room.roomCode), content, MimeType.PLAIN_TEXT);
  }
  return room;
}

/** Soft-deletes a room (moves to trash rather than a permanent delete). */
function deleteRoom_(roomCode) {
  const file = findRoomFile_(roomCode);
  if (file) file.setTrashed(true);
}
