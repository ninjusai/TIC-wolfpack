/**
 * Correlation analysis service for PeakProtocol (WRK-037).
 *
 * Pure functions -- no D1 access, no side effects.
 * Routes handle data fetching; this module computes statistical
 * correlations and trend analysis across nutrition, training,
 * supplement compliance, and body-weight data.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface CorrelationResult {
  metric1: string;
  metric2: string;
  correlation: number | null;
  interpretation: string;
  dataPoints: number;
  period: { start: string; end: string };
}

export interface AnalysisReport {
  period: { start: string; end: string };
  dataPoints: number;
  correlations: CorrelationResult[];
  weightTrend: {
    current7DayAvg: number | null;
    previous7DayAvg: number | null;
    delta: number | null;
    trend: "up" | "down" | "stable";
  };
  macroAverages: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
}

export interface WeightEntry {
  date: string;
  weight: number | null;
}

export interface DailyMacros {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface TrainingSession {
  date: string;
  durationMinutes: number;
}

export interface ComplianceRate {
  date: string;
  rate: number;
}

export interface AnalysisInput {
  weights: WeightEntry[];
  dailyMacros: DailyMacros[];
  trainingSessions: TrainingSession[];
  complianceRates: ComplianceRate[];
  period: { start: string; end: string };
}

// ── Core math functions ───────────────────────────────────────────────

/**
 * Pearson correlation coefficient.
 * Returns a value from -1 to 1, or null if fewer than 5 paired data points.
 */
export function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 5) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
    sumY2 += yi * yi;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );

  if (denominator === 0) return null;

  const r = numerator / denominator;
  // Clamp to [-1, 1] to handle floating-point imprecision
  return Math.max(-1, Math.min(1, r));
}

/**
 * Human-readable interpretation of a Pearson correlation coefficient.
 */
export function interpretCorrelation(r: number): string {
  const abs = Math.abs(r);
  const direction = r >= 0 ? "positive" : "negative";

  if (abs < 0.2) return "No meaningful correlation";
  if (abs < 0.4) return `Weak ${direction} correlation`;
  if (abs < 0.6) return `Moderate ${direction} correlation`;
  if (abs < 0.8) return `Strong ${direction} correlation`;
  return `Very strong ${direction} correlation`;
}

/**
 * Simple moving average over a window.
 * Null values in the input are skipped -- if fewer than 1 non-null value
 * exists in the window, the output for that position is null.
 */
export function movingAverage(
  values: (number | null)[],
  window: number,
): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    let sum = 0;
    let count = 0;

    for (let j = start; j <= i; j++) {
      const v = values[j];
      if (v !== null && v !== undefined) {
        sum += v;
        count++;
      }
    }

    result.push(count > 0 ? sum / count : null);
  }

  return result;
}

/**
 * Calculate 7-day weight delta: current 7-day average minus previous 7-day average.
 * Requires at least 14 entries to be meaningful.
 * Returns null if insufficient data.
 */
export function weightDelta(
  weights: WeightEntry[],
): number | null {
  // Filter to entries with non-null weight, sorted by date
  const valid = weights
    .filter((w): w is { date: string; weight: number } => w.weight !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (valid.length < 14) return null;

  const recent7 = valid.slice(-7);
  const previous7 = valid.slice(-14, -7);

  if (recent7.length < 7 || previous7.length < 7) return null;

  const recentAvg =
    recent7.reduce((sum, w) => sum + w.weight, 0) / recent7.length;
  const previousAvg =
    previous7.reduce((sum, w) => sum + w.weight, 0) / previous7.length;

  return round2(recentAvg - previousAvg);
}

// ── Report generation ─────────────────────────────────────────────────

/**
 * Generate a full analysis report from raw data.
 * All correlation math is performed here -- routes only provide the data.
 */
export function generateAnalysisReport(data: AnalysisInput): AnalysisReport {
  const { weights, dailyMacros, trainingSessions, complianceRates, period } =
    data;

  // ── Weight trend ──────────────────────────────────────────────────
  const validWeights = weights
    .filter((w): w is { date: string; weight: number } => w.weight !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const current7DayAvg = avg(validWeights.slice(-7).map((w) => w.weight));
  const previous7DayAvg = avg(
    validWeights.slice(-14, -7).map((w) => w.weight),
  );
  const delta = weightDelta(weights);

  let trend: "up" | "down" | "stable" = "stable";
  if (delta !== null) {
    if (delta > 0.1) trend = "up";
    else if (delta < -0.1) trend = "down";
  }

  // ── Macro averages ────────────────────────────────────────────────
  const macroAverages = {
    calories: avg(dailyMacros.map((m) => m.calories)),
    protein: avg(dailyMacros.map((m) => m.protein)),
    carbs: avg(dailyMacros.map((m) => m.carbs)),
    fat: avg(dailyMacros.map((m) => m.fat)),
  };

  // ── Correlations ──────────────────────────────────────────────────
  const correlations: CorrelationResult[] = [];

  // Build date-indexed maps for pairing
  const weightByDate = new Map(validWeights.map((w) => [w.date, w.weight]));
  const macroByDate = new Map(dailyMacros.map((m) => [m.date, m]));
  const trainingByDate = new Map<string, number>();
  for (const ts of trainingSessions) {
    trainingByDate.set(
      ts.date,
      (trainingByDate.get(ts.date) ?? 0) + ts.durationMinutes,
    );
  }
  const complianceByDate = new Map(complianceRates.map((c) => [c.date, c.rate]));

  // Compute 7-day moving average of weight for delta correlation
  const allDates = collectUniqueDates(weights, dailyMacros);
  const weightMA = compute7DayWeightMA(allDates, weightByDate);

  // 1. Daily protein vs 7-day weight delta
  correlations.push(
    computePairedCorrelation(
      "protein",
      "weight_7day_avg",
      allDates,
      macroByDate,
      (m) => m.protein,
      weightMA,
      period,
    ),
  );

  // 2. Daily calories vs 7-day weight delta
  correlations.push(
    computePairedCorrelation(
      "calories",
      "weight_7day_avg",
      allDates,
      macroByDate,
      (m) => m.calories,
      weightMA,
      period,
    ),
  );

  // 3. Weekly training volume vs weekly weight change
  correlations.push(
    computeWeeklyTrainingCorrelation(
      trainingSessions,
      validWeights,
      period,
    ),
  );

  // 4. Supplement compliance vs weight stability (lower variance = more stable)
  correlations.push(
    computeComplianceStabilityCorrelation(
      complianceRates,
      validWeights,
      period,
    ),
  );

  // Total data points = unique dates with any data
  const allDataDates = new Set<string>();
  for (const w of weights) allDataDates.add(w.date);
  for (const m of dailyMacros) allDataDates.add(m.date);
  for (const t of trainingSessions) allDataDates.add(t.date);
  for (const c of complianceRates) allDataDates.add(c.date);

  return {
    period,
    dataPoints: allDataDates.size,
    correlations,
    weightTrend: {
      current7DayAvg,
      previous7DayAvg,
      delta,
      trend,
    },
    macroAverages,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((s, v) => s + v, 0) / values.length);
}

/** Collect unique sorted dates from weights and macros. */
function collectUniqueDates(
  weights: WeightEntry[],
  macros: DailyMacros[],
): string[] {
  const dates = new Set<string>();
  for (const w of weights) dates.add(w.date);
  for (const m of macros) dates.add(m.date);
  return Array.from(dates).sort();
}

/** Compute 7-day moving average of weight indexed by date. */
function compute7DayWeightMA(
  sortedDates: string[],
  weightByDate: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();
  const window: number[] = [];

  for (const date of sortedDates) {
    const w = weightByDate.get(date);
    if (w !== undefined) {
      window.push(w);
      if (window.length > 7) window.shift();
    }
    if (window.length >= 3) {
      // Need at least 3 data points in the window
      result.set(date, window.reduce((s, v) => s + v, 0) / window.length);
    }
  }

  return result;
}

/** Compute correlation between a macro metric and weight 7-day moving average. */
function computePairedCorrelation(
  metricName: string,
  weightMetricName: string,
  sortedDates: string[],
  macroByDate: Map<string, DailyMacros>,
  extractor: (m: DailyMacros) => number,
  weightMA: Map<string, number>,
  period: { start: string; end: string },
): CorrelationResult {
  const xValues: number[] = [];
  const yValues: number[] = [];

  for (const date of sortedDates) {
    const macro = macroByDate.get(date);
    const wma = weightMA.get(date);
    if (macro !== undefined && wma !== undefined) {
      xValues.push(extractor(macro));
      yValues.push(wma);
    }
  }

  const r = pearsonCorrelation(xValues, yValues);

  return {
    metric1: metricName,
    metric2: weightMetricName,
    correlation: r !== null ? round2(r) : null,
    interpretation: r !== null ? interpretCorrelation(r) : "Insufficient data",
    dataPoints: xValues.length,
    period,
  };
}

/** Compute weekly training volume vs weekly weight change correlation. */
function computeWeeklyTrainingCorrelation(
  sessions: TrainingSession[],
  validWeights: { date: string; weight: number }[],
  period: { start: string; end: string },
): CorrelationResult {
  // Group by ISO week (Monday-based)
  const weeklyVolume = new Map<string, number>();
  for (const s of sessions) {
    const wk = isoWeekKey(s.date);
    weeklyVolume.set(wk, (weeklyVolume.get(wk) ?? 0) + s.durationMinutes);
  }

  const weeklyWeightAvg = new Map<string, number>();
  const weekBuckets = new Map<string, number[]>();
  for (const w of validWeights) {
    const wk = isoWeekKey(w.date);
    const bucket = weekBuckets.get(wk) ?? [];
    bucket.push(w.weight);
    weekBuckets.set(wk, bucket);
  }
  for (const [wk, bucket] of weekBuckets) {
    weeklyWeightAvg.set(wk, bucket.reduce((s, v) => s + v, 0) / bucket.length);
  }

  // Compute weekly weight change (difference between consecutive weeks)
  const sortedWeeks = Array.from(
    new Set([...weeklyVolume.keys(), ...weeklyWeightAvg.keys()]),
  ).sort();

  const xValues: number[] = [];
  const yValues: number[] = [];

  for (let i = 1; i < sortedWeeks.length; i++) {
    const wk = sortedWeeks[i]!;
    const prevWk = sortedWeeks[i - 1]!;
    const vol = weeklyVolume.get(wk);
    const currWeight = weeklyWeightAvg.get(wk);
    const prevWeight = weeklyWeightAvg.get(prevWk);

    if (vol !== undefined && currWeight !== undefined && prevWeight !== undefined) {
      xValues.push(vol);
      yValues.push(currWeight - prevWeight);
    }
  }

  const r = pearsonCorrelation(xValues, yValues);

  return {
    metric1: "weekly_training_volume",
    metric2: "weekly_weight_change",
    correlation: r !== null ? round2(r) : null,
    interpretation: r !== null ? interpretCorrelation(r) : "Insufficient data",
    dataPoints: xValues.length,
    period,
  };
}

/** Compute correlation between compliance rate and weight stability (inverse variance). */
function computeComplianceStabilityCorrelation(
  complianceRates: ComplianceRate[],
  validWeights: { date: string; weight: number }[],
  period: { start: string; end: string },
): CorrelationResult {
  // Group both by ISO week
  const weeklyCompliance = new Map<string, number[]>();
  for (const c of complianceRates) {
    const wk = isoWeekKey(c.date);
    const bucket = weeklyCompliance.get(wk) ?? [];
    bucket.push(c.rate);
    weeklyCompliance.set(wk, bucket);
  }

  const weeklyWeights = new Map<string, number[]>();
  for (const w of validWeights) {
    const wk = isoWeekKey(w.date);
    const bucket = weeklyWeights.get(wk) ?? [];
    bucket.push(w.weight);
    weeklyWeights.set(wk, bucket);
  }

  const xValues: number[] = [];
  const yValues: number[] = [];

  const allWeeks = new Set([
    ...weeklyCompliance.keys(),
    ...weeklyWeights.keys(),
  ]);

  for (const wk of allWeeks) {
    const compRates = weeklyCompliance.get(wk);
    const wts = weeklyWeights.get(wk);

    if (compRates && compRates.length > 0 && wts && wts.length >= 2) {
      const avgCompliance =
        compRates.reduce((s, v) => s + v, 0) / compRates.length;
      // Weight stability = negative variance (higher compliance -> lower variance is good)
      const wtMean = wts.reduce((s, v) => s + v, 0) / wts.length;
      const variance =
        wts.reduce((s, v) => s + (v - wtMean) ** 2, 0) / wts.length;
      // Use negative variance so positive correlation = good (higher compliance = less variance)
      xValues.push(avgCompliance);
      yValues.push(-variance);
    }
  }

  const r = pearsonCorrelation(xValues, yValues);

  return {
    metric1: "supplement_compliance",
    metric2: "weight_stability",
    correlation: r !== null ? round2(r) : null,
    interpretation: r !== null ? interpretCorrelation(r) : "Insufficient data",
    dataPoints: xValues.length,
    period,
  };
}

/** Return an ISO week key like "2026-W14" for a YYYY-MM-DD date string. */
function isoWeekKey(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 2000;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d));

  // ISO week calculation
  const dayOfWeek = date.getUTCDay() || 7; // Make Sunday = 7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );

  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}
