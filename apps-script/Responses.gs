/**
 * Responses.gs — every endpoint returns through one of these two
 * functions, so the response envelope is consistent no matter which
 * action handled the request.
 *
 * Phase 9: error responses now also carry a structured `code` (see
 * `ERR` in Utils.gs) alongside the existing human-readable `error`
 * string, so the frontend can react to *kinds* of failure (e.g. "the
 * room is genuinely gone" vs. "a request just failed") without
 * matching on English text. The `error` string itself is unchanged —
 * this is additive, not a breaking change to the response shape.
 */

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function okResponse_(data) {
  return jsonResponse_(Object.assign({ ok: true }, data));
}

/**
 * @param {string} message human-readable, shown to the player as-is
 * @param {string} [code] one of `ERR`'s values; defaults to a generic
 *   internal-error code if omitted so every response is still
 *   machine-parseable even from a call site that hasn't been updated.
 */
function errorResponse_(message, code) {
  return jsonResponse_({ ok: false, error: message, code: code || ERR.INTERNAL_ERROR });
}
