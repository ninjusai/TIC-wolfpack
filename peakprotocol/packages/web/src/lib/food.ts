/**
 * Food logging API types and helpers (WRK-026).
 */
import { apiFetch } from "./api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface SearchFood {
  fdcId: string;
  name: string;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  source: string;
  calculated?: {
    servingSize: number;
    servingUnit: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
  };
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: string;
  foodName: string;
  fdcId: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  source: string | null;
  description: string | null;
  loggedAt: string;
}

/** Response shape from POST /api/foods/estimate */
export interface AIEstimationResponse {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: "ai";
  confidence: string;
  servingDescription: string;
}

/** Result from calculate-all batch resolution */
export interface CalculateAllResult {
  resolved: Array<{
    id: string;
    source: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }>;
  failed: Array<{ id: string; reason: string }>;
}

/** Data for manual macro override via PUT /api/food-entries/:id */
export interface ManualOverrideData {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/* ------------------------------------------------------------------ */
/* Date helpers (mirroring metrics pattern)                           */
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

/* ------------------------------------------------------------------ */
/* Meals                                                              */
/* ------------------------------------------------------------------ */

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

export async function searchFoods(
  query: string,
  limit = 20,
): Promise<SearchFood[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await apiFetch<{ foods: SearchFood[] }>(
    `/api/foods/search?${params}`,
  );
  return res.foods ?? [];
}

export interface CreateFoodEntryData {
  date: string;
  meal: string;
  foodName: string;
  fdcId?: string;
  servingSize?: number;
  servingUnit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  source?: string;
}

export async function createFoodEntry(
  data: CreateFoodEntryData,
): Promise<FoodEntry> {
  const res = await apiFetch<{ entry: FoodEntry }>("/api/food-entries", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.entry;
}

export async function getDailyEntries(
  date: string,
): Promise<{ entries: FoodEntry[]; totals: DailyTotals }> {
  const res = await apiFetch<{ entries: FoodEntry[]; totals: DailyTotals }>(
    `/api/food-entries?date=${date}`,
  );
  return { entries: res.entries ?? [], totals: res.totals };
}

export async function deleteFoodEntry(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/api/food-entries/${id}`, {
    method: "DELETE",
  });
}

/**
 * Create a text-only food entry with deferred macro calculation.
 * POST /api/food-entries/text
 */
export async function createTextFoodEntry(data: {
  date: string;
  meal: string;
  description: string;
}): Promise<FoodEntry> {
  const res = await apiFetch<{ entry: FoodEntry }>("/api/food-entries/text", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.entry;
}

/**
 * Batch resolve all unresolved food entries for a date.
 * POST /api/food-entries/calculate-all
 */
export async function calculateAllEntries(
  date: string,
): Promise<CalculateAllResult> {
  const res = await apiFetch<CalculateAllResult>(
    "/api/food-entries/calculate-all",
    {
      method: "POST",
      body: JSON.stringify({ date }),
    },
  );
  return res;
}

/**
 * Manual override of macro fields on a food entry.
 * PUT /api/food-entries/:id
 */
export async function updateFoodEntry(
  id: string,
  data: ManualOverrideData,
): Promise<FoodEntry> {
  const res = await apiFetch<{ entry: FoodEntry }>(
    `/api/food-entries/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
  return res.entry;
}

/**
 * AI-powered macro estimation for free-text food description.
 * POST /api/foods/estimate
 */
export async function estimateFood(
  description: string,
): Promise<AIEstimationResponse> {
  const res = await apiFetch<AIEstimationResponse>("/api/foods/estimate", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
  return res;
}

/* ------------------------------------------------------------------ */
/* Macro calculation helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Scale macros from per-100g base values to a given serving size.
 */
export function scaleMacros(
  food: SearchFood,
  servingSize: number,
): { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null } {
  const scale = servingSize / 100;
  return {
    calories: food.calories != null ? Math.round(food.calories * scale) : null,
    protein: food.protein != null ? Math.round(food.protein * scale * 10) / 10 : null,
    carbs: food.carbs != null ? Math.round(food.carbs * scale * 10) / 10 : null,
    fat: food.fat != null ? Math.round(food.fat * scale * 10) / 10 : null,
    fiber: food.fiber != null ? Math.round(food.fiber * scale * 10) / 10 : null,
  };
}
