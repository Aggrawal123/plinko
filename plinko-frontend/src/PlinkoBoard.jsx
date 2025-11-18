import React from "react";

/**
 * PlinkoBoard
 * - rows: number of rows (12)
 * - width: pixel width for layout (responsive via CSS)
 * - produces pegs[] and bin centers
 */

export function generatePegs(rows = 12, width = 720, gap = 38, top = 28) {
  const pegs = [];
  for (let r = 0; r < rows; r++) {
    const count = r + 3;
    const totalW = (count - 1) * gap;
    const startX = (width / 2) - (totalW / 2);
    const y = top + r * gap;
    for (let c = 0; c < count; c++) {
      pegs.push({ x: startX + c * gap, y, row: r, col: c });
    }
  }
  return pegs;
}

export function computeBinCenters(rows = 12, width = 720, slotW = 40) {
  const bins = rows + 1;
  const total = bins * slotW;
  const left = (width - total) / 2;
  const centers = Array.from({ length: bins }, (_, i) => left + i * slotW + slotW / 2);
  return { centers, slotW, left };
}

// browser SHA-256 hex
export async function sha256Hex(str) {
  const enc = new TextEncoder();
  const h = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// expand into bits (client-side replay)
export async function rngBits(serverSeed, clientSeed, nonce, bitsNeeded = 128) {
  let out = new Uint8Array([]);
  let i = 0;
  while (out.length * 8 < bitsNeeded) {
    const input = `${serverSeed}:${clientSeed}:${nonce}:${i}`;
    const hex = await sha256Hex(input);
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
    const newOut = new Uint8Array(out.length + bytes.length);
    newOut.set(out);
    newOut.set(bytes, out.length);
    out = newOut;
    i++;
  }
  const bits = [];
  for (let b of out) {
    for (let j = 7; j >= 0; --j) bits.push((b >> j) & 1);
  }
  return bits.slice(0, bitsNeeded);
}

// compute path from bits: starting slot -> sequence of slots per row
export function computePathFromBits(rows, startSlot, bits) {
  const slots = rows + 1;
  let slot = startSlot;
  const path = [{ row: -1, slot }]; // initial
  for (let r = 0; r < rows; r++) {
    const bit = bits[r] || 0;
    if (bit === 1) slot = Math.min(slot + 1, slots - 1);
    else slot = Math.max(slot - 1, 0);
    path.push({ row: r, slot });
  }
  return path;
}
