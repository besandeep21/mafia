/**
 * qrEncoder.js
 *
 * A minimal, self-contained QR Code encoder implementing the parts of
 * ISO/IEC 18004 needed to encode a short URL as byte-mode data:
 *   - versions 1-6 only (avoids the version-info BCH bits required from
 *     version 7 up, which this app's join URLs never need — see
 *     DECISIONS.md)
 *   - error correction levels M then L, whichever fits
 *   - standard 8 mask patterns with penalty-rule scoring for a
 *     real-world-scannable result
 *
 * Deliberately dependency-free and network-free: this runs entirely in
 * the player's browser at the moment a room code exists, matching the
 * project's "no unnecessary third-party services" rule.
 *
 * Returns null if the input is too long to fit in version 1-6 at the
 * lowest supported error correction level; callers should fall back to
 * showing the plain join link in that case.
 */

// ---------- GF(256) arithmetic ----------

const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Generator polynomial for `degree` EC codewords, lowest-degree-first, poly[degree] === 1. */
function computeGeneratorPolyLowFirst(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const root = GF_EXP[i];
    const next = new Array(poly.length + 1).fill(0);
    for (let k = 0; k < poly.length; k++) {
      next[k + 1] ^= poly[k];
      next[k] ^= gfMul(poly[k], root);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon remainder (EC codewords) for one block of data codewords. */
function computeEccCodewords(dataCodewords, eccLen) {
  const genLowFirst = computeGeneratorPolyLowFirst(eccLen);
  const genHighFirst = genLowFirst.slice().reverse(); // index0 = leading coeff (=1)

  let remainder = new Array(eccLen).fill(0);
  for (const dataByte of dataCodewords) {
    const factor = dataByte ^ remainder[0];
    remainder = remainder.slice(1);
    remainder.push(0);
    for (let i = 0; i < eccLen; i++) {
      remainder[i] ^= gfMul(genHighFirst[i + 1], factor);
    }
  }
  return remainder;
}

// ---------- Version capacity tables (versions 1-6 only) ----------

const ECC_CODEWORDS_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18],
  M: [0, 10, 16, 26, 18, 24, 16],
};

const NUM_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2],
  M: [0, 1, 1, 1, 2, 2, 4],
};

const ALIGNMENT_SECOND_POS = { 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };

function getNumRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function getDataCodewordCapacity(ver, level) {
  const raw = getNumRawDataModules(ver);
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[level][ver];
  const numBlocks = NUM_BLOCKS[level][ver];
  return Math.floor(raw / 8) - eccPerBlock * numBlocks;
}

// ---------- Bitstream construction ----------

class BitBuffer {
  constructor() {
    this.bits = [];
  }
  pushBits(value, length) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
  get length() {
    return this.bits.length;
  }
}

/** Encodes bytes into the byte-mode segment + terminator + byte padding, for a chosen version. */
function buildDataCodewords(bytes, ver, level) {
  const capacityCodewords = getDataCodewordCapacity(ver, level);
  const capacityBits = capacityCodewords * 8;

  const buf = new BitBuffer();
  buf.pushBits(0b0100, 4); // byte mode indicator
  buf.pushBits(bytes.length, 8); // char count indicator (versions 1-9)
  for (const b of bytes) buf.pushBits(b, 8);

  if (buf.length > capacityBits) return null; // doesn't fit

  // Terminator: up to 4 zero bits, only as many as fit.
  const terminatorLen = Math.min(4, capacityBits - buf.length);
  buf.pushBits(0, terminatorLen);

  // Pad to a byte boundary.
  while (buf.length % 8 !== 0) buf.bits.push(0);

  // Convert to bytes.
  const dataBytes = [];
  for (let i = 0; i < buf.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buf.bits[i + j];
    dataBytes.push(byte);
  }

  // Pad with alternating 0xEC/0x11 until capacity is filled.
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (dataBytes.length < capacityCodewords) {
    dataBytes.push(padBytes[padIndex % 2]);
    padIndex++;
  }

  return dataBytes;
}

/** Splits data codewords into group1/group2 blocks per the version's block table, computes EC, interleaves. */
function buildFinalCodewords(dataBytes, ver, level) {
  const numBlocks = NUM_BLOCKS[level][ver];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[level][ver];
  const totalData = dataBytes.length;

  const shortLen = Math.floor(totalData / numBlocks);
  const numLongBlocks = totalData % numBlocks;

  const blocks = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = shortLen + (b >= numBlocks - numLongBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + len);
    offset += len;
    blocks.push({ data: block, ecc: computeEccCodewords(block, eccLen) });
  }

  const maxDataLen = Math.max(...blocks.map((b) => b.data.length));
  const interleavedData = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) {
      if (i < block.data.length) interleavedData.push(block.data[i]);
    }
  }

  const interleavedEcc = [];
  for (let i = 0; i < eccLen; i++) {
    for (const block of blocks) interleavedEcc.push(block.ecc[i]);
  }

  return interleavedData.concat(interleavedEcc);
}

// ---------- Module placement ----------

function createGrid(size) {
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  return { size, modules, isFunction };
}

function setFunctionModule(grid, row, col, dark) {
  grid.modules[row][col] = dark;
  grid.isFunction[row][col] = true;
}

/** Draws a 7x7 finder pattern (concentric squares) plus its 1-module light separator border. */
function drawFinderPatternCorrect(grid, topRow, topCol) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const r = topRow + dy;
      const c = topCol + dx;
      if (r < 0 || r >= grid.size || c < 0 || c >= grid.size) continue;
      let dark;
      if (dy === -1 || dy === 7 || dx === -1 || dx === 7) {
        dark = false; // separator (1-module light border)
      } else {
        const ring = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
        // 7x7 finder pattern rings (Chebyshev distance from center): 0=dark, 1=dark, 2=light, 3=dark.
        dark = ring !== 2;
      }
      setFunctionModule(grid, r, c, dark);
    }
  }
}

function drawTimingPatterns(grid) {
  const size = grid.size;
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (!grid.isFunction[6][i]) setFunctionModule(grid, 6, i, dark);
    if (!grid.isFunction[i][6]) setFunctionModule(grid, i, 6, dark);
  }
}

function drawAlignmentPattern(grid, centerRow, centerCol) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const r = centerRow + dy;
      const c = centerCol + dx;
      const ring = Math.max(Math.abs(dy), Math.abs(dx));
      const dark = ring !== 1;
      setFunctionModule(grid, r, c, dark);
    }
  }
}

function getBit(x, i) {
  return ((x >>> i) & 1) !== 0;
}

const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

function drawFormatBits(grid, level, mask) {
  const size = grid.size;
  const data = (ECC_FORMAT_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  rem &= 0x3ff;
  const bits = ((data << 10) | rem) ^ 0x5412;

  // First copy (note: setFunctionModule takes (row, col) — the reference algorithm this
  // is ported from uses (col, row), so every coordinate pair below is intentionally
  // swapped relative to how it reads in that reference).
  for (let i = 0; i <= 5; i++) setFunctionModule(grid, i, 8, getBit(bits, i));
  setFunctionModule(grid, 7, 8, getBit(bits, 6));
  setFunctionModule(grid, 8, 8, getBit(bits, 7));
  setFunctionModule(grid, 8, 7, getBit(bits, 8));
  for (let i = 9; i < 15; i++) setFunctionModule(grid, 8, 14 - i, getBit(bits, i));

  // Second copy
  for (let i = 0; i < 8; i++) setFunctionModule(grid, 8, size - 1 - i, getBit(bits, i));
  for (let i = 8; i < 15; i++) setFunctionModule(grid, size - 15 + i, 8, getBit(bits, i));
  setFunctionModule(grid, 8, size - 8, true); // always-dark module
}

function drawFunctionPatterns(grid, ver) {
  drawFinderPatternCorrect(grid, 0, 0);
  drawFinderPatternCorrect(grid, 0, grid.size - 7);
  drawFinderPatternCorrect(grid, grid.size - 7, 0);

  drawTimingPatterns(grid);

  const secondPos = ALIGNMENT_SECOND_POS[ver];
  if (secondPos) drawAlignmentPattern(grid, secondPos, secondPos);

  // Reserve format info areas with placeholder false; real bits drawn after mask selection.
  drawFormatBits(grid, "M", 0);
}

/** Places codeword bits into the grid using the standard zigzag column scan, skipping function modules. */
function placeDataBits(grid, codewords) {
  const bits = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1);
  }

  let bitIndex = 0;
  const size = grid.size;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (grid.isFunction[row][col]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        grid.modules[row][col] = bit === 1;
        bitIndex++;
      }
    }
  }
}

const MASK_FUNCTIONS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(grid, maskIndex, dataMaskSnapshot) {
  const fn = MASK_FUNCTIONS[maskIndex];
  for (let r = 0; r < grid.size; r++) {
    for (let c = 0; c < grid.size; c++) {
      if (grid.isFunction[r][c]) continue;
      const original = dataMaskSnapshot[r][c];
      grid.modules[r][c] = fn(r, c) ? !original : original;
    }
  }
}

function computePenalty(grid) {
  const size = grid.size;
  const m = grid.modules;
  let penalty = 0;

  // Rule 1: runs of 5+ same-color modules, per row and column.
  for (let r = 0; r < size; r++) {
    let runColor = m[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (m[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = m[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = m[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (m[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = m[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of same color.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const color = m[r][c];
      if (m[r][c + 1] === color && m[r + 1][c] === color && m[r + 1][c + 1] === color) {
        penalty += 3;
      }
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like patterns, padded by 4 light modules on one side.
  const patternA = [true, false, true, true, true, false, true, false, false, false, false];
  const patternB = [false, false, false, false, true, false, true, true, true, false, true];
  const matchesAt = (getter, start) => {
    for (let k = 0; k < 11; k++) {
      if (getter(start + k) !== patternA[k]) return checkB(getter, start);
    }
    return true;
  };
  const checkB = (getter, start) => {
    for (let k = 0; k < 11; k++) {
      if (getter(start + k) !== patternB[k]) return false;
    }
    return true;
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      if (matchesAt((i) => m[r][i], c)) penalty += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 11; r++) {
      if (matchesAt((i) => m[i][c], r)) penalty += 40;
    }
  }

  // Rule 4: proportion of dark modules.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const percentDark = (dark * 100) / (size * size);
  const deviation = Math.floor(Math.abs(percentDark - 50) / 5) * 10;
  penalty += deviation;

  return penalty;
}

// ---------- Public API ----------

/**
 * Encodes `text` (ASCII/URL-safe expected) as a QR code.
 * @returns {{ size: number, modules: boolean[][] } | null}
 */
export function encodeQr(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i) & 0xff);
  }

  let chosenVer = null;
  let chosenLevel = null;
  let dataCodewords = null;

  for (const level of ["M", "L"]) {
    for (let ver = 1; ver <= 6; ver++) {
      const built = buildDataCodewords(bytes, ver, level);
      if (built) {
        chosenVer = ver;
        chosenLevel = level;
        dataCodewords = built;
        break;
      }
    }
    if (chosenVer) break;
  }

  if (!chosenVer) return null; // too long even at version 6 / level L

  const finalCodewords = buildFinalCodewords(dataCodewords, chosenVer, chosenLevel);

  const size = 4 * chosenVer + 17;
  const grid = createGrid(size);
  drawFunctionPatterns(grid, chosenVer);

  // Place codeword bits; any remaining non-function modules beyond the codewords
  // (the version's "remainder bits") are implicitly filled with 0 by placeDataBits.
  placeDataBits(grid, finalCodewords);

  const dataSnapshot = grid.modules.map((row) => row.slice());

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(grid, mask, dataSnapshot);
    drawFormatBits(grid, chosenLevel, mask);
    const penalty = computePenalty(grid);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
  }

  applyMask(grid, bestMask, dataSnapshot);
  drawFormatBits(grid, chosenLevel, bestMask);

  return { size, modules: grid.modules };
}
