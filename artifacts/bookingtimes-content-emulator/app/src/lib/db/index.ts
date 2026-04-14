/**
 * Database initialization module for BCE V2.1
 *
 * - Opens/creates SQLite database at app/data/bce.db
 * - Sets required PRAGMAs (foreign_keys, WAL journal mode)
 * - Runs versioned migrations from migrations/ directory
 * - Exports a singleton database instance
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Database file lives in app/data/bce.db
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'bce.db');
const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'lib', 'db', 'migrations');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Open database (creates file if it doesn't exist)
const db = new Database(DB_PATH);

// Set PRAGMAs
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// ---------- Migration system ----------

// Create internal migrations tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/**
 * Run all pending migrations in filename order.
 */
function runMigrations(): void {
  const rows = db
    .prepare('SELECT filename FROM _migrations')
    .all() as Array<Record<string, unknown>>;
  const applied = new Set(
    rows.map((row) => row.filename as string)
  );

  // Read migration files, sorted alphabetically (001_, 002_, ...)
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (filename) VALUES (?)'
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    // Run each migration inside a transaction
    const migrate = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file);
    });

    migrate();
    console.log(`[db] Applied migration: ${file}`);
  }
}

// Run migrations on module load
runMigrations();

export default db;
export { DB_PATH, runMigrations };
