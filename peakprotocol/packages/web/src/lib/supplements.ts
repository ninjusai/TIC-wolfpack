/**
 * Supplement API types and helpers (WRK-016).
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface Supplement {
  id: string;
  name: string;
  currentDose: string | null;
  unit: string | null;
  scheduleType: string | null;
  scheduleValue: Record<string, unknown> | null;
  timeOfDay: string | null;
  tags: string[];
  active: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoseChange {
  id: string;
  supplementId: string;
  dose: string | null;
  unit: string | null;
  changedAt: string;
  notes: string | null;
}

export interface ScheduleOccurrence {
  date: string;
  timeOfDay: string;
  supplementId: string;
  supplementName: string;
}

export interface SupplementFormData {
  name: string;
  currentDose: string;
  unit: string;
  scheduleType: string;
  scheduleValue: Record<string, unknown>;
  timeOfDay: string;
  tags: string[];
}

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

export async function fetchSupplements(params?: {
  active?: boolean;
  tag?: string;
}): Promise<Supplement[]> {
  const search = new URLSearchParams();
  if (params?.active !== undefined) search.set("active", String(params.active));
  if (params?.tag) search.set("tag", params.tag);
  const qs = search.toString();
  const res = await apiFetch<{ supplements: Supplement[] }>(`/api/supplements${qs ? `?${qs}` : ""}`);
  return res.supplements;
}

export async function fetchSupplement(id: string): Promise<Supplement> {
  const res = await apiFetch<{ supplement: Supplement }>(`/api/supplements/${id}`);
  return res.supplement;
}

export async function createSupplement(
  data: SupplementFormData,
): Promise<Supplement> {
  const res = await apiFetch<{ supplement: Supplement }>("/api/supplements", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.supplement;
}

export async function updateSupplement(
  id: string,
  data: Partial<SupplementFormData>,
): Promise<Supplement> {
  const res = await apiFetch<{ supplement: Supplement }>(`/api/supplements/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.supplement;
}

export async function deleteSupplement(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/supplements/${id}`, { method: "DELETE" });
}

export async function changeDose(
  id: string,
  dose: string,
  unit: string,
  notes?: string,
): Promise<{ doseChange: DoseChange; supplement: Supplement }> {
  return apiFetch<{ doseChange: DoseChange; supplement: Supplement }>(`/api/supplements/${id}/dose`, {
    method: "POST",
    body: JSON.stringify({ dose, unit, notes }),
  });
}

export async function fetchDoseHistory(id: string): Promise<{ history: DoseChange[]; total: number }> {
  return apiFetch<{ history: DoseChange[]; total: number }>(`/api/supplements/${id}/dose-history`);
}

export async function fetchSchedule(): Promise<ScheduleOccurrence[]> {
  const res = await apiFetch<{ schedule?: ScheduleOccurrence[]; occurrences?: ScheduleOccurrence[] }>("/api/supplements/schedule");
  return res.schedule ?? res.occurrences ?? [];
}

export async function fetchNextOccurrences(
  id: string,
): Promise<ScheduleOccurrence[]> {
  const res = await apiFetch<{ schedule?: ScheduleOccurrence[]; occurrences?: ScheduleOccurrence[] }>(`/api/supplements/${id}/schedule`);
  return res.schedule ?? res.occurrences ?? [];
}

/* ------------------------------------------------------------------ */
/* Calendar Supplement Types (Phase 6 — WRK-PP6-016/019)              */
/* ------------------------------------------------------------------ */

/** Per-supplement status for a single day (matches backend DaySupplementStatus). */
export interface DaySupplementStatus {
  supplementId: string;
  name: string;
  color: string;
  status: "taken" | "skipped" | "pending";
  logId?: string | null;
}

/** Full calendar-supplements API response shape. */
export interface CalendarSupplementsResponse {
  days: Record<string, DaySupplementStatus[]>;
  compliance: Record<string, "full" | "partial" | "none" | null>;
}

/** Batch log API response shape. */
export interface BatchLogResponse {
  created: number;
  alreadyLogged: number;
}

/* ------------------------------------------------------------------ */
/* Calendar Supplement API calls                                       */
/* ------------------------------------------------------------------ */

/** Fetch per-day supplement dots and compliance for an entire month. */
export async function fetchCalendarSupplements(
  month: string,
): Promise<CalendarSupplementsResponse> {
  return apiFetch<CalendarSupplementsResponse>(`/api/calendar-supplements/${month}`);
}

/** Mark multiple supplements as taken for a given date (batch). */
export async function batchLogSupplements(
  date: string,
  supplementIds: string[],
): Promise<BatchLogResponse> {
  return apiFetch<BatchLogResponse>("/api/supplements/batch-log", {
    method: "POST",
    body: JSON.stringify({ date, supplementIds }),
  });
}

/** Delete a supplement log by ID (undo/uncheck). */
export async function deleteSupplementLog(logId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/supplements/logs/${logId}`, {
    method: "DELETE",
  });
}
