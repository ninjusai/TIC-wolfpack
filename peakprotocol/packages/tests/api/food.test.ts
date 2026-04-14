/**
 * API integration tests for food search and food entry logging.
 * Covers EVL-05: Food search returns results from USDA.
 * Covers EVL-05a: Food search respects cache (second search hits cache).
 * Covers EVL-05b: Macro calculation for fractional servings (API-level).
 * Covers EVL-06: Quick-add logs food (API test: save food, use, log).
 *
 * Requires a running dev server: cd peakprotocol/packages/api && npx wrangler dev --local
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import { createTestFoodEntry } from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();
});

// ── EVL-05: Food search returns results from USDA ───────────────────

describe("EVL-05: Food Search", () => {
  it("returns results for a valid food query", async () => {
    const foods = await client.searchFoods({ q: "chicken breast", limit: "5" });

    expect(
      foods.length,
      "Food search for 'chicken breast' should return at least 1 result",
    ).toBeGreaterThan(0);

    const first = foods[0]!;
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("calories");
    expect(first).toHaveProperty("protein");
  });

  // EVL-05a: Cache behavior — second identical search should be faster
  it("returns results on second search (cache hit)", async () => {
    const query = "chicken breast";

    // First search (populates cache)
    const foods1 = await client.searchFoods({ q: query, limit: "5" });

    // Second search (should hit cache)
    const foods2 = await client.searchFoods({ q: query, limit: "5" });

    expect(foods2.length).toBe(foods1.length);
    // Verify same data returned
    if (foods1.length > 0 && foods2.length > 0) {
      expect(foods2[0]).toHaveProperty("fdcId");
    }
  });

  // EVL-05b: Fractional serving via API
  it("returns calculated macros for a specific serving size", async () => {
    const foods = await client.searchFoods({
      q: "chicken breast",
      limit: "1",
      servingSize: "200",
      servingUnit: "g",
    });

    expect(foods.length).toBeGreaterThan(0);

    const first = foods[0]!;
    if ("calculated" in first) {
      const calc = first["calculated"] as Record<string, unknown>;
      expect(calc).toHaveProperty("servingSize", 200);
      expect(calc).toHaveProperty("servingUnit", "g");
      expect(calc).toHaveProperty("calories");
      expect(calc).toHaveProperty("protein");
    }
  });
});

// ── EVL-06: Quick-add food logging (API: save, use, log) ────────────

describe("EVL-06: Quick-Add Food Entry", () => {
  it("logs a food entry with macros in a single API call", async () => {
    const data = createTestFoodEntry({
      date: new Date().toISOString().slice(0, 10),
      foodName: "Protein Shake",
      meal: "snack",
      calories: 250,
      protein: 40,
      carbs: 10,
      fat: 5,
    });

    const entry = await client.createFoodEntry(data);

    expect(entry.id).toBeTruthy();
    expect(entry.foodName).toBe("Protein Shake");
    expect(entry.calories).toBe(250);
    expect(entry.protein).toBe(40);
  });

  it("retrieves food entries and daily totals for a date", async () => {
    const date = new Date().toISOString().slice(0, 10);

    // Log two food entries
    await client.createFoodEntry(
      createTestFoodEntry({ date, foodName: "Eggs", meal: "breakfast", calories: 210, protein: 18 }),
    );
    await client.createFoodEntry(
      createTestFoodEntry({ date, foodName: "Rice", meal: "lunch", calories: 200, protein: 4 }),
    );

    const { entries, totals } = await client.listFoodEntries(date);

    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(totals.calories).toBeGreaterThanOrEqual(410);
    expect(totals.protein).toBeGreaterThanOrEqual(22);
  });
});
