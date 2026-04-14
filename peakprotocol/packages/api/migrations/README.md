# PeakProtocol Database Migrations

This directory contains SQL migration files for the PeakProtocol D1 database.

## Naming Convention

Files follow the pattern `NNN_description.sql`:

```
001_initial_schema.sql
002_add_goals_table.sql
003_add_user_preferences.sql
```

- **NNN** is a zero-padded, monotonically increasing version number.
- **description** uses snake_case and briefly describes the change.
- Each file must be valid, standalone SQL that runs on Cloudflare D1 (SQLite).

## Tracking Applied Migrations

The `schema_migrations` table records which migrations have been applied:

```sql
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Every migration file should end with an `INSERT` into this table:

```sql
INSERT INTO schema_migrations (version, name) VALUES (N, 'NNN_description');
```

This lets tooling (and humans) determine the current schema version at any time:

```sql
SELECT MAX(version) FROM schema_migrations;
```

## Applying Migrations

### Local Development

```bash
# Apply all pending migrations to the local D1 database
npm run db:migrate
```

This runs `wrangler d1 migrations apply peakprotocol-db --local`.

### Remote (Production) D1

```bash
# Apply all pending migrations to the remote D1 database
npm run db:migrate:remote
```

This runs `wrangler d1 migrations apply peakprotocol-db --remote`.

### Manual / Advanced

For finer control, you can use the migration runner script:

```bash
# Preview which migrations exist
npx tsx scripts/migrate.ts --dry-run

# Generate SQL and pipe it to D1 manually
npx tsx scripts/migrate.ts | wrangler d1 execute peakprotocol-db --local --file=-
```

Or apply a single migration file directly:

```bash
wrangler d1 execute peakprotocol-db --local --file=migrations/002_add_goals_table.sql
```

## Creating a New Migration

1. Determine the next version number by looking at existing files.
2. Create a new file: `NNN_description.sql`.
3. Write your DDL/DML. Use `IF NOT EXISTS` / `IF EXISTS` guards where possible to keep migrations idempotent.
4. End the file with an `INSERT INTO schema_migrations` to record the version.
5. Test locally: `npm run db:migrate`.
6. Commit the migration file.

### Template

```sql
-- ============================================================================
-- PeakProtocol D1 Migration
-- Migration: NNN_description
-- Created:   YYYY-MM-DD
-- ============================================================================

-- Your schema changes here
CREATE TABLE IF NOT EXISTS example (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Record migration
INSERT INTO schema_migrations (version, name) VALUES (N, 'NNN_description');
```

## Important Notes

- **D1 is SQLite at the edge.** All SQL must be standard SQLite syntax.
- **Foreign keys are OFF by default** in D1. The application enables them per-connection with `PRAGMA foreign_keys = ON`.
- **Migrations are forward-only.** There is no built-in rollback mechanism. If you need to undo a change, write a new migration that reverses it.
- **Keep migrations small and focused.** One logical change per file makes debugging and rollback easier.
- **Test locally before deploying remotely.** Always run `npm run db:migrate` first.
