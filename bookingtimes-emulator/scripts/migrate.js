import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'bookingtimes.db');

// Ensure data directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrationsDir = path.join(process.cwd(), 'migrations');

if (!fs.existsSync(migrationsDir)) {
  console.error('No migrations directory found at:', migrationsDir);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.log('No migration files found.');
  db.close();
  process.exit(0);
}

for (const file of files) {
  console.log(`Running migration: ${file}`);
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  db.exec(sql);
}

console.log(`Migrations complete. Ran ${files.length} file(s).`);
db.close();
