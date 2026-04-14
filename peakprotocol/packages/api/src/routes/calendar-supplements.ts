/**
 * Calendar supplement visibility routes for PeakProtocol Phase 6 (WRK-PP6-005).
 *
 * GET /api/calendar-supplements/:month — returns per-day supplement dot data
 * and compliance tints for an entire month in a single call.
 *
 * Architecture: DEC-phase6-002, DEC-phase6-008, DEC-phase6-009.
 */
import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";
import { parseDate, formatDate, addDays } from "../lib/dates";
import {
  getOccurrences,
  type SchedulableSupplement,
} from "../services/scheduler";
import { SUPPLEMENT_PALETTE } from "./supplements";

// ── Types ──────────────────────────────────────────────────────────────

/** Supplement row — only the fields needed for calendar computation. */
interface SupplementRow {
  id: string;
  name: string;
  schedule_type: string | null;
  schedule_value: string | null;
  time_of_day: string | null;
  active: number;
  color: string | null;
  created_at: string;
}

/** Raw supplement_logs row from D1. */
interface LogRow {
  id: string;
  supplement_id: string;
  scheduled_date: string;
  taken_at: string | null;
  skipped: number;
}

/** Per-supplement status for a single day (API response shape). */
interface DaySupplementStatus {
  supplementId: string;
  name: string;
  color: string;
  status: "taken" | "skipped" | "pending";
  logId: string | null;
}

/** Full API response shape. */
interface CalendarSupplementsResponse {
  days: Record<string, DaySupplementStatus[]>;
  compliance: Record<string, "full" | "partial" | "none" | null>;
}

// ── Helpers ────────────────────────────────────────────────────────────

const MONTH_REGEX = /^\d{4}-\d{2}$/;

/** Convert a D1 row to a SchedulableSupplement (skip if unschedulable). */
function toSchedulable(row: SupplementRow): SchedulableSupplement | null {
  if (!row.schedule_type || !row.time_of_day) return null;
  return {
    id: row.id,
    name: row.name,
    scheduleType: row.schedule_type,
    scheduleValue: row.schedule_value
      ? (JSON.parse(row.schedule_value) as unknown)
      : null,
    timeOfDay: row.time_of_day,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

/** Get the first day of the month as YYYY-MM-DD. */
function monthStart(month: string): string {
  return `${month}-01`;
}

/** Get the last day of the month as YYYY-MM-DD. */
function monthEnd(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m = Number(monthStr);
  // Day 0 of next month = last day of this month
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

// ── Routes ─────────────────────────────────────────────────────────────

export const calendarSupplementRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

calendarSupplementRoutes.use("*", requireSession);

/**
 * GET /api/calendar-supplements/:month
 *
 * Returns per-day supplement status and compliance for a full month.
 * :month format: YYYY-MM (e.g. 2026-04)
 */
calendarSupplementRoutes.get("/:month", async (c) => {
  const month = c.req.param("month");

  if (!MONTH_REGEX.test(month)) {
    return c.json(
      { error: "Invalid month format. Expected YYYY-MM." },
      400,
    );
  }

  const startDate = monthStart(month);
  const endDate = monthEnd(month);

  // 1. Fetch all supplements (active + inactive) so historical dots can
  //    resolve names and colors for supplements that have since been deactivated.
  //    Only active supplements are used for schedule computation (step 2).
  const { results: supplementRows } = await c.env.DB.prepare(
    `SELECT id, name, schedule_type, schedule_value, time_of_day, active, color, created_at
     FROM supplements
     ORDER BY name`,
  ).all<SupplementRow>();

  const rows = supplementRows ?? [];

  // Build color lookup — auto-assign from palette for supplements missing color.
  // Two-pronged approach:
  //   1. Lazy backfill: persist the assigned color to D1 so it sticks.
  //   2. Deterministic fallback: if the UPDATE fails, hash the ID for a stable color.
  const usedColors = new Set(rows.filter((r) => r.color).map((r) => r.color!));
  const colorMap = new Map<string, string>();
  const backfillPromises: Promise<unknown>[] = [];

  for (const row of rows) {
    if (row.color) {
      colorMap.set(row.id, row.color);
    } else {
      // Pick the next unused palette color
      const nextColor: string = SUPPLEMENT_PALETTE.find((c) => !usedColors.has(c))
        ?? SUPPLEMENT_PALETTE[0] ?? '#3B82F6';
      usedColors.add(nextColor);
      colorMap.set(row.id, nextColor);

      // Lazy backfill: persist to D1 (fire-and-forget, best-effort)
      backfillPromises.push(
        c.env.DB.prepare("UPDATE supplements SET color = ? WHERE id = ? AND color IS NULL")
          .bind(nextColor, row.id)
          .run()
          .catch(() => {
            // If UPDATE fails, apply deterministic fallback based on ID hash
            let hash = 0;
            for (let i = 0; i < row.id.length; i++) {
              hash = ((hash << 5) - hash + row.id.charCodeAt(i)) | 0;
            }
            const fallback: string = SUPPLEMENT_PALETTE[Math.abs(hash) % SUPPLEMENT_PALETTE.length] ?? '#3B82F6';
            colorMap.set(row.id, fallback);
          }),
      );
    }
  }

  // Await all backfills (they are cheap single-row UPDATEs)
  await Promise.all(backfillPromises);

  // 2. Compute scheduled occurrences for the month using the scheduling engine
  const schedulables = rows
    .map(toSchedulable)
    .filter((s): s is SchedulableSupplement => s !== null);

  const allOccurrences = schedulables.flatMap((supp) =>
    getOccurrences(supp, startDate, endDate),
  );

  // Index occurrences by date
  const occurrencesByDate = new Map<
    string,
    Array<{ supplementId: string; supplementName: string }>
  >();
  for (const occ of allOccurrences) {
    let arr = occurrencesByDate.get(occ.date);
    if (!arr) {
      arr = [];
      occurrencesByDate.set(occ.date, arr);
    }
    arr.push({ supplementId: occ.supplementId, supplementName: occ.supplementName });
  }

  // 3. Fetch all supplement_logs for the month in a single query
  const { results: logRows } = await c.env.DB.prepare(
    `SELECT id, supplement_id, scheduled_date, taken_at, skipped
     FROM supplement_logs
     WHERE scheduled_date >= ? AND scheduled_date <= ?`,
  )
    .bind(startDate, endDate)
    .all<LogRow>();

  // Index logs by (supplement_id, scheduled_date) — prefer taken logs over skipped
  const logMap = new Map<string, LogRow>();
  for (const log of logRows ?? []) {
    const key = `${log.supplement_id}::${log.scheduled_date}`;
    const existing = logMap.get(key);
    if (!existing || (log.taken_at && !existing.taken_at)) {
      logMap.set(key, log);
    }
  }

  // 4. Build the per-day response (DEC-phase6-002, DEC-phase6-009)
  const days: Record<string, DaySupplementStatus[]> = {};
  const compliance: Record<string, "full" | "partial" | "none" | null> = {};

  // Iterate all dates that have either scheduled occurrences or logs
  const allDates = new Set<string>();
  for (const date of occurrencesByDate.keys()) allDates.add(date);
  for (const log of logRows ?? []) allDates.add(log.scheduled_date);

  // Also fill in all calendar dates for the month (so frontend gets compliance = null for empty days)
  let cursor = parseDate(startDate);
  const end = parseDate(endDate);
  while (cursor <= end) {
    allDates.add(formatDate(cursor));
    cursor = addDays(cursor, 1);
  }

  for (const date of allDates) {
    const scheduledForDay = occurrencesByDate.get(date) ?? [];
    const dayStatuses: DaySupplementStatus[] = [];

    // Track unique supplements already added (from schedule)
    const seen = new Set<string>();
    let takenCount = 0;
    let scheduledCount = scheduledForDay.length;

    // Process scheduled supplements
    for (const occ of scheduledForDay) {
      seen.add(occ.supplementId);
      const key = `${occ.supplementId}::${date}`;
      const log = logMap.get(key);

      let status: "taken" | "skipped" | "pending";
      let logId: string | null = null;
      if (log) {
        status = log.skipped === 1 ? "skipped" : (log.taken_at ? "taken" : "pending");
        if (status !== "pending") logId = log.id;
      } else {
        status = "pending";
      }

      if (status === "taken") takenCount++;

      dayStatuses.push({
        supplementId: occ.supplementId,
        name: occ.supplementName,
        color: colorMap.get(occ.supplementId) ?? SUPPLEMENT_PALETTE[0],
        status,
        logId,
      });
    }

    // Historical dots: logs for supplements NOT in the current schedule (DEC-phase6-009)
    for (const log of logRows ?? []) {
      if (log.scheduled_date !== date) continue;
      if (seen.has(log.supplement_id)) continue;
      seen.add(log.supplement_id);

      // Look up supplement name and color
      const suppRow = rows.find((r) => r.id === log.supplement_id);
      const name = suppRow?.name ?? "Unknown";
      const color = colorMap.get(log.supplement_id) ?? SUPPLEMENT_PALETTE[0];
      const status: "taken" | "skipped" = log.skipped === 1 ? "skipped" : "taken";

      if (status === "taken") takenCount++;
      scheduledCount++;

      dayStatuses.push({ supplementId: log.supplement_id, name, color, status, logId: log.id });
    }

    days[date] = dayStatuses;

    // Compliance (DEC-phase6-008): all scheduled count regardless of time-of-day
    if (scheduledCount === 0) {
      compliance[date] = null;
    } else if (takenCount === scheduledCount) {
      compliance[date] = "full";
    } else if (takenCount > 0) {
      compliance[date] = "partial";
    } else {
      compliance[date] = "none";
    }
  }

  const response: CalendarSupplementsResponse = { days, compliance };
  return c.json(response);
});
