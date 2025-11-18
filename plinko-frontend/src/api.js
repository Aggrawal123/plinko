const API_BASE = (window.__API_BASE__ || "http://localhost:3000");

export async function getCommit() {
  const res = await fetch(`${API_BASE}/commit`);
  if (!res.ok) throw new Error("Failed to fetch commit");
  return res.json();
}

export async function playGame({ clientSeed, nonce, rows = 12, startSlot = null }) {
  const res = await fetch(`${API_BASE}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientSeed, nonce, rows, startSlot })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Play error");
  return data;
}

export async function getRound(id) {
  const res = await fetch(`${API_BASE}/round/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Round fetch error");
  return data;
}
