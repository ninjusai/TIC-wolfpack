/**
 * Unit tests for nutrition calculation utilities.
 * Covers EVL-05b: Macro calculation for fractional servings.
 *
 * Pure function tests — no server required.
 */
import { describe, it, expect } from "vitest";
import {
  calculateNutrition,
  type NutritionPer100g,
} from "@api/lib/nutrition";

// ── Test data ───────────────────────────────────────────────────────

/** USDA approximate values for cooked chicken breast per 100g. */
const CHICKEN_BREAST_PER_100G: NutritionPer100g = {
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
};

/** Rice per 100g (approximate). */
const RICE_PER_100G: NutritionPer100g = {
  calories: 130,
  protein: 2.7,
  carbs: 28,
  fat: 0.3,
  fiber: 0.4,
};

// ── EVL-05b: Fractional serving calculation ─────────────────────────

describe("EVL-05b: Macro Calculation for Fractional Servings", () => {
  it("scales 200g chicken breast correctly from per-100g base", () => {
    const result = calculateNutrition(CHICKEN_BREAST_PER_100G, 200, "g");

    expect(result.servingSize).toBe(200);
    expect(result.servingUnit).toBe("g");
    expect(result.calories).toBe(330);
    expect(result.protein).toBe(62);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(7.2);
  });

  it("scales 50g serving (half of 100g) correctly", () => {
    const result = calculateNutrition(RICE_PER_100G, 50, "g");

    expect(result.calories).toBe(65);
    expect(result.protein).toBe(1.4); // 2.7 / 100 * 50 = 1.35 -> rounds to 1.4
    expect(result.carbs).toBe(14);
    expect(result.fat).toBe(0.2);   // 0.3 / 100 * 50 = 0.15 -> rounds to 0.2
  });

  it("handles very small fractional serving (10g)", () => {
    const result = calculateNutrition(CHICKEN_BREAST_PER_100G, 10, "g");

    expect(result.calories).toBe(16.5);
    expect(result.protein).toBe(3.1);
  });

  it("handles zero serving size gracefully", () => {
    const result = calculateNutrition(CHICKEN_BREAST_PER_100G, 0, "g");

    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(0);
  });

  it("preserves null values regardless of serving size", () => {
    const partialData: NutritionPer100g = {
      calories: 100,
      protein: null,
      carbs: 20,
      fat: null,
      fiber: null,
    };

    const result = calculateNutrition(partialData, 200, "g");

    expect(result.calories).toBe(200);
    expect(result.protein).toBeNull();
    expect(result.carbs).toBe(40);
    expect(result.fat).toBeNull();
    expect(result.fiber).toBeNull();
  });

  it("uses default serving unit of 'g' when not specified", () => {
    const result = calculateNutrition(CHICKEN_BREAST_PER_100G, 100);

    expect(result.servingUnit).toBe("g");
    expect(result.calories).toBe(165);
  });

  it("large serving (500g) scales proportionally", () => {
    const result = calculateNutrition(CHICKEN_BREAST_PER_100G, 500, "g");

    expect(result.calories).toBe(825);
    expect(result.protein).toBe(155);
    expect(result.fat).toBe(18);
  });
});
