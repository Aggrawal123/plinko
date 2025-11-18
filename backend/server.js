const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { plinkoOutcome } = require('./engine');
const { db, init } = require('./db');

init();

const app = express();
app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

let active = {
  serverSeed: crypto.randomBytes(32).toString('hex'),
  commit: null,
  commitTime: Date.now()
};
active.commit = crypto
  .createHash('sha256')
  .update(active.serverSeed)
  .digest('hex');

//app.use('/',(req,res)=>{
  //res.send("app listening ")})
app.get('/commit', (req, res) => {
  res.json({ commit: active.commit, commitTime: active.commitTime });
});


app.post('/play', (req, res) => {
  const { clientSeed, nonce = Date.now().toString(), rows = 12, startSlot = null  } = req.body;
  if (!clientSeed){
    return res.status(400).json({ error: 'clientSeed required' })
};

  const serverSeed = active.serverSeed;
  const result = plinkoOutcome({ serverSeed, clientSeed, nonce, rows, startSlot });

  const stmt = db.prepare(`INSERT INTO rounds (server_commit, server_seed, client_seed, nonce, rows, start_slot, result_slot, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  stmt.run(active.commit, serverSeed, clientSeed, String(nonce), rows, result.startSlot, result.slot, Date.now(), function(err) {
    if (err) {
      console.error('DB insert error', err);
      return res.status(500).json({ error: err.message });
    }

    res.json({
      id: this.lastID,
      commit: active.commit,
      serverSeed,
      clientSeed,
      nonce,
      rows,
      startSlot: result.startSlot,
      resultSlot: result.slot
    });
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Plinko Game listening to the port ${PORT}`));
