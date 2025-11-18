import React, { useEffect, useRef, useState } from "react";
import { generatePegs, computeBinCenters, rngBits, computePathFromBits, sha256Hex } from "./PlinkoBoard";
import { getCommit, playGame, getRound } from "./api";
import { verifyServerSeed } from "./verifier";

const ROWS = 12;
const WIDTH = 720;
const GAP = 38;
const TOP = 28;

function createAudioContext() {
  const C = window.AudioContext || window.webkitAudioContext;
  try { return new C(); } catch { return null; }
}
function playTick(audioCtx) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(800, now);
  g.gain.setValueAtTime(0.02, now);
  o.connect(g); g.connect(audioCtx.destination);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  o.start(now); o.stop(now + 0.05);
}
function playCelebrate(audioCtx) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const o1 = audioCtx.createOscillator(); const g1 = audioCtx.createGain();
  o1.type = "sine"; o1.frequency.setValueAtTime(440, now); g1.gain.setValueAtTime(0.12, now);
  o1.connect(g1); g1.connect(audioCtx.destination);
  const o2 = audioCtx.createOscillator(); const g2 = audioCtx.createGain();
  o2.type = "sawtooth"; o2.frequency.setValueAtTime(660, now); g2.gain.setValueAtTime(0.06, now);
  o2.connect(g2); g2.connect(audioCtx.destination);
  o1.start(now); o2.start(now);
  g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  o1.stop(now + 1); o2.stop(now + 1);
}

export default function App() {
  const [dropCol, setDropCol] = useState(Math.floor((ROWS)/2));
  const [bet, setBet] = useState(10);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [commit, setCommit] = useState(null);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("plinko_history") || "[]"));
  const [lastRound, setLastRound] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);


  const svgRef = useRef(null);
  const ballRef = useRef(null);
  const containerRef = useRef(null);
  const audioCtxRef = useRef(null);

  const pegs = generatePegs(ROWS, WIDTH, GAP, TOP);
  const binsMeta = computeBinCenters(ROWS, WIDTH, 40);

  useEffect(() => {
    const mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq && mq.matches);
    const onChange = () => setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    mq && mq.addEventListener && mq.addEventListener("change", onChange);
    audioCtxRef.current = createAudioContext();
    return () => {};
  }, []);

  useEffect(() => {
    getCommit().then(c => setCommit(c.commit)).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("plinko_history", JSON.stringify(history.slice(0, 40)));
  }, [history]);

  // keyboard controls
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") setDropCol(c => Math.max(0, c - 1));
      else if (e.key === "ArrowRight") setDropCol(c => Math.min(ROWS, c + 1));
      else if (e.code === "Space") { e.preventDefault(); onDrop(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onDrop() {
    if (simLoading) return;
    setSimLoading(true);
    const clientSeed = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const nonce = Date.now().toString();
    try {
      // call backend
      const resp = await playGame({ clientSeed, nonce, rows: ROWS, startSlot: dropCol });
      // resp contains id, commit, serverSeed, clientSeed, nonce, rows, startSlot, resultSlot
      setLastRound(resp);
      // compute bits and path on client for animation reproducibility
      const bits = await rngBits(resp.serverSeed, resp.clientSeed, resp.nonce, ROWS + 8);
      const path = computePathFromBits(ROWS, resp.startSlot, bits);
      const points = pathToPoints(path, binsMeta, GAP, TOP, ROWS, WIDTH);
      // animate
      await animateBall(points);
      // celebration
      if (!muted) playCelebrate(audioCtxRef.current);
      if (containerRef.current) makeConfetti(containerRef.current, points[points.length - 1].x, points[points.length - 1].y);

      // pulse bin
      pulseBin(resp.resultSlot);

      // save history
      const rec = { id: resp.id, slot: resp.resultSlot, bet: bet, time: new Date().toISOString() };
      setHistory(h => [rec, ...h].slice(0, 50));
      setSimLoading(false);
    } catch (err) {
      console.error(err);
      setSimLoading(false);
      alert("Play failed: " + (err.message || "unknown"));
    }
  }

  // map path entries to SVG points for animation (same logic used in PlinkoBoard)
  function pathToPoints(path, binsMeta, gap, top, rows, width) {
    const points = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (p.row === -1) points.push({ x: binsMeta.centers[p.slot], y: top - 12 });
      else {
        const r = p.row;
        const count = r + 1;
        const totalW = (count - 1) * gap;
        const startX = (width / 2) - (totalW / 2);
        const pegIndex = Math.round((p.slot / (rows) * (count - 1)));
        const x = startX + pegIndex * gap;
        const y = top + r * gap;
        points.push({ x, y });
      }
    }
    points.push({ x: binsMeta.centers[path[path.length - 1].slot], y: top + rows * gap + 72 });
    return points;
  }

  function pulseBin(idx) {
    const g = svgRef.current && svgRef.current.querySelectorAll(".bin")[idx];
    if (!g) return;
    g.classList.add("pulse");
    setTimeout(() => g.classList.remove("pulse"), 900);
  }

  // basic confetti (canvas overlay)
  function makeConfetti(container, x = 300, y = 450, count = 36) {
    const rect = container.getBoundingClientRect();
    const cvs = document.createElement("canvas");
    cvs.width = rect.width; cvs.height = rect.height;
    cvs.style.position = "absolute"; cvs.style.left = 0; cvs.style.top = 0; cvs.style.pointerEvents = "none";
    container.appendChild(cvs);
    const ctx = cvs.getContext("2d");
    const parts = [];
    for (let i = 0; i < count; i++) {
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 9 - 2,
        r: Math.random() * 6 + 3,
        col: ["#00f6ff","#9d4edd","#ff4d6d","#ffd666","#5af27b"][Math.floor(Math.random()*5)],
        rot: Math.random()*Math.PI
      });
    }
    let t0 = null, frames = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      const dt = (ts - t0) / 1000; t0 = ts;
      ctx.clearRect(0,0,cvs.width,cvs.height);
      for (let p of parts) {
        p.vy += 18 * dt; p.x += p.vx; p.y += p.vy; p.rot += dt * 6;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col; ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r*1.6);
        ctx.restore();
      }
      frames++;
      if (frames < 200) requestAnimationFrame(frame);
      else container.removeChild(cvs);
    }
    requestAnimationFrame(frame);
  }

  // animate the ball along points (requestAnimationFrame)
  function animateBall(points) {
    return new Promise((resolve) => {
      const ball = ballRef.current;
      if (!ball || reducedMotion) {
        const f = points[points.length - 1];
        if (ball) { ball.setAttribute("cx", f.x); ball.setAttribute("cy", f.y); }
        resolve();
        return;
      }
      let idx = 0;
      let segStart = performance.now();
      const segDur = 220;
      function step(now) {
        const p0 = points[idx], p1 = points[idx+1];
        if (!p1) { resolve(); return; }
        const t = Math.min(1, (now - segStart) / segDur);
        const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
        const x = p0.x + (p1.x - p0.x) * eased;
        const y = p0.y + (p1.y - p0.y) * eased;
        ball.setAttribute("cx", x); ball.setAttribute("cy", y);

        const hue = Math.floor((idx / points.length) * 360);
        ball.setAttribute("fill", `hsl(${hue}, 100%, 50%)`);

        if (t > 0.86 && !muted) playTick(audioCtxRef.current);
        if (t >= 1) { idx++; segStart = now; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // simple verifier: fetch round by id and show commit match
  async function verifyRound(id) {
    try {
      const r = await getRound(id);
      const ok = await verifyServerSeed(r.server_seed, r.server_commit);
      alert(`Round ${id} fetched. commit matches server_seed? ${ok}`);
    } catch (e) {
      alert("Verify error: " + (e.message || e));
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="title-wrapper">
    <div className="title-rainbow">PLINKO</div>
    <div className="title-rainbow-sub">Your Intro To Casino</div>
  </div>
        
       
        <div className="commit">Commit: <code>{commit || "—"}</code></div>
      </header>

      <main className="layout" ref={containerRef}>
        <aside className="sidebar">
          <div className="controls card">
  <label className="control-label">Drop column</label>
  <div className="picker">
    <button className="picker-btn" onClick={() => setDropCol(c => Math.max(0, c - 1))}>◀</button>
    <div className="drop-display">{dropCol}</div>
    <button className="picker-btn" onClick={() => setDropCol(c => Math.min(ROWS, c + 1))}>▶</button>
  </div>

  <label className="control-label">Bet amount</label>
  <input className="bet-input" type="number" min="1" value={bet} onChange={e => setBet(Number(e.target.value || 1))} />

  <div className="actions">
    <button className="action-btn" onClick={onDrop} disabled={simLoading}>
      {simLoading ? "Dropping…" : "Drop"}
    </button>
    <button className="action-btn" onClick={() => setMuted(m => !m)}>
      {muted ? "Unmute" : "Mute"}
    </button>
  </div>

  <div className="hint">Keyboard: ← / → to change column, Space to drop</div>
</div>


          <div className="history card">
            
            <div className="panel-title">Recent rounds</div>
            {history.length === 0 ? <div className="empty">— No rounds yet —</div> :
              history.map(h => (
                <div className="history-item" key={h.id}>
                  <div>#{h.id} • bin {h.slot}</div>
                  <div className="time">{new Date(h.time).toLocaleTimeString()}</div>
                </div>
              ))
            }
          </div>

          <div className="verify card">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Verifier</span>
          <button 
          className="verify-btn" 
          onClick={() => verifyRound(lastRound?.id || "")} 
          disabled={!lastRound}
          >
      Verify Last
    </button>
  </div>
  
  <div className="panel-note">
    Backend shows <code>serverSeed</code> (demo). In production, reveal occurs after window close.
  </div>
</div>

        </aside>

        <section className="board-area">
          <div className="board-wrap">
            <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${TOP + ROWS * GAP + 140}`} className="board-svg">
              <defs>
                <radialGradient id="pegGrad" cx="50%" cy="40%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="1" />
                  <stop offset="35%" stopColor="#9ae6ff" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.15" />
                </radialGradient>
              </defs>

              {/* pegs */}
              {pegs.map((p, i) => (
                <g key={i} transform={`translate(${p.x}, ${p.y})`} className="peg">
                  <circle r="7" className="peg-core" />
                  <circle r="12" className="peg-glow" />
                </g>
              ))}

              {/* bins */}
              <g transform={`translate(0, ${TOP + ROWS * GAP + 24})`}>
                {binsMeta.centers.map((cx, i) => (
                  <g key={i} className={`bin bin-${i}`}>
                    <rect x={cx - binsMeta.slotW/2} y={0} width={binsMeta.slotW - 4} height={68} rx="8" className="bin-rect" />
                    <text x={cx} y={46} fontSize="12" textAnchor="middle" className="bin-label">{(i+1)+"x"}</text>
                  </g>
                ))}
              </g>

              {/* ball */}
              <circle ref={ballRef} className="ball" cx={binsMeta.centers[dropCol]} cy={TOP - 10} r="10" />
            </svg>
          </div>
        </section>
      </main>

      <footer className="footer">This Plinko game is created by Saransh</footer>
    </div>
  );
}
