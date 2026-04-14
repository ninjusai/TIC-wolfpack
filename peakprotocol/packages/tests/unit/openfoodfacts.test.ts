/**
 * Unit tests for OpenFoodFacts client response normalization.
 *
 * Covers:
 * - EVL-P6-07: OpenFoodFacts client normalizes response correctly
 * - EVL-P6-06b: Graceful degradation when OFF API is unreachable (negative)
 *
 * These tests validate the pure mapping/normalization logic from the
 * openfoodfacts service. No server required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchOFF, type OFFFood } from "@api/services/openfoodfacts";

// ── Mock fetch for deterministic tests ──────────────────────────────

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── EVL-P6-07: OFF response normalization ───────────────────────────

describe("EVL-P6-07: OpenFoodFacts Client Normalizes Response Correctly", () => {
  it("maps OFF API products to normalised OFFFood shape", async () => {
    const mockResponse = {
      products: [
        {
          code: "5449000000996",
          product_name: "Coca-Cola",
          serving_size: "330ml",
          nutriments: {
            "energy-kcal_100g": 42,
            proteins_100g: 0,
            carbohydrates_100g: 10.6,
            fat_100g: 0,
            fiber_100g: 0,
          },
        },
        {
          code: "3017620422003",
          product_name: "Nutella",
          serving_size: "15g",
          nutriments: {
            "energy-kcal_100g": 539,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
            fiber_100g: 3.4,
          },
        },
      ],
      count: 2,
      page: 1,
      page_size: 25,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const results = await searchOFF("Coca-Cola");

    expect(results.length, "Should return 2 normalised results").toBe(2);

    const coke = results[0]!;
    expect(coke.fdcId, "fdcId should be prefixed with 'off:'").toBe("off:5449000000996");
    expect(coke.name, "Name should be mapped from product_name").toBe("Coca-Cola");
    expect(coke.calories, "Calories should come from energy-kcal_100g").toBe(42);
    expect(coke.protein, "Protein should come from proteins_100g").toBe(0);
    expect(coke.carbs, "Carbs should come from carbohydrates_100g").toBe(10.6);
    expect(coke.fat, "Fat should come from fat_100g").toBe(0);
    expect(coke.fiber, "Fiber should come from fiber_100g").toBe(0);
    expect(coke.servingSize, "Serving size should be parsed from '330ml'").toBe(330);
    expect(coke.servingUnit, "Serving unit should be parsed from '330ml'").toBe("ml");
  });

  it("skips products without product_name or code", async () => {
    const mockResponse = {
      products: [
        { code: "123", product_name: null, nutriments: {} },
        { code: null, product_name: "Unknown", nutriments: {} },
        { code: "456", product_name: "Valid Product", nutriments: { "energy-kcal_100g": 100 } },
      ],
      count: 3,
      page: 1,
      page_size: 25,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const results = await searchOFF("test");

    expect(
      results.length,
      "Should skip products without name or code, returning only the valid one",
    ).toBe(1);

    expect(results[0]?.name, "Valid product should be in results").toBe("Valid Product");
  });

  it("handles missing nutriment values as null", async () => {
    const mockResponse = {
      products: [
        {
          code: "999",
          product_name: "Sparse Product",
          nutriments: {
            // Only calories present, rest missing
            "energy-kcal_100g": 50,
          },
        },
      ],
      count: 1,
      page: 1,
      page_size: 25,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const results = await searchOFF("sparse");

    expect(results.length).toBe(1);
    const food = results[0]!;
    expect(food.calories, "Calories should be 50").toBe(50);
    expect(food.protein, "Protein should be null when missing").toBeNull();
    expect(food.carbs, "Carbs should be null when missing").toBeNull();
    expect(food.fat, "Fat should be null when missing").toBeNull();
    expect(food.fiber, "Fiber should be null when missing").toBeNull();
  });
});

// ── EVL-P6-06b: OFF API failure graceful degradation ────────────────

describe("EVL-P6-06b: OFF API Failure Graceful Degradation", () => {
  it("returns empty array on network error (no crash, no unhandled rejection)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network unreachable"));

    const results = await searchOFF("chicken breast");

    expect(
      results,
      "Should return empty array on network failure, not throw",
    ).toEqual([]);
  });

  it("returns empty array on HTTP error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const results = await searchOFF("test");

    expect(
      results,
      "Should return empty array on 500 error, not throw",
    ).toEqual([]);
  });

  it("returns empty array on timeout (abort signal)", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error("The operation was aborted")), 50);
      });
    });

    const results = await searchOFF("test");

    expect(
      results,
      "Should return empty array on timeout, not throw",
    ).toEqual([]);
  });

  it("returns empty array when response has no products array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0, page: 1 }),
    } as unknown as Response);

    const results = await searchOFF("nothing");

    expect(
      results,
      "Should return empty array when products is not an array",
    ).toEqual([]);
  });
});
