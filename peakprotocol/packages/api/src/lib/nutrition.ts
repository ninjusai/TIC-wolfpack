/**
 * Nutrition calculation utilities for PeakProtocol (WRK-023).
 *
 * All cached food data is stored per 100g.  These helpers scale
 * values to an arbitrary serving size while preserving nulls.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface NutritionPer100g {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

export interface CalculatedNutrition extends NutritionPer100g {
  servingSize: number;
  servingUnit: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Scale a single per-100g value to the requested serving size.
 * Returns null when the base value is null.
 */
function scaleValue(per100g: number | null, servingSize: number): number | null {
  if (per100g === null) return null;
  // Round to 1 decimal place to avoid floating-point noise
  return Math.round((per100g / 100) * servingSize * 10) / 10;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Calculate nutrition for a given serving size.
 *
 * Base data is per 100g, so:
 *   actual = (cached_value / 100) * servingSize
 *
 * Null values in the source remain null in the result.
 */
export function calculateNutrition(
  per100g: NutritionPer100g,
  servingSize: number,
  servingUnit: string = "g",
): CalculatedNutrition {
  return {
    servingSize,
    servingUnit,
    calories: scaleValue(per100g.calories, servingSize),
    protein: scaleValue(per100g.protein, servingSize),
    carbs: scaleValue(per100g.carbs, servingSize),
    fat: scaleValue(per100g.fat, servingSize),
    fiber: scaleValue(per100g.fiber, servingSize),
  };
}
