/**
 * Schedule routes for PeakProtocol (WRK-012).
 *
 * Exposes the scheduling engine via REST endpoints.
 * All routes require an authenticated session.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";
import { formatDate, addDays, parseDate } from "../lib/dates";
import {
  getOccurrences,
  getNextOccurrences,
  type SchedulableSupplement,
} from "../services/scheduler";

// ── Row type (same as supplements.ts — only the fields we need) ──────

interface SupplementRow {
  id: string;
  name: string;
  schedule_type: string | null;
  schedule_value: string | null;
  time_of_day: string | null;
  active: number;
  created_at: string;
}

function rowToSchedulable(row: SupplementRow): SchedulableSupplement | null {
  // Skip supplements that lack scheduling info
  if (!row.schedule_type || !row.time_of_day) return null;

  return {
    id: row.id,
    name: row.name,
    scheduleType: row.schedule_type,
    scheduleValue: row.schedule_value ? JSON.parse(row.schedule_value) as unknown : null,
    timeOfDay: row.time_of_day,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

// ── Zod query schemas ────────────────────────────────────────────────

const ScheduleQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  days: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(1).max(90))
    .optional(),
});

const SingleScheduleQuerySchema = z.object({
  count: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

// ── Routes ───────────────────────────────────────────────────────────

export const scheduleRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

scheduleRoutes.use("*", requireSession);

/**
 * GET /api/supplements/schedule
 *
 * Returns schedule for all active supplements over a date range.
 * Query params:
 *   - date: YYYY-MM-DD (default: today)
 *   - days: number of days (default: 1, max: 90)
 */
scheduleRoutes.get("/", async (c) => {
  const parsed = ScheduleQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const today = formatDate(new Date());
  const startDate = parsed.data.date ?? today;
  const days = parsed.data.days ?? 1;
  const endDate = formatDate(addDays(parseDate(startDate), days - 1));

  const { results } = await c.env.DB.prepare(
    "SELECT id, name, schedule_type, schedule_value, time_of_day, active, created_at FROM supplements WHERE active = 1",
  ).all<SupplementRow>();

  const rows = results ?? [];
  const schedule = rows
    .map(rowToSchedulable)
    .filter((s): s is SchedulableSupplement => s !== null)
    .flatMap((supp) => getOccurrences(supp, startDate, endDate));

  // Sort by date, then by timeOfDay priority
  const ORDER: Record<string, number> = { morning: 0, with_food: 1, evening: 2, anytime: 3 };
  schedule.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (ORDER[a.timeOfDay] ?? 9) - (ORDER[b.timeOfDay] ?? 9);
  });

  return c.json({ schedule });
});

/**
 * Standalone router for GET /api/supplements/:id/schedule
 *
 * Mounted separately in index.ts because the :id param sits between
 * /api/supplements and /schedule in the URL path.
 *
 * Query params:
 *   - count: number of occurrences (default: 10, max: 100)
 */
export const singleScheduleRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

singleScheduleRoutes.use("*", requireSession);

singleScheduleRoutes.get("/", async (c) => {
  const id = c.req.param("id");

  const parsed = SingleScheduleQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const count = parsed.data.count ?? 10;

  const row = await c.env.DB.prepare(
    "SELECT id, name, schedule_type, schedule_value, time_of_day, active, created_at FROM supplements WHERE id = ?",
  )
    .bind(id)
    .first<SupplementRow>();

  if (!row) {
    return c.json({ error: "Supplement not found" }, 404);
  }

  const supp = rowToSchedulable(row);
  if (!supp) {
    return c.json({ occurrences: [] });
  }

  const occurrences = getNextOccurrences(supp, count);

  return c.json({ occurrences });
});
