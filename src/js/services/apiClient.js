/**
 * apiClient
 *
 * All HTTP traffic to the Apps Script backend goes through here, so the
 * CORS workaround (see apps-script/Code.gs) and error handling live in
 * exactly one place, per CLAUDE_PROJECT_INSTRUCTIONS.md §17 ("Centralized
 * API handling").
 *
 * - Reads use GET with query params (no request body -> never triggers a
 *   CORS preflight).
 * - Writes use POST with Content-Type "text/plain" containing a JSON
 *   string body — "text/plain" is a browser CORS-safelisted content
 *   type, which also skips the preflight that Apps Script Web Apps
 *   can't reliably answer. The backend parses the JSON itself.
 */

import { CONFIG, isBackendConfigured } from "../config.js";

export class ApiError extends Error {}

export class BackendNotConfiguredError extends Error {
  constructor() {
    super("The game backend isn't configured yet.");
  }
}

async function parseResponse(res) {
  if (!res.ok) {
    throw new ApiError(`Network error (${res.status})`);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError("The server sent back something unexpected.");
  }
  if (!data.ok) {
    throw new ApiError(data.error || "Unknown server error.");
  }
  return data;
}

export async function apiGet(action, params = {}) {
  if (!isBackendConfigured()) throw new BackendNotConfiguredError();

  const url = new URL(CONFIG.API_BASE_URL);
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { method: "GET" });
  return parseResponse(res);
}

export async function apiPost(action, payload = {}) {
  if (!isBackendConfigured()) throw new BackendNotConfiguredError();

  const res = await fetch(CONFIG.API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload }),
  });
  return parseResponse(res);
}
