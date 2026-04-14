/**
 * Training session API types and helpers (WRK-032/033/034).
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface ExerciseSet {
  reps: number;
  weight: number;
  unit: string;
  rpe?: number;
}

export interface Exercise {
  name: string;
  sets: ExerciseSet[];
}

export interface TrainingSession {
  id: string;
  date: string;
  type: string;
  durationMinutes: number | null;
  intensity: string | null;
  details: Record<string, unknown> | null;
  notes: string | null;
  loggedAt: string;
}

export interface WeeklySummary {
  totalDuration: number;
  sessionCount: number;
  byType: Record<string, { count: number; duration: number }>;
}

export type TrainingType = "weights" | "bjj" | "cardio" | "walk";
export type Intensity = "low" | "medium" | "high";

export const TRAINING_TYPES: { value: TrainingType; label: string; emoji: string }[] = [
  { value: "weights", label: "Weights", emoji: "\u{1F3CB}\uFE0F" },
  { value: "bjj", label: "BJJ", emoji: "\u{1F94B}" },
  { value: "cardio", label: "Cardio", emoji: "\u{1F3C3}" },
  { value: "walk", label: "Walk", emoji: "\u{1F6B6}" },
];

export const INTENSITIES: { value: Intensity; label: string; color: string; bgColor: string }[] = [
  { value: "low", label: "Low", color: "text-green-500", bgColor: "bg-green-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500", bgColor: "bg-yellow-500" },
  { value: "high", label: "High", color: "text-red-500", bgColor: "bg-red-500" },
];

/* ------------------------------------------------------------------ */
/* Date helpers (mirroring food/metrics pattern)                      */
/* ------------------------------------------------------------------ */

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * Get the Monday of the week containing the given date string.
 */
export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return formatDate(d);
}

/**
 * Get all 7 days (Mon-Sun) for the week containing dateStr.
 */
export function getWeekDays(dateStr: string): string[] {
  const monday = getWeekStart(dateStr);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(shiftDate(monday, i));
  }
  return days;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function dayLabel(index: number): string {
  return DAY_LABELS[index] ?? "";
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

export function typeEmoji(type: string): string {
  return TRAINING_TYPES.find((t) => t.value === type)?.emoji ?? "";
}

export function typeLabel(type: string): string {
  return TRAINING_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function intensityColor(intensity: string | null): string {
  return INTENSITIES.find((i) => i.value === intensity)?.color ?? "text-gray-400";
}

export function intensityBgColor(intensity: string | null): string {
  return INTENSITIES.find((i) => i.value === intensity)?.bgColor ?? "bg-gray-400";
}

/**
 * Calculate total volume for a single exercise: sum(reps * weight) across sets.
 */
export function exerciseVolume(exercise: Exercise): number {
  return exercise.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
}

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

export interface CreateTrainingData {
  date: string;
  type: string;
  durationMinutes?: number;
  intensity?: string;
  details?: Record<string, unknown>;
  notes?: string;
}

export async function getTrainingSessions(
  date: string,
): Promise<TrainingSession[]> {
  const res = await apiFetch<{ sessions: TrainingSession[] }>(
    `/api/training-sessions?date=${date}`,
  );
  return res.sessions ?? [];
}

export async function createTrainingSession(
  data: CreateTrainingData,
): Promise<TrainingSession> {
  const res = await apiFetch<{ session: TrainingSession }>("/api/training-sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.session;
}

export async function deleteTrainingSession(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/api/training-sessions/${id}`, {
    method: "DELETE",
  });
}

export async function getWeeklySummary(
  weekOf?: string,
): Promise<{ sessions: TrainingSession[]; summary: WeeklySummary }> {
  const params = weekOf ? `?weekOf=${weekOf}` : "";
  const res = await apiFetch<{
    sessions: TrainingSession[];
    summary: WeeklySummary;
  }>(`/api/training-sessions/weekly${params}`);
  return {
    sessions: res.sessions ?? [],
    summary: res.summary ?? { totalDuration: 0, sessionCount: 0, byType: {} },
  };
}
