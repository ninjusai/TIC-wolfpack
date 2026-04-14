/**
 * Weekly report generator (WRK-020, WRK-039).
 *
 * Runs Sunday 9 PM UTC via cron trigger. Calculates supplement compliance,
 * macro averages, weight trends, training stats, and a full analysis report
 * for the past 7 days (Monday-Sunday). Stores the report in D1 and sends
 * a push notification with the summary.
 *
 * Idempotent: uses INSERT OR REPLACE keyed on week_start so re-runs
 * update rather than duplicate.
 */

import type { Env } from "../env";
import { formatDate, parseDate, addDays } from "../lib/dates";
import { getOccurrences } from "../services/scheduler";
import {
  calculateDailyCompliance,
  calculateRangeCompliance,
} from "../services/compliance";
import type { SupplementLogRow } from "../services/compliance";
import type { SchedulableSupplement } from "../services/scheduler";
import { sendPushNotification } from "../services/push";
import {
  generateAnalysisReport,
  type AnalysisInput,
  type DailyMacros,
  type WeightEntry,
  type TrainingSession,
  type ComplianceRate,
} from "../services/analysis";

/** Raw supplement row from D1. */
interface SupplementRow {
  id: string;
  name: string;
  schedule_type: string;
  schedule_value: string | null;
  time_of_day: string;
  active: number;
  created_at: string;
}

/** Raw food entry row from D1. */
interface FoodEntryRow {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

/** Raw daily metrics row from D1. */
interface DailyMetricRow {
  date: string;
  weight: number | null;
}

/** Raw training session row from D1. */
interface TrainingSessionRow {
  date: string;
  duration_minutes: number | null;
}

/**
 * Generate a weekly compliance report and store it in D1.
 *
 * Idempotent: INSERT OR REPLACE ensures re-runs update the same row.
 */
export async function generateWeeklyReport(env: Env, ctx: ExecutionContext): Promise<void> {
  const now = new Date();

  // 1. Calculate date range: last 7 days (Monday to Sunday)
  //    The cron runs Sunday 9 PM, so "today" is the Sunday (week end).
  const todayStr = formatDate(now);
  const weekEnd = todayStr;
  // Go back 6 days to get Monday
  const weekStart = formatDate(addDays(parseDate(todayStr), -6));

  console.log(`[CRON:weekly-report] Generating report for ${weekStart} to ${weekEnd}`);

  // 2. Query all active supplements
  const { results: supplementRows } = await env.DB.prepare(
    "SELECT id, name, schedule_type, schedule_value, time_of_day, active, created_at FROM supplements WHERE active = 1"
  ).all<SupplementRow>();

  if (!supplementRows || supplementRows.length === 0) {
    console.log("[CRON:weekly-report] No active supplements — skipping");
    return;
  }

  const supplements: SchedulableSupplement[] = supplementRows.map((row) => ({
    id: row.id,
    name: row.name,
    scheduleType: row.schedule_type,
    scheduleValue: row.schedule_value ? JSON.parse(row.schedule_value) : null,
    timeOfDay: row.time_of_day,
    active: row.active === 1,
    createdAt: row.created_at,
  }));

  // 3. Get all occurrences for the week
  const allOccurrences = supplements.flatMap((supp) =>
    getOccurrences(supp, weekStart, weekEnd)
  );

  // 4. Get all logs for the week
  const { results: logRows } = await env.DB.prepare(
    "SELECT id, supplement_id, scheduled_date, scheduled_time, taken_at, actual_dose, skipped, notes FROM supplement_logs WHERE scheduled_date >= ? AND scheduled_date <= ?"
  ).bind(weekStart, weekEnd).all<SupplementLogRow>();

  const logs = logRows ?? [];

  // 5. Calculate compliance for each day
  const dailySummaries = calculateRangeCompliance(
    allOccurrences,
    logs,
    weekStart,
    weekEnd,
    now,
  );

  // Calculate overall weekly compliance
  let totalScheduled = 0;
  let totalTaken = 0;

  for (const day of dailySummaries) {
    totalScheduled += day.totalScheduled;
    totalTaken += day.taken;
  }

  const compliancePct =
    totalScheduled > 0
      ? Math.round((totalTaken / totalScheduled) * 1000) / 10
      : 0;

  // 6. Fetch food entries for macro averages
  const { results: foodRows } = await env.DB.prepare(
    "SELECT date, calories, protein, carbs, fat FROM food_entries WHERE date >= ? AND date <= ?"
  ).bind(weekStart, weekEnd).all<FoodEntryRow>();

  // Aggregate food entries into daily totals
  const dailyMacroMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const row of foodRows ?? []) {
    const existing = dailyMacroMap.get(row.date);
    if (existing) {
      existing.calories += row.calories ?? 0;
      existing.protein += row.protein ?? 0;
      existing.carbs += row.carbs ?? 0;
      existing.fat += row.fat ?? 0;
    } else {
      dailyMacroMap.set(row.date, {
        calories: row.calories ?? 0,
        protein: row.protein ?? 0,
        carbs: row.carbs ?? 0,
        fat: row.fat ?? 0,
      });
    }
  }

  const dailyMacros: DailyMacros[] = Array.from(dailyMacroMap.entries()).map(
    ([date, totals]) => ({ date, ...totals }),
  );

  // Calculate averages (null if no food data)
  const avgCalories = dailyMacros.length > 0
    ? Math.round(dailyMacros.reduce((s, m) => s + m.calories, 0) / dailyMacros.length)
    : null;
  const avgProtein = dailyMacros.length > 0
    ? Math.round(dailyMacros.reduce((s, m) => s + m.protein, 0) / dailyMacros.length)
    : null;
  const avgCarbs = dailyMacros.length > 0
    ? Math.round(dailyMacros.reduce((s, m) => s + m.carbs, 0) / dailyMacros.length)
    : null;
  const avgFat = dailyMacros.length > 0
    ? Math.round(dailyMacros.reduce((s, m) => s + m.fat, 0) / dailyMacros.length)
    : null;

  // 7. Fetch weight data from daily_metrics
  const { results: metricRows } = await env.DB.prepare(
    "SELECT date, weight FROM daily_metrics WHERE date >= ? AND date <= ? AND weight IS NOT NULL ORDER BY date ASC"
  ).bind(weekStart, weekEnd).all<DailyMetricRow>();

  const weightEntries: WeightEntry[] = (metricRows ?? []).map((r) => ({
    date: r.date,
    weight: r.weight,
  }));

  const weightStart = weightEntries.length > 0 ? weightEntries[0]!.weight : null;
  const weightEnd = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1]!.weight : null;

  // 8. Fetch training session data
  const { results: trainingRows } = await env.DB.prepare(
    "SELECT date, duration_minutes FROM training_sessions WHERE date >= ? AND date <= ?"
  ).bind(weekStart, weekEnd).all<TrainingSessionRow>();

  const trainingSessions: TrainingSession[] = (trainingRows ?? [])
    .filter((r): r is TrainingSessionRow & { duration_minutes: number } => r.duration_minutes !== null)
    .map((r) => ({ date: r.date, durationMinutes: r.duration_minutes }));

  const trainingMinutes = trainingSessions.length > 0
    ? trainingSessions.reduce((s, t) => s + t.durationMinutes, 0)
    : null;
  const trainingSessionCount = trainingSessions.length > 0
    ? trainingSessions.length
    : null;

  // 9. Build compliance rates for analysis service
  const complianceRates: ComplianceRate[] = dailySummaries.map((d) => ({
    date: d.date,
    rate: d.completionRate,
  }));

  // 10. Generate full analysis report
  const analysisInput: AnalysisInput = {
    weights: weightEntries,
    dailyMacros,
    trainingSessions,
    complianceRates,
    period: { start: weekStart, end: weekEnd },
  };

  const analysisReport = generateAnalysisReport(analysisInput);

  // 11. Build report JSON (compliance + analysis combined)
  const reportData = {
    weekStart,
    weekEnd,
    compliancePct,
    totalScheduled,
    totalTaken,
    dailySummaries: dailySummaries.map((d) => ({
      date: d.date,
      totalScheduled: d.totalScheduled,
      taken: d.taken,
      missed: d.missed,
      skipped: d.skipped,
      completionRate: d.completionRate,
    })),
    supplements: supplements.map((s) => s.name),
    analysis: analysisReport,
  };

  const reportJson = JSON.stringify(reportData);

  // Use a deterministic ID based on the week to ensure idempotency
  const reportId = `weekly-${weekStart}`;

  // 12. Insert into weekly_reports (INSERT OR REPLACE for idempotency)
  await env.DB.prepare(
    `INSERT OR REPLACE INTO weekly_reports
       (id, week_start, week_end, compliance_pct, avg_calories, avg_protein, avg_carbs, avg_fat, weight_start, weight_end, training_minutes, training_sessions, report_json, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    reportId,
    weekStart,
    weekEnd,
    compliancePct,
    avgCalories,
    avgProtein,
    avgCarbs,
    avgFat,
    weightStart,
    weightEnd,
    trainingMinutes,
    trainingSessionCount,
    reportJson,
    now.toISOString(),
  ).run();

  console.log(
    `[CRON:weekly-report] Report saved: ${reportId} — ${compliancePct}% compliance, ${avgCalories ?? 0} avg cal, ${trainingMinutes ?? 0} min training`
  );

  // 13. Send push notification with detailed summary
  const calDisplay = avgCalories !== null ? `${avgCalories}` : "N/A";
  const trainingDisplay = trainingMinutes !== null ? `${trainingMinutes}` : "0";

  await sendPushNotification(env, {
    title: "Weekly Report",
    body: `Weekly Report: ${compliancePct}% compliance, avg ${calDisplay} cal/day, ${trainingDisplay} min training`,
    tag: `weekly-report-${weekStart}`,
    data: {
      type: "weekly_report",
      reportId,
      weekStart,
      weekEnd,
      compliancePct,
    },
  });
}
