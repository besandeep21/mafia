/**
 * config.js
 *
 * Per ARCHITECTURE.md §17: "Frontend configuration should contain only
 * public values." Never put OAuth secrets, Drive tokens, or any backend
 * credential here — this file ships to every player's browser.
 *
 * After deploying the Apps Script backend (see apps-script/README.md),
 * paste your Web App's /exec URL below.
 */

export const CONFIG = {
  API_BASE_URL: "https://script.google.com/macros/s/AKfycbxMBf09_z_SyMydOH-SS73vjiDQAFx8GmBnLavv45EimFXFd9F1qlOP3PzWFlyV2KLrNg/exec",
};

export function isBackendConfigured() {
  return typeof CONFIG.API_BASE_URL === "string" && CONFIG.API_BASE_URL.startsWith("http");
}
