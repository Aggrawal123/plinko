import { sha256Hex } from "./PlinkoBoard";

export async function verifyServerSeed(serverSeed, expectedCommit) {
  const hex = await sha256Hex(serverSeed);
  return hex === expectedCommit;
}
