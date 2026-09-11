/**
 * Responses.gs — every endpoint returns through one of these two
 * functions, so the response envelope is consistent no matter which
 * action handled the request.
 */

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function okResponse_(data) {
  return jsonResponse_(Object.assign({ ok: true }, data));
}

function errorResponse_(message) {
  return jsonResponse_({ ok: false, error: message });
}
