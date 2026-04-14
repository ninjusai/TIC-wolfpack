import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'bookingtimes.db');
    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

// D1-compatible wrapper so existing code needs minimal changes
export interface D1CompatDatabase {
  prepare(sql: string): D1CompatStatement;
  batch(statements: D1CompatStatement[]): void;
  exec(sql: string): void;
}

export interface D1CompatStatement {
  bind(...params: unknown[]): D1CompatStatement;
  all<T = unknown>(): { results: T[] };
  first<T = unknown>(): T | null;
  run(): { meta: { changes: number } };
}

export function getD1Compat(): D1CompatDatabase {
  const db = getDb();
  return {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          params = args;
          return this;
        },
        all<T = unknown>() {
          return { results: stmt.all(...params) as T[] };
        },
        first<T = unknown>() {
          return (stmt.get(...params) as T) || null;
        },
        run() {
          const info = stmt.run(...params);
          return { meta: { changes: info.changes } };
        }
      };
    },
    batch(statements: any[]) {
      // D1 batch() runs statements in a transaction
      // The statements are already bound and ready to execute
      db.transaction(() => {
        for (const stmt of statements) {
          stmt.run();
        }
      })();
    },
    exec(sql: string) {
      db.exec(sql);
    }
  };
}
