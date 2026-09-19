const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'tasks.db');
const dbDir = path.dirname(dbPath);

require('fs').mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

// Create the tasks table if it doesn't already exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done BOOLEAN NOT NULL
  )
`).run();

// Create books table for report generation
db.prepare(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT,
    price REAL,
    rating INTEGER,
    availability TEXT,
    url TEXT
  )
`).run();

// Create quotes table for report generation
db.prepare(`
  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    text TEXT,
    author TEXT,
    tags TEXT,
    url TEXT
  )
`).run();

// Create reports table for tracking generated reports
db.prepare(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    filters TEXT,
    file_path TEXT,
    status TEXT,
    valid_records INTEGER,
    created_at TEXT
  )
`).run();

// Seed three example tasks ONLY if the table is empty
const countCheck = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
if (countCheck.count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  insert.run('Set up Express server', 1);
  insert.run('Build read endpoints', 0);
  insert.run('Publish to GitHub', 0);
  console.log('Database seeded with 3 initial tasks.');
}

module.exports = db;
