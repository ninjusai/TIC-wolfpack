/**
 * Verification script for BCE database schema and seed data.
 * Run with: npx tsx scripts/verify-db.ts
 */

import db from '../src/lib/db/index.ts';

console.log('\n=== BCE Database Verification ===\n');

// 1. Check integrity
const integrity = db.pragma('integrity_check');
console.log('Integrity check:', integrity[0].integrity_check);

// 2. Check foreign key violations
const fkCheck = db.pragma('foreign_key_check');
console.log('Foreign key violations:', fkCheck.length === 0 ? 'NONE (OK)' : fkCheck);

// 3. Check foreign keys are ON
const fkStatus = db.pragma('foreign_keys');
console.log('Foreign keys enabled:', fkStatus[0].foreign_keys === 1 ? 'YES' : 'NO');

// 4. Check journal mode
const journal = db.pragma('journal_mode');
console.log('Journal mode:', journal[0].journal_mode);

// 5. List all tables
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('_migrations', 'sqlite_sequence') ORDER BY name")
  .all() as { name: string }[];

console.log(`\nTables created: ${tables.length}`);
tables.forEach((t) => console.log(`  - ${t.name}`));

// 6. List indexes
const indexes = db
  .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
  .all() as { name: string }[];

console.log(`\nCustom indexes: ${indexes.length}`);
indexes.forEach((i) => console.log(`  - ${i.name}`));

// 7. Check seed data
const sites = db.prepare('SELECT id, name, slug, pipeline_stage FROM sites').all();
console.log(`\nSeeded sites: ${sites.length}`);
sites.forEach((s: any) => console.log(`  [${s.id}] ${s.name} (${s.slug}) — ${s.pipeline_stage}`));

// 8. Check migrations
const migrations = db.prepare('SELECT filename, applied_at FROM _migrations ORDER BY id').all();
console.log(`\nApplied migrations: ${migrations.length}`);
migrations.forEach((m: any) => console.log(`  - ${m.filename} @ ${m.applied_at}`));

console.log('\n=== Verification complete ===\n');
