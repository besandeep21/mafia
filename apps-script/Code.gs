/**
 * Code.gs — the two functions Apps Script's web app runtime calls
 * directly. Everything else routes through Api.gs.
 *
 * Deliberate GET vs POST split, to work around a well-known Apps
 * Script + browser CORS interaction:
 *   - GET requests never trigger a CORS preflight (no body), so plain
 *     reads (getRoom, used for polling) go through doGet via query
 *     params. This is also why doGet doubles as the health check.
 *   - POST requests DO trigger a preflight (OPTIONS) if the body's
 *     Content-Type is "application/json" — and Apps Script Web Apps
 *     can't reliably answer that preflight. The frontend therefore
 *     sends POST bodies as Content-Type "text/plain" (a browser
 *     "CORS-safelisted" type, which skips preflight entirely) containing
 *     a JSON string; doPost parses it itself below.
 * See DECISIONS.md and README.md in this folder for more on this.
 */

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (!params.action) {
    return ContentService.createTextOutput("OK — Mafia backend is running.");
  }

  if (params.action === "getRoom") {
    return handleGetRoom_(params);
  }

  return errorResponse_("Unknown action: " + params.action);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return errorResponse_("Malformed request body.");
  }

  const action = body.action;
  const payload = body.payload || {};

  switch (action) {
    case "createRoom":
      return handleCreateRoom_(payload);
    case "joinRoom":
      return handleJoinRoom_(payload);
    case "setReady":
      return handleSetReady_(payload);
    case "leaveRoom":
      return handleLeaveRoom_(payload);
    default:
      return errorResponse_("Unknown action: " + action);
  }
}
