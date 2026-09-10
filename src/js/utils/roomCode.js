/**
 * Generates a random 6-digit numeric room code.
 * Per ARCHITECTURE.md: "The 6-digit code is for human entry."
 * It is NOT a security credential — in later phases the real
 * authorization will use a separate unpredictable room secret/token
 * issued by the backend. This mock only needs the human-facing code.
 * @returns {string}
 */
export function generateRoomCode() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

/**
 * Normalizes user-typed room code input: strips non-digits, caps at 6 chars.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeRoomCodeInput(raw) {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isCompleteRoomCode(code) {
  return /^\d{6}$/.test(code);
}
