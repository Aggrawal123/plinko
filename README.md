## Overview 
This Plinko App  is a minimal prototype demonstrating: 
- Commit-reveal RNG (server publishes commit = SHA256(serverSeed))
-  Deterministic plinko outcome engine (server + client replayable)
-  Simple Node/Express backend with SQLite logging
-  A React frontend that requests a play, replays the outcome and animates the ball
-  Verifier page to recompute / validate rounds.
-  Enhanced engine using a small AI module to suggest optimal starting positions or predict likely ball paths based on previous outcomes.
  ## Quick start ###
Backend 
Open a terminal:
bash
cd backend
npm install
node server.js
Frontend 
cd frontend
npm run dev
