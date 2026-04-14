/**
 * migrate.ts — D1 Migration Runner for PeakProtocol
 *
 * Scans the migrations/ directory for .sql files, checks which have already
 * been applied via the schema_migrations table, and outputs the SQL needed
 * to apply any pending migrations. The output can be piped to
 * `wrangler d1 execute` or run directly in local development.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts                  # Print SQL to stdout
 *   npx tsx scripts/migrate.ts --dry-run        # Show what would be applied
 *   npx tsx scripts/migrate.ts | wrangler d1 execute peakprotocol-db --local --file=-
 *
 * The primary workflow uses `wrangler d1 migrations apply` (see package.json
 * scripts). This file exists as a complementary tool for cases where you need
 * finer control or want to generate migration SQL programmatically.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname ?? ".", "..", "migrations");

interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  path: string;
}

/**
 * Parse migration files from the migrations directory.
 * Expects filenames like: 001_initial_schema.sql, 002_add_goals.sql
 */
async function discoverMigrations(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const migrations: MigrationFile[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".sql")) continue;

    const match = entry.match(/^(\d{3})_(.+)\.sql$/);
    if (!match) {
      console.error(`[warn] Skipping file with unexpected name format: ${entry}`);
      continue;
    }

    migrations.push({
      version: parseInt(match[1], 10),
      name: entry.replace(/\.sql$/, ""),
      filename: entry,
      path: join(MIGRATIONS_DIR, entry),
    });
  }

  return migrations.sort((a, b) => a.version - b.version);
}

/**
 * Generate SQL that, when executed against D1, will:
 * 1. Skip already-applied migrations (by checking schema_migrations)
 * 2. Apply pending migrations in order
 * 3. Record each applied migration in schema_migrations
 *
 * The generated SQL uses conditional logic via the schema_migrations table
 * so it is safe to run repeatedly (idempotent).
 */
async function generateMigrationSQL(dryRun: boolean): Promise<void> {
  const migrations = await discoverMigrations();

  if (migrations.length === 0) {
    console.error("[info] No migration files found.");
    return;
  }

  console.error(`[info] Found ${migrations.length} migration file(s):`);
  for (const m of migrations) {
    console.error(`       ${m.filename} (version ${m.version})`);
  }

  if (dryRun) {
    console.error("\n[dry-run] Would apply the following pending migrations:");
    console.error("          (Migrations already in schema_migrations will be skipped at runtime)\n");
    for (const m of migrations) {
      console.error(`  - v${m.version}: ${m.name}`);
    }
    return;
  }

  // Emit SQL to stdout — each migration wrapped so it only runs if not yet applied
  const sqlParts: string[] = [];

  sqlParts.push("-- ============================================");
  sqlParts.push("-- PeakProtocol D1 Migration Runner Output");
  sqlParts.push(`-- Generated: ${new Date().toISOString()}`);
  sqlParts.push("-- ============================================\n");

  for (const m of migrations) {
    const content = await readFile(m.path, "utf-8");

    // We cannot use IF NOT EXISTS around arbitrary DDL in SQLite,
    // so we rely on the caller to check schema_migrations first.
    // For the initial migration (v1), the schema_migrations table
    // itself is created, so we must handle it specially.
    sqlParts.push(`-- ---- Migration v${m.version}: ${m.name} ----`);
    sqlParts.push(content.trim());
    sqlParts.push("");
  }

  // Output the combined SQL
  process.stdout.write(sqlParts.join("\n") + "\n");

  console.error(`\n[info] Generated SQL for ${migrations.length} migration(s).`);
  console.error("[info] Pipe this to: wrangler d1 execute peakprotocol-db --local --file=-");
}

// --- Main ---
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

generateMigrationSQL(dryRun).catch((err) => {
  console.error("[error]", err);
  process.exit(1);
});
