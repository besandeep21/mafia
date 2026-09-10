import { encodeQr } from "./qrEncoder.js";

/**
 * Encodes `text` as a QR code and returns ready-to-inject SVG markup,
 * or null if the text is too long to encode (see qrEncoder.js limits).
 * SVG (not a raster image) so it stays crisp at any device pixel ratio
 * without the app needing to pick a fixed pixel size up front.
 */
export function encodeQrToSvg(text) {
  const qr = encodeQr(text);
  if (!qr) return null;

  const quietZone = 4; // modules of light border, per spec minimum
  const total = qr.size + quietZone * 2;

  let path = "";
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) {
        const x = c + quietZone;
        const y = r + quietZone;
        path += `M${x},${y}h1v1h-1z`;
      }
    }
  }

  return `<svg viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code to join the room" shape-rendering="crispEdges">
    <rect width="${total}" height="${total}" fill="var(--color-canvas)" />
    <path d="${path}" fill="var(--color-ink-deep)" />
  </svg>`;
}
