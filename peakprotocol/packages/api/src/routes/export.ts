/**
 * Data export/import routes for PeakProtocol (WRK-045).
 *
 * Allows users to export all their data as JSON (stored in R2),
 * list previous exports, download a specific export, and import
 * data from a previously-exported (or hand-crafted) JSON payload.
 *
 * All routes require an authenticated session via requireSession.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Constants ─────────────────────────────────────────────────────────

/** Tables included in export/import — excludes food_cache, credentials, recovery_codes. */
const USER_TABLES = [
  "supplements",
  "dose_history",
  "supplement_logs",
  "food_entries",
  "saved_foods",
  "daily_metrics",
  "training_sessions",
  "journal_entries",
  "weekly_reports",
] as const;

type UserTable = (typeof USER_TABLES)[number];

/** Maximum rows per D1 batch insert to stay under query-size limits. */
const BATCH_SIZE = 50;

/** Whitelist of valid column names per table to prevent SQL injection. */
const TABLE_COLUMNS: Record<string, string[]> = {
  supplements: ["id", "name", "current_dose", "unit", "schedule_type", "schedule_value", "time_of_day", "tags", "active", "created_at", "updated_at"],
  dose_history: ["id", "supplement_id", "dose", "unit", "changed_at", "notes"],
  supplement_logs: ["id", "supplement_id", "scheduled_date", "scheduled_time", "taken_at", "actual_dose", "skipped", "notes"],
  food_entries: ["id", "date", "meal", "food_name", "fdc_id", "serving_size", "serving_unit", "calories", "protein", "carbs", "fat", "fiber", "logged_at"],
  saved_foods: ["id", "name", "fdc_id", "custom_serving_size", "custom_serving_unit", "is_custom", "calories", "protein", "carbs", "fat", "fiber", "usage_count"],
  daily_metrics: ["date", "weight", "weight_unit", "water_ml", "water_target_ml", "notes", "tags", "logged_at"],
  training_sessions: ["id", "date", "type", "duration_minutes", "intensity", "details", "notes", "logged_at"],
  journal_entries: ["id", "date", "content", "tags", "created_at", "updated_at"],
  weekly_reports: ["id", "week_start", "week_end", "compliance_pct", "avg_calories", "avg_protein", "avg_carbs", "avg_fat", "weight_start", "weight_end", "training_minutes", "training_sessions", "report_json", "generated_at"],
};

// ── Zod Schemas ───────────────────────────────────────────────────────

const ImportSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  tables: z.record(z.array(z.record(z.unknown()))),
});

// ── Types ─────────────────────────────────────────────────────────────

interface ExportPayload {
  version: string;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

interface R2ListEntry {
  key: string;
  size: number;
  uploaded: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Build a parameterised INSERT OR IGNORE statement for a table, given the
 * column names from the first row. Returns the SQL string and a flat array
 * of bind values for every row in the chunk.
 */
function buildInsertBatch(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): { sql: string; bindings: unknown[] } {
  const placeholders = `(${columns.map(() => "?").join(", ")})`;
  const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES ${rows.map(() => placeholders).join(", ")}`;

  const bindings: unknown[] = [];
  for (const row of rows) {
    for (const col of columns) {
      const val = row[col];
      // D1 bind only accepts string | number | null | ArrayBuffer
      bindings.push(val === undefined ? null : val);
    }
  }
  return { sql, bindings };
}

/** Split an array into chunks of at most `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Routes ────────────────────────────────────────────────────────────

export const exportRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

exportRoutes.use("*", requireSession);

/**
 * GET /api/export
 *
 * Export all user data as JSON and store in R2.
 */
exportRoutes.get("/", async (c) => {
  const tableCounts: Record<string, number> = {};
  const tablesData: Record<string, Record<string, unknown>[]> = {};

  for (const table of USER_TABLES) {
    const { results } = await c.env.DB.prepare(`SELECT * FROM ${table}`)
      .all<Record<string, unknown>>();
    const rows = results ?? [];
    tablesData[table] = rows;
    tableCounts[table] = rows.length;
  }

  const payload: ExportPayload = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    tables: tablesData,
  };

  const body = JSON.stringify(payload);
  const key = `exports/${new Date().toISOString().replace(/[:.]/g, "-")}-full.json`;

  await c.env.BUCKET.put(key, body, {
    httpMetadata: { contentType: "application/json" },
  });

  return c.json({
    success: true as const,
    key,
    size: body.length,
    tables: tableCounts,
  });
});

/**
 * GET /api/export/list
 *
 * List available exports stored in R2.
 */
exportRoutes.get("/list", async (c) => {
  const listed = await c.env.BUCKET.list({ prefix: "exports/" });

  const exports: R2ListEntry[] = listed.objects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
  }));

  return c.json({ exports });
});

/**
 * GET /api/export/:key{.+}
 *
 * Download a specific export from R2.
 * The key path may contain slashes, so we use a wildcard param pattern.
 */
exportRoutes.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");

  const object = await c.env.BUCKET.get(key);
  if (!object) {
    return c.json({ error: "Export not found" }, 404);
  }

  const data = await object.text();
  return c.json(JSON.parse(data));
});

/**
 * POST /api/import
 *
 * Import data from a JSON payload matching the export structure.
 * Uses INSERT OR IGNORE — existing rows are preserved.
 */
export const importRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

importRoutes.use("*", requireSession);

importRoutes.post("/", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = ImportSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid import structure", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { tables } = parsed.data;
  const imported: Record<string, number> = {};

  for (const table of USER_TABLES) {
    const rows = tables[table];
    if (!rows || rows.length === 0) {
      imported[table] = 0;
      continue;
    }

    // Derive columns from the first row, filtering to whitelisted names only
    const firstRow = rows[0];
    if (!firstRow) {
      imported[table] = 0;
      continue;
    }
    const allowedColumns = TABLE_COLUMNS[table];
    if (!allowedColumns) {
      imported[table] = 0;
      continue;
    }
    const allowedSet = new Set(allowedColumns);
    const columns = Object.keys(firstRow).filter((col) => allowedSet.has(col));
    if (columns.length === 0) {
      imported[table] = 0;
      continue;
    }

    let totalInserted = 0;

    for (const batch of chunk(rows, BATCH_SIZE)) {
      const { sql, bindings } = buildInsertBatch(
        table,
        columns,
        batch as Record<string, unknown>[],
      );
      const result = await c.env.DB.prepare(sql).bind(...bindings).run();
      totalInserted += result.meta.changes ?? 0;
    }

    imported[table] = totalInserted;
  }

  return c.json({ success: true as const, imported });
});
