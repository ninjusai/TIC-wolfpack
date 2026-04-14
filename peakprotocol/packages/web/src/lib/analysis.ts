/**
 * Analysis/Reports API types and fetch helper (WRK-038).
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch the analysis report for a given number of days (default 30).
 */
export async function getAnalysisReport(
  days: number = 30,
): Promise<AnalysisReport> {
  const res = await apiFetch<{ report: AnalysisReport }>(
    `/api/analysis/report?days=${days}`,
  );
  return res.report;
}
