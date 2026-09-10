/**
 * shareService
 * Builds the shareable join URL for a room and hands it to the
 * platform share sheet when available, falling back to clipboard copy.
 * QR encoding of this same URL is a Phase 2/3 concern (see DECISIONS.md) —
 * once the backend issues real room codes/tokens, the QR should encode
 * this exact URL shape.
 */

export function buildJoinUrl(roomCode) {
  const url = new URL(window.location.href);
  url.hash = `#/join?code=${encodeURIComponent(roomCode)}`;
  return url.toString();
}

export async function shareJoinLink(roomCode, roomName) {
  const url = buildJoinUrl(roomCode);
  const text = `Join "${roomName}" on Mafia — code ${roomCode}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "Join Mafia game", text, url });
      return { method: "share" };
    } catch {
      // User cancelled the share sheet — not an error, just no-op.
      return { method: "cancelled" };
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(url);
    return { method: "clipboard" };
  }

  return { method: "unsupported", url };
}
