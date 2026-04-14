/**
 * Analysis routes for PeakProtocol (WRK-037).
 *
 * Provides correlation analysis and trend reports across nutrition,
 * training, supplement compliance, and body-weight data.
 * All routes require an authenticated session.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";
import { formatDate, parseDate, addDays } from "../lib/dates";
import {
  generateAnalysisReport,
  pearsonCorrelation,
  interpretCorrelation,
  type CorrelationResult,
  type WeightEntry,
  type DailyMacros,
  type TrainingSession,
  type ComplianceRate,
} from "../services/analysis";

// ── Zod Schemas ────────────────────────────────────────────────────────

const ReportQuerySchema = z.object({
  days: z.coerce.number().int().min(14).default(30),
});

const VALID_METRICS = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "weight",
  "training_volume",
  "compliance",
] as const;

type MetricName = (typeof VALID_METRICS)[number];

const CorrelationQuerySchema = z.object({
  metric1: z.enum(VALID_METRICS),
  metric2: z.enum(VALID_METRICS),
  days: z.coerce.number().int().min(14).default(30),
});

// ── D1 Row Types ──────────────────────────────────────────────────────

interface WeightRow {
  date: string;
  weight: number | null;
}

interface FoodEntryAggRow {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface TrainingRow {
  date: string;
  duration_minutes: number;
}

interface ComplianceRow {
  scheduled_date: string;
  total: number;
  taken: number;
}

// ── Data Fetching Helpers ─────────────────────────────────────────────

async function fetchWeights(
  db: D1Database,
  start: string,
  end: string,
): Promise<WeightEntry[]> {
  const { results } = await db
    .prepare(
      "SELECT date, weight FROM daily_metrics WHERE date >= ? AND date <= ? ORDER BY date ASC",
    )
    .bind(start, end)
    .all<WeightRow>();

  return (results ?? []).map((r) => ({ date: r.date, weight: r.weight }));
}

async function fetchDailyMacros(
  db: D1Database,
  start: string,
  end: string,
): Promise<DailyMacros[]> {
  const { results } = await db
    .prepare(
      `SELECT date,
              COALESCE(SUM(calories), 0) as calories,
              COALESCE(SUM(protein), 0)  as protein,
              COALESCE(SUM(carbs), 0)    as carbs,
              COALESCE(SUM(fat), 0)      as fat
       FROM food_entries
       WHERE date >= ? AND date <= ?
       GROUP BY date
       ORDER BY date ASC`,
    )
    .bind(start, end)
    .all<FoodEntryAggRow>();

  return (results ?? []).map((r) => ({
    date: r.date,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
  }));
}

async function fetchTrainingSessions(
  db: D1Database,
  start: string,
  end: string,
): Promise<TrainingSession[]> {
  const { results } = await db
    .prepare(
      `SELECT date, duration_minutes
       FROM training_sessions
       WHERE date >= ? AND date <= ? AND duration_minutes IS NOT NULL
       ORDER BY date ASC`,
    )
    .bind(start, end)
    .all<TrainingRow>();

  return (results ?? []).map((r) => ({
    date: r.date,
    durationMinutes: r.duration_minutes,
  }));
}

async function fetchComplianceRates(
  db: D1Database,
  start: string,
  end: string,
): Promise<ComplianceRate[]> {
  // Calculate daily compliance as taken / total_scheduled
  const { results } = await db
    .prepare(
      `SELECT scheduled_date,
              COUNT(*) as total,
              SUM(CASE WHEN taken_at IS NOT NULL THEN 1 ELSE 0 END) as taken
       FROM supplement_logs
       WHERE scheduled_date >= ? AND scheduled_date <= ?
       GROUP BY scheduled_date
       ORDER BY scheduled_date ASC`,
    )
    .bind(start, end)
    .all<ComplianceRow>();

  return (results ?? [])
    .filter((r) => r.total > 0)
    .map((r) => ({
      date: r.scheduled_date,
      rate: Math.round((r.taken / r.total) * 100),
    }));
}

// ── Metric Data Extraction for Single Correlation ─────────────────────

async function fetchMetricSeries(
  db: D1Database,
  metric: MetricName,
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  switch (metric) {
    case "weight": {
      const weights = await fetchWeights(db, start, end);
      for (const w of weights) {
        if (w.weight !== null) result.set(w.date, w.weight);
      }
      break;
    }
    case "calories":
    case "protein":
    case "carbs":
    case "fat": {
      const macros = await fetchDailyMacros(db, start, end);
      for (const m of macros) {
        result.set(m.date, m[metric]);
      }
      break;
    }
    case "training_volume": {
      const sessions = await fetchTrainingSessions(db, start, end);
      for (const s of sessions) {
        result.set(
          s.date,
          (result.get(s.date) ?? 0) + s.durationMinutes,
        );
      }
      break;
    }
    case "compliance": {
      const rates = await fetchComplianceRates(db, start, end);
      for (const c of rates) {
        result.set(c.date, c.rate);
      }
      break;
    }
  }

  return result;
}

// ── Routes ────────────────────────────────────────────────────────────

export const analysisRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

analysisRoutes.use("*", requireSession);

/**
 * GET /api/analysis/report
 *
 * Generate a full analysis report with correlations and trends.
 * Query params: days (optional, default 30, min 14).
 */
analysisRoutes.get("/report", async (c) => {
  const raw = { days: c.req.query("days") ?? "30" };
  const parsed = ReportQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid query params",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const { days } = parsed.data;
  const endDate = new Date();
  const startDate = addDays(endDate, -(days - 1));
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  const [weights, dailyMacros, trainingSessions, complianceRates] =
    await Promise.all([
      fetchWeights(c.env.DB, start, end),
      fetchDailyMacros(c.env.DB, start, end),
      fetchTrainingSessions(c.env.DB, start, end),
      fetchComplianceRates(c.env.DB, start, end),
    ]);

  const report = generateAnalysisReport({
    weights,
    dailyMacros,
    trainingSessions,
    complianceRates,
    period: { start, end },
  });

  return c.json({ report });
});

/**
 * GET /api/analysis/correlation
 *
 * Compute a single correlation between two metrics.
 * Query params: metric1, metric2, days (default 30, min 14).
 */
analysisRoutes.get("/correlation", async (c) => {
  const raw = {
    metric1: c.req.query("metric1"),
    metric2: c.req.query("metric2"),
    days: c.req.query("days") ?? "30",
  };

  const parsed = CorrelationQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid query params",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const { metric1, metric2, days } = parsed.data;

  if (metric1 === metric2) {
    return c.json({ error: "metric1 and metric2 must be different" }, 400);
  }

  const endDate = new Date();
  const startDate = addDays(endDate, -(days - 1));
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  const [series1, series2] = await Promise.all([
    fetchMetricSeries(c.env.DB, metric1, start, end),
    fetchMetricSeries(c.env.DB, metric2, start, end),
  ]);

  // Pair on matching dates (sparse data -- skip dates without both values)
  const xValues: number[] = [];
  const yValues: number[] = [];

  for (const [date, val1] of series1) {
    const val2 = series2.get(date);
    if (val2 !== undefined) {
      xValues.push(val1);
      yValues.push(val2);
    }
  }

  const r = pearsonCorrelation(xValues, yValues);

  const correlation: CorrelationResult = {
    metric1,
    metric2,
    correlation: r !== null ? Math.round(r * 100) / 100 : null,
    interpretation: r !== null ? interpretCorrelation(r) : "Insufficient data",
    dataPoints: xValues.length,
    period: { start, end },
  };

  return c.json({ correlation });
});
