/**
 * Daily metrics API types and helpers (WRK-030).
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface DailyMetrics {
  date: string;
  weight: number | null;
  weightUnit: string;
  waterMl: number | null;
  waterTargetMl: number;
  notes: string | null;
  tags: string[];
  loggedAt: string;
}

export interface MetricsUpdateData {
  weight?: number | null;
  weightUnit?: string;
  waterMl?: number | null;
  waterTargetMl?: number;
  notes?: string | null;
  tags?: string[];
}

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

export async function getMetrics(date: string): Promise<DailyMetrics | null> {
  try {
    const res = await apiFetch<{ metrics: DailyMetrics }>(`/api/metrics/${date}`);
    return res.metrics ?? null;
  } catch {
    return null;
  }
}

export async function updateMetrics(
  date: string,
  data: MetricsUpdateData,
): Promise<DailyMetrics> {
  const res = await apiFetch<{ metrics: DailyMetrics }>(`/api/metrics/${date}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.metrics;
}

export async function getMetricsRange(
  startDate: string,
  endDate: string,
): Promise<DailyMetrics[]> {
  const res = await apiFetch<{ metrics: DailyMetrics[] }>(
    `/api/metrics?startDate=${startDate}&endDate=${endDate}`,
  );
  return res.metrics;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format a Date as YYYY-MM-DD */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Shift a YYYY-MM-DD string by n days */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** Convert weight between kg and lbs */
export function convertWeight(value: number, from: string, to: string): number {
  if (from === to) return value;
  if (from === "kg" && to === "lbs") return Math.round(value * 2.20462 * 10) / 10;
  if (from === "lbs" && to === "kg") return Math.round(value / 2.20462 * 10) / 10;
  return value;
}
