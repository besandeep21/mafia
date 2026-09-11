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
  API_BASE_URL: "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE",
};

export function isBackendConfigured() {
  return typeof CONFIG.API_BASE_URL === "string" && CONFIG.API_BASE_URL.startsWith("http");
}
