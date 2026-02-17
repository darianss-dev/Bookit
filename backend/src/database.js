const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'bookit.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author_name TEXT,
    author_gender TEXT CHECK(author_gender IN ('Female','Male','Non-binary','Unknown')),
    author_ethnicity TEXT CHECK(author_ethnicity IN ('White','POC','Unknown')),
    genre TEXT,
    page_count INTEGER,
    series_name TEXT,
    series_order REAL,
    date_read TEXT,
    blurb TEXT,
    referral_source TEXT,
    is_recommended INTEGER NOT NULL DEFAULT 0,
    source TEXT CHECK(source IN ('Manual','Libby','Audible','Sheets')),
    sheets_row INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TRIGGER IF NOT EXISTS books_updated_at
    AFTER UPDATE ON books
    BEGIN
      UPDATE books SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
`);

module.exports = db;
