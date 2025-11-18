const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'plinko.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Failed to open DB', err);
});

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_commit TEXT,
      server_seed TEXT,
      client_seed TEXT,
      nonce TEXT,
      rows INTEGER,
      start_slot INTEGER,
      result_slot INTEGER,
      timestamp INTEGER
    )`);
  });
}

module.exports = { db, init };
