const crypto = require('crypto');
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest();
}
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest();
}
function* bitsFromBuffer(buf) {
  for (let byte of buf) {
    for (let i = 7; i >= 0; --i) {
      yield (byte >> i) & 1;
    }
  }
}
function rngBuffer(serverSeed, clientSeed, nonce, expandRounds = 4) {
  const base = sha256(`${serverSeed}:${clientSeed}:${nonce}`);
  let out = Buffer.from(base);
  for (let i = 0; i < expandRounds; i++) {
    out = Buffer.concat([out, sha256(Buffer.concat([base, Buffer.from([i])]))]);
  }
  return out;
}
function plinkoOutcome({ serverSeed, clientSeed, nonce, rows = 12, startSlot = null }) {
  const slots = rows + 1;
  let slot = (startSlot === null) ? Math.floor(slots / 2) : startSlot;
  const buf = rngBuffer(serverSeed, clientSeed, nonce, 6);
  const bits = bitsFromBuffer(buf);
  for (let r = 0; r < rows; r++) {
    const bit = bits.next().value || 0; 
    if (bit === 1) slot = Math.min(slot + 1, slots - 1);// to remove or prevent the slot overflow
    else slot = Math.max(slot - 1, 0);
  }
  return { slot, slots, rows, startSlot: (startSlot === null ? Math.floor(slots/2) : startSlot) };
}

module.exports = { plinkoOutcome, sha256 };