/**
 * Saved foods API types and helpers (WRK-027).
 */
import { apiFetch } from "./api";
import { createFoodEntry } from "./food";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface SavedFood {
  id: string;
  name: string;
  fdcId: string | null;
  customServingSize: number | null;
  customServingUnit: string | null;
  isCustom: boolean;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  usageCount: number;
}

/* ------------------------------------------------------------------ */
/* API calls                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch saved foods sorted by usage count (most used first).
 */
export async function getSavedFoods(limit = 20): Promise<SavedFood[]> {
  const res = await apiFetch<{ foods: SavedFood[] }>(
    `/api/saved-foods?limit=${limit}`,
  );
  return res.foods ?? [];
}

/**
 * Increment the usage count for a saved food.
 */
async function incrementUsage(id: string): Promise<void> {
  await apiFetch<void>(`/api/saved-foods/${id}/use`, { method: "POST" });
}

/**
 * Quick-add a saved food: creates a food entry and increments usage count.
 */
export async function logQuickAdd(
  food: SavedFood,
  meal: string,
  date: string,
): Promise<void> {
  await createFoodEntry({
    date,
    meal,
    foodName: food.name,
    fdcId: food.fdcId ?? undefined,
    servingSize: food.customServingSize ?? undefined,
    servingUnit: food.customServingUnit ?? undefined,
    calories: food.calories ?? undefined,
    protein: food.protein ?? undefined,
    carbs: food.carbs ?? undefined,
    fat: food.fat ?? undefined,
    fiber: food.fiber ?? undefined,
  });
  await incrementUsage(food.id);
}
