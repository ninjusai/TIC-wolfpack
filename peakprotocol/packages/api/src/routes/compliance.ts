/**
 * Compliance routes for PeakProtocol (WRK-015).
 *
 * Provides daily compliance, date-range compliance, and streak endpoints.
 * All routes require an authenticated session.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";
import { formatDate, parseDate, addDays } from "../lib/dates";
import { getOccurrences } from "../services/scheduler";
import type { SchedulableSupplement } from "../services/scheduler";
import {
  calculateDailyCompliance,
  calculateRangeCompliance,
  calculateStreak,
  type SupplementLogRow,
} from "../services/compliance";

// ── Zod Schemas ────────────────────────────────────────────────────────

const DailyQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

const RangeQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
});

const StreakQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

// ── Helpers ────────────────────────────────────────────────────────────

/** Raw supplement row from D1. */
interface SupplementRow {
  id: string;
  name: string;
  schedule_type: string | null;
  schedule_value: string | null;
  time_of_day: string | null;
  active: number;
  created_at: string;
}

/** Convert a D1 supplement row to a SchedulableSupplement. */
function toSchedulable(row: SupplementRow): SchedulableSupplement {
  return {
    id: row.id,
    name: row.name,
    scheduleType: row.schedule_type ?? "",
    scheduleValue: row.schedule_value
      ? (JSON.parse(row.schedule_value) as unknown)
      : null,
    timeOfDay: row.time_of_day ?? "anytime",
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

/** Fetch all active supplements from D1. */
async function fetchActiveSupplements(
  db: D1Database,
): Promise<SchedulableSupplement[]> {
  const { results } = await db
    .prepare(
      "SELECT id, name, schedule_type, schedule_value, time_of_day, active, created_at FROM supplements WHERE active = 1 ORDER BY name",
    )
    .all<SupplementRow>();

  return (results ?? [])
    .filter((row) => row.schedule_type != null)
    .map(toSchedulable);
}

/** Fetch supplement logs for a date range from D1. */
async function fetchLogs(
  db: D1Database,
  startDate: string,
  endDate: string,
): Promise<SupplementLogRow[]> {
  const { results } = await db
    .prepare(
      "SELECT id, supplement_id, scheduled_date, scheduled_time, taken_at, actual_dose, skipped, notes FROM supplement_logs WHERE scheduled_date >= ? AND scheduled_date <= ? ORDER BY scheduled_date",
    )
    .bind(startDate, endDate)
    .all<SupplementLogRow>();

  return results ?? [];
}

/** Collect all occurrences for a list of supplements over a date range. */
function collectOccurrences(
  supplements: SchedulableSupplement[],
  startDate: string,
  endDate: string,
): ReturnType<typeof getOccurrences> {
  const all: ReturnType<typeof getOccurrences> = [];
  for (const supp of supplements) {
    all.push(...getOccurrences(supp, startDate, endDate));
  }
  return all;
}

// ── Routes ─────────────────────────────────────────────────────────────

export const complianceRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

complianceRoutes.use("*", requireSession);

/**
 * GET /api/compliance/daily
 *
 * Returns compliance summary for a single day.
 * Query params: date (optional, defaults to today).
 */
complianceRoutes.get("/daily", async (c) => {
  const parsed = DailyQuerySchema.safeParse({
    date: c.req.query("date"),
  });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const now = new Date();
  const date = parsed.data.date ?? formatDate(now);

  const supplements = await fetchActiveSupplements(c.env.DB);
  const occurrences = collectOccurrences(supplements, date, date);
  const logs = await fetchLogs(c.env.DB, date, date);

  const compliance = calculateDailyCompliance(occurrences, logs, date, now);

  return c.json({ compliance });
});

/**
 * GET /api/compliance/range
 *
 * Returns compliance summaries for each day in a date range, plus an overall aggregate.
 * Query params: startDate (required), endDate (required).
 */
complianceRoutes.get("/range", async (c) => {
  const parsed = RangeQuerySchema.safeParse({
    startDate: c.req.query("startDate"),
    endDate: c.req.query("endDate"),
  });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { startDate, endDate } = parsed.data;

  if (startDate > endDate) {
    return c.json({ error: "startDate must be before or equal to endDate" }, 400);
  }

  const now = new Date();

  const supplements = await fetchActiveSupplements(c.env.DB);
  const occurrences = collectOccurrences(supplements, startDate, endDate);
  const logs = await fetchLogs(c.env.DB, startDate, endDate);

  const compliance = calculateRangeCompliance(
    occurrences,
    logs,
    startDate,
    endDate,
    now,
  );

  // Compute overall aggregates across the range.
  let totalTaken = 0;
  let totalScheduled = 0;
  for (const day of compliance) {
    totalTaken += day.taken;
    totalScheduled += day.totalScheduled;
  }

  const overallRate =
    totalScheduled > 0
      ? Math.round((totalTaken / totalScheduled) * 1000) / 10
      : 0;

  return c.json({
    compliance,
    overall: {
      completionRate: overallRate,
      totalTaken,
      totalScheduled,
    },
  });
});

/**
 * GET /api/compliance/streak
 *
 * Returns current and longest compliance streaks.
 * Query params: days (optional, default 90) -- how many days back to check.
 */
complianceRoutes.get("/streak", async (c) => {
  const parsed = StreakQuerySchema.safeParse({
    days: c.req.query("days"),
  });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const now = new Date();
  const daysBack = parsed.data.days ?? 90;
  const endDate = formatDate(now);
  const startDate = formatDate(addDays(parseDate(endDate), -(daysBack - 1)));

  const supplements = await fetchActiveSupplements(c.env.DB);
  const occurrences = collectOccurrences(supplements, startDate, endDate);
  const logs = await fetchLogs(c.env.DB, startDate, endDate);

  const dailySummaries = calculateRangeCompliance(
    occurrences,
    logs,
    startDate,
    endDate,
    now,
  );

  const streak = calculateStreak(dailySummaries);

  return c.json({ streak });
});
