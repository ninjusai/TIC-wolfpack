/**
 * Compliance API types and helpers (WRK-017).
 *
 * Types match the backend ComplianceSummary / StreakInfo shapes.
 * All functions use the shared apiFetch wrapper.
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface ComplianceItem {
  supplementId: string;
  supplementName: string;
  scheduledDate: string;
  timeOfDay: string;
  status: "taken" | "missed" | "skipped" | "pending";
  takenAt: string | null;
}

export interface ComplianceSummary {
  date: string;
  totalScheduled: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  completionRate: number;
  items: ComplianceItem[];
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastPerfectDate: string | null;
}

export interface RangeComplianceResponse {
  compliance: ComplianceSummary[];
  overall: {
    completionRate: number;
    totalTaken: number;
    totalScheduled: number;
  };
}

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

/** Fetch compliance summary for a single date (defaults to today). */
export function getDailyCompliance(
  date?: string,
): Promise<{ compliance: ComplianceSummary }> {
  const qs = date ? `?date=${date}` : "";
  return apiFetch<{ compliance: ComplianceSummary }>(
    `/api/compliance/daily${qs}`,
  );
}

/** Fetch compliance summaries for a date range. */
export function getRangeCompliance(
  startDate: string,
  endDate: string,
): Promise<RangeComplianceResponse> {
  return apiFetch<RangeComplianceResponse>(
    `/api/compliance/range?startDate=${startDate}&endDate=${endDate}`,
  );
}

/** Fetch current and longest streak info. */
export function getStreak(
  days?: number,
): Promise<{ streak: StreakInfo }> {
  const qs = days ? `?days=${days}` : "";
  return apiFetch<{ streak: StreakInfo }>(`/api/compliance/streak${qs}`);
}

/** Log a supplement as taken or skipped. */
export function logSupplement(
  supplementId: string,
  data: {
    scheduledDate: string;
    takenAt?: string;
    skipped?: boolean;
    notes?: string;
  },
): Promise<void> {
  return apiFetch<void>(`/api/supplements/${supplementId}/log`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
