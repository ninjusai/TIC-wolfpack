/**
 * Daily Summary API types and helpers.
 *
 * Fetches aggregated day data (supplements, nutrition, training, metrics, journal)
 * from the /api/daily-summary/:date endpoint.
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface SupplementItem {
  name: string;
  dose: string;
  time: string;
  status: "taken" | "skipped";
}

/** Per-supplement dot status for calendar visualization (Phase 6). */
export interface SupplementDotStatus {
  supplementId: string;
  name: string;
  color: string;
  status: "taken" | "skipped" | "pending";
  /** Log record ID (present when a log entry exists, used for uncheck/delete). */
  logId?: string;
}

export interface SupplementSummary {
  taken: number;
  skipped: number;
  total: number;
  items: SupplementItem[];
  /** Phase 6: per-supplement dot data for calendar view. */
  dots: SupplementDotStatus[];
}

export interface MealItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string | null;
}

export interface MealEntry {
  meal: string;
  items: MealItem[];
}

export interface NutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: MealEntry[];
}

export interface TrainingSession {
  type: string;
  duration: number;
  notes?: string;
}

export interface TrainingSummary {
  sessions: TrainingSession[];
  totalDuration: number;
}

export interface MetricsSummary {
  weight?: number;
  hydration?: number;
}

export interface JournalEntry {
  content: string;
  createdAt: string;
}

export interface JournalSummary {
  entries: JournalEntry[];
}

export interface DailySummary {
  date: string;
  supplements: SupplementSummary;
  nutrition: NutritionSummary;
  training: TrainingSummary;
  metrics: MetricsSummary;
  journal: JournalSummary;
}

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

/** Fetch full daily summary for a given date (YYYY-MM-DD). */
export function getDailySummary(date: string): Promise<DailySummary> {
  return apiFetch<DailySummary>(`/api/daily-summary/${date}`);
}
