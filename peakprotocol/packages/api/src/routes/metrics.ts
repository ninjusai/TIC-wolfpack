/**
 * Daily metrics routes for PeakProtocol (WRK-028).
 *
 * Manages daily weight and hydration tracking.
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1. */
interface DailyMetricsRow {
  date: string;
  weight: number | null;
  weight_unit: string;
  water_ml: number | null;
  water_target_ml: number;
  notes: string | null;
  tags: string | null; // JSON string
  logged_at: string;
}

/** API-facing camelCase representation. */
interface DailyMetrics {
  date: string;
  weight: number | null;
  weightUnit: string;
  waterMl: number | null;
  waterTargetMl: number;
  notes: string | null;
  tags: string[];
  loggedAt: string;
}

function rowToMetrics(row: DailyMetricsRow): DailyMetrics {
  return {
    date: row.date,
    weight: row.weight,
    weightUnit: row.weight_unit,
    waterMl: row.water_ml,
    waterTargetMl: row.water_target_ml,
    notes: row.notes,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    loggedAt: row.logged_at,
  };
}

// ── Zod Schemas ────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const UpsertMetricsSchema = z.object({
  weight: z.coerce.number().positive().optional(),
  weightUnit: z.enum(["kg", "lbs"]).optional(),
  waterMl: z.coerce.number().int().nonnegative().optional(),
  waterTargetMl: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const DateRangeSchema = z.object({
  startDate: z.string().regex(DATE_REGEX, "startDate must be YYYY-MM-DD"),
  endDate: z.string().regex(DATE_REGEX, "endDate must be YYYY-MM-DD"),
});

// ── Routes ─────────────────────────────────────────────────────────────

export const metricsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all metrics routes
metricsRoutes.use("*", requireSession);

/**
 * PUT /api/metrics/:date
 *
 * Upsert daily metrics for a specific date.
 * Reads existing row first to merge partial updates.
 */
metricsRoutes.put("/:date", async (c) => {
  const date = c.req.param("date");

  if (!DATE_REGEX.test(date)) {
    return c.json({ error: "Invalid date format. Expected YYYY-MM-DD." }, 400);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = UpsertMetricsSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const now = new Date().toISOString();

  // Read existing row for merge
  const existing = await c.env.DB.prepare(
    "SELECT * FROM daily_metrics WHERE date = ?",
  )
    .bind(date)
    .first<DailyMetricsRow>();

  // Merge: provided fields override existing, otherwise keep existing (or defaults)
  const weight = data.weight !== undefined ? data.weight : (existing?.weight ?? null);
  const weightUnit = data.weightUnit !== undefined ? data.weightUnit : (existing?.weight_unit ?? "kg");
  const waterMl = data.waterMl !== undefined ? data.waterMl : (existing?.water_ml ?? null);
  const waterTargetMl = data.waterTargetMl !== undefined ? data.waterTargetMl : (existing?.water_target_ml ?? 3000);
  const notes = data.notes !== undefined ? data.notes : (existing?.notes ?? null);
  const tags = data.tags !== undefined ? JSON.stringify(data.tags) : (existing?.tags ?? null);

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO daily_metrics
       (date, weight, weight_unit, water_ml, water_target_ml, notes, tags, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(date, weight, weightUnit, waterMl, waterTargetMl, notes, tags, now)
    .run();

  const row = await c.env.DB.prepare(
    "SELECT * FROM daily_metrics WHERE date = ?",
  )
    .bind(date)
    .first<DailyMetricsRow>();

  if (!row) {
    return c.json({ error: "Failed to save metrics" }, 500);
  }

  return c.json({ metrics: rowToMetrics(row) }, 200);
});

/**
 * GET /api/metrics/:date
 *
 * Retrieve metrics for a single date.
 */
metricsRoutes.get("/:date", async (c) => {
  const date = c.req.param("date");

  if (!DATE_REGEX.test(date)) {
    return c.json({ error: "Invalid date format. Expected YYYY-MM-DD." }, 400);
  }

  const row = await c.env.DB.prepare(
    "SELECT * FROM daily_metrics WHERE date = ?",
  )
    .bind(date)
    .first<DailyMetricsRow>();

  if (!row) {
    return c.json({ error: "Metrics not found for this date" }, 404);
  }

  return c.json({ metrics: rowToMetrics(row) });
});

/**
 * GET /api/metrics
 *
 * Retrieve metrics for a date range.
 * Query params: startDate (required), endDate (required) — both YYYY-MM-DD.
 */
metricsRoutes.get("/", async (c) => {
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const parsed = DateRangeSchema.safeParse({ startDate, endDate });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query params", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM daily_metrics WHERE date >= ? AND date <= ? ORDER BY date ASC",
  )
    .bind(parsed.data.startDate, parsed.data.endDate)
    .all<DailyMetricsRow>();

  const metrics = (results ?? []).map(rowToMetrics);

  return c.json({ metrics });
});
