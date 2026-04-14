/**
 * Daily summary aggregation route for PeakProtocol.
 *
 * GET /api/daily-summary/:date — returns all data logged for a given date
 * (supplements, nutrition, training, metrics, journal) in a single response.
 * Powers the calendar day-detail view on the Dashboard.
 *
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";
import {
  getOccurrences,
  type SchedulableSupplement,
} from "../services/scheduler";
import { SUPPLEMENT_PALETTE } from "./supplements";

// ── Row Types (D1 raw shapes) ────────────────────────────────────────

interface SupplementLogJoinRow {
  log_id: string;
  name: string;
  current_dose: string | null;
  unit: string | null;
  scheduled_time: string | null;
  taken_at: string | null;
  actual_dose: string | null;
  skipped: number;
  supplement_id: string;
  color: string | null;
}

interface FoodEntryRow {
  meal: string;
  food_name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  source: string | null;
}

interface TrainingSessionRow {
  type: string;
  duration_minutes: number | null;
  notes: string | null;
}

interface DailyMetricsRow {
  weight: number | null;
  water_ml: number | null;
}

interface JournalEntryRow {
  content: string;
  created_at: string;
}

/** Supplement row for schedule computation. */
interface SupplementScheduleRow {
  id: string;
  name: string;
  schedule_type: string | null;
  schedule_value: string | null;
  time_of_day: string | null;
  active: number;
  color: string | null;
  created_at: string;
}

// ── Response Types ───────────────────────────────────────────────────

interface SupplementItem {
  name: string;
  dose: string;
  time: string;
  status: "taken" | "skipped";
}

interface NutritionItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string | null;
}

interface MealGroup {
  meal: string;
  items: NutritionItem[];
}

interface TrainingSessionSummary {
  type: string;
  duration: number;
  notes?: string;
}

/** Per-supplement dot status for calendar visualization (Phase 6). */
interface SupplementDotStatus {
  supplementId: string;
  name: string;
  color: string;
  status: "taken" | "skipped" | "pending";
  /** Log record ID (present when a log entry exists, used for uncheck/delete). */
  logId?: string;
}

interface DailySummary {
  date: string;
  supplements: {
    taken: number;
    skipped: number;
    total: number;
    items: SupplementItem[];
    /** Phase 6 additive field: per-supplement dot data for calendar view. */
    dots: SupplementDotStatus[];
  };
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meals: MealGroup[];
  };
  training: {
    sessions: TrainingSessionSummary[];
    totalDuration: number;
  };
  metrics: {
    weight?: number;
    hydration?: number;
  };
  journal: {
    entries: Array<{ content: string; createdAt: string }>;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function buildDose(row: SupplementLogJoinRow): string {
  if (row.actual_dose) return row.actual_dose;
  if (row.current_dose && row.unit) return `${row.current_dose} ${row.unit}`;
  if (row.current_dose) return row.current_dose;
  return "";
}

function buildTime(row: SupplementLogJoinRow): string {
  if (row.taken_at) return row.taken_at;
  if (row.scheduled_time) return row.scheduled_time;
  return "";
}

/** Convert a D1 supplement row to a SchedulableSupplement (skip if unschedulable). */
function toSchedulable(row: SupplementScheduleRow): SchedulableSupplement | null {
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

// ── Routes ──────────────────────────────────────────────────────────

export const dailySummaryRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all daily summary routes
dailySummaryRoutes.use("*", requireSession);

/**
 * GET /api/daily-summary/:date
 *
 * Aggregates all logged data for a single date (YYYY-MM-DD) into one response.
 * Returns zero counts and empty arrays for days with no data.
 */
dailySummaryRoutes.get("/:date", async (c) => {
  const date = c.req.param("date");

  if (!DATE_REGEX.test(date)) {
    return c.json({ error: "Invalid date format. Expected YYYY-MM-DD." }, 400);
  }

  // Run all queries in parallel for best performance
  const [supplementResult, foodResult, trainingResult, metricsResult, journalResult, allSupplementsResult] =
    await Promise.all([
      // Supplements: join logs with supplements table for names/doses/colors
      c.env.DB.prepare(
        `SELECT s.name, s.current_dose, s.unit, s.id AS supplement_id, s.color,
                sl.id AS log_id, sl.scheduled_time, sl.taken_at, sl.actual_dose, sl.skipped
         FROM supplement_logs sl
         JOIN supplements s ON s.id = sl.supplement_id
         WHERE sl.scheduled_date = ?
         ORDER BY sl.scheduled_time ASC`,
      )
        .bind(date)
        .all<SupplementLogJoinRow>(),

      // Food entries (includes Phase 6 source field)
      c.env.DB.prepare(
        `SELECT meal, food_name, calories, protein, carbs, fat, source
         FROM food_entries
         WHERE date = ?
         ORDER BY meal ASC, logged_at ASC`,
      )
        .bind(date)
        .all<FoodEntryRow>(),

      // Training sessions
      c.env.DB.prepare(
        `SELECT type, duration_minutes, notes
         FROM training_sessions
         WHERE date = ?
         ORDER BY logged_at ASC`,
      )
        .bind(date)
        .all<TrainingSessionRow>(),

      // Daily metrics (single row keyed by date)
      c.env.DB.prepare(
        `SELECT weight, water_ml
         FROM daily_metrics
         WHERE date = ?`,
      )
        .bind(date)
        .first<DailyMetricsRow>(),

      // Journal entries
      c.env.DB.prepare(
        `SELECT content, created_at
         FROM journal_entries
         WHERE date = ?
         ORDER BY created_at ASC`,
      )
        .bind(date)
        .all<JournalEntryRow>(),

      // All supplements (for schedule computation to find pending ones)
      c.env.DB.prepare(
        `SELECT id, name, schedule_type, schedule_value, time_of_day, active, color, created_at
         FROM supplements
         ORDER BY name`,
      ).all<SupplementScheduleRow>(),
    ]);

  // ── Transform supplements ──────────────────────────────────────────
  const supplementRows = supplementResult.results ?? [];
  const supplementItems: SupplementItem[] = supplementRows.map((row) => ({
    name: row.name,
    dose: buildDose(row),
    time: buildTime(row),
    status: row.skipped === 1 ? ("skipped" as const) : ("taken" as const),
  }));
  const taken = supplementItems.filter((i) => i.status === "taken").length;
  const skipped = supplementItems.filter((i) => i.status === "skipped").length;

  // Phase 6: Build supplement dot data for calendar visualization
  // Start with logged supplements
  const supplementDots: SupplementDotStatus[] = supplementRows.map((row, idx) => ({
    supplementId: row.supplement_id,
    name: row.name,
    color: row.color ?? SUPPLEMENT_PALETTE[idx % SUPPLEMENT_PALETTE.length] ?? '#3B82F6',
    status: row.skipped === 1 ? ("skipped" as const) : (row.taken_at ? "taken" as const : "pending" as const),
    logId: row.log_id,
  }));

  // Add pending supplements from schedule that have no log entry yet
  const loggedSupplementIds = new Set(supplementRows.map((r) => r.supplement_id));
  const allSupplements = allSupplementsResult.results ?? [];
  const schedulables = allSupplements
    .map(toSchedulable)
    .filter((s): s is SchedulableSupplement => s !== null);

  // Build color lookup for supplements
  let paletteIdx = 0;
  const colorMap = new Map<string, string>();
  for (const row of allSupplements) {
    if (row.color) {
      colorMap.set(row.id, row.color);
    } else {
      colorMap.set(row.id, SUPPLEMENT_PALETTE[paletteIdx % SUPPLEMENT_PALETTE.length] ?? '#3B82F6');
      paletteIdx++;
    }
  }

  // Compute which supplements are scheduled for this date
  const scheduledForDate = schedulables.flatMap((supp) =>
    getOccurrences(supp, date, date),
  );

  for (const occ of scheduledForDate) {
    if (loggedSupplementIds.has(occ.supplementId)) continue; // already in dots from logs
    supplementDots.push({
      supplementId: occ.supplementId,
      name: occ.supplementName,
      color: colorMap.get(occ.supplementId) ?? SUPPLEMENT_PALETTE[0] ?? '#3B82F6',
      status: "pending",
    });
  }

  // ── Transform nutrition ────────────────────────────────────────────
  const foodRows = foodResult.results ?? [];
  const mealMap = new Map<string, NutritionItem[]>();
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const row of foodRows) {
    const cal = row.calories ?? 0;
    const pro = row.protein ?? 0;
    const carb = row.carbs ?? 0;
    const fat = row.fat ?? 0;

    totalCalories += cal;
    totalProtein += pro;
    totalCarbs += carb;
    totalFat += fat;

    if (!mealMap.has(row.meal)) {
      mealMap.set(row.meal, []);
    }
    const item: NutritionItem = {
      name: row.food_name,
      calories: cal,
      protein: pro,
      carbs: carb,
      fat: fat,
    };
    // Phase 6: include source field on food entries when present
    if (row.source != null) {
      item.source = row.source;
    }
    mealMap.get(row.meal)!.push(item);
  }

  const meals: MealGroup[] = Array.from(mealMap.entries()).map(
    ([meal, items]) => ({ meal, items }),
  );

  // ── Transform training ─────────────────────────────────────────────
  const trainingRows = trainingResult.results ?? [];
  let totalDuration = 0;
  const sessions: TrainingSessionSummary[] = trainingRows.map((row) => {
    const duration = row.duration_minutes ?? 0;
    totalDuration += duration;
    const session: TrainingSessionSummary = { type: row.type, duration };
    if (row.notes) session.notes = row.notes;
    return session;
  });

  // ── Transform metrics ──────────────────────────────────────────────
  const metrics: DailySummary["metrics"] = {};
  if (metricsResult?.weight != null) metrics.weight = metricsResult.weight;
  if (metricsResult?.water_ml != null) metrics.hydration = metricsResult.water_ml;

  // ── Transform journal ──────────────────────────────────────────────
  const journalRows = journalResult.results ?? [];
  const journalEntries = journalRows.map((row) => ({
    content: row.content,
    createdAt: row.created_at,
  }));

  // ── Build response ─────────────────────────────────────────────────
  const summary: DailySummary = {
    date,
    supplements: {
      taken,
      skipped,
      total: supplementDots.length,
      items: supplementItems,
      dots: supplementDots,
    },
    nutrition: {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      meals,
    },
    training: {
      sessions,
      totalDuration,
    },
    metrics,
    journal: {
      entries: journalEntries,
    },
  };

  return c.json(summary);
});
