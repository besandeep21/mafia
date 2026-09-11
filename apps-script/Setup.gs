/**
 * Setup.gs
 *
 * One configuration value the host must set after creating their
 * "Mafia Games" Drive folder (see APPS_SCRIPT_SETUP.md Step 1 & 3).
 * Everything else the backend needs, it creates for itself.
 */

const CONFIG = {
  // Paste the folder ID from your Drive folder's URL here, e.g.
  // https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXX
  //                                          ^^^^^^^^^^^^^^^^ this part
  DRIVE_ROOT_FOLDER_ID: "PASTE_YOUR_DRIVE_FOLDER_ID_HERE",
};

/**
 * Run this once from the Apps Script editor after setting
 * CONFIG.DRIVE_ROOT_FOLDER_ID, before the first deployment.
 * It verifies Drive access and creates the "rooms" subfolder.
 * Google will prompt you to authorize the script the first time —
 * that's expected (see APPS_SCRIPT_SETUP.md Step 5).
 */
function initializeMafiaStorage() {
  if (CONFIG.DRIVE_ROOT_FOLDER_ID === "1T1EH-T3Wy8B539CukUScAahTDtMEZve5") {
    throw new Error(
      "Set CONFIG.DRIVE_ROOT_FOLDER_ID in Setup.gs to your Drive folder's ID before running this."
    );
  }

  const root = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  Logger.log("Found root folder: " + root.getName());

  const roomsFolder = getRoomsFolder_();
  Logger.log("Rooms folder ready: " + roomsFolder.getName());
  Logger.log("Setup complete. You can now deploy this as a Web App.");
}
