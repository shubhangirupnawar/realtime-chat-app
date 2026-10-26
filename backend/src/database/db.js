const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// DB file will be created under backend/db/chat.db
const dbDir = path.resolve(__dirname, '../../db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.resolve(dbDir, 'chat.db');

let db;

/** Initialise the SQLite DB and create the messages table */
function initDb() {
  db = new sqlite3.Database(dbPath, err => {
    if (err) console.error('Failed to connect to SQLite:', err);
    else console.log('Connected to SQLite database at:', dbPath);
  });

  const createTable = `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `;

  db.run(createTable, err => {
    if (err) console.error('Error creating messages table:', err);
    else console.log('Messages table ready.');
  });
}

/** Insert a new chat message */
function insertMessage(username, content) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const stmt = db.prepare(
      'INSERT INTO messages (username, content, timestamp) VALUES (?,?,?)'
    );
    stmt.run(username, content, timestamp, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, username, content, timestamp });
    });
    stmt.finalize();
  });
}

/** Retrieve all stored messages (ordered by time) */
function getAllMessages() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM messages ORDER BY timestamp ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { initDb, insertMessage, getAllMessages };
