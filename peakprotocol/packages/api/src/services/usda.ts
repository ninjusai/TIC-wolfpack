/**
 * USDA FoodData Central API client (WRK-021).
 *
 * Searches the USDA FoodData Central database for foods and returns
 * normalised nutritional data. Uses Foundation and SR Legacy data types
 * for high-quality, unbranded food entries.
 */

// ── Public Types ──────────────────────────────────────────────────────

export interface USDAFood {
  fdcId: string;
  name: string;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

// ── USDA API Response Types ───────────────────────────────────────────

interface USDAFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface USDASearchFoodItem {
  fdcId: number;
  description: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: USDAFoodNutrient[];
}

interface USDASearchResponse {
  foods: USDASearchFoodItem[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

interface USDASearchRequestBody {
  query: string;
  pageSize: number;
  dataType: string[];
}

// ── Nutrient ID Constants ─────────────────────────────────────────────

const NUTRIENT_ENERGY = 1008;
const NUTRIENT_PROTEIN = 1003;
const NUTRIENT_FAT = 1004;
const NUTRIENT_CARBS = 1005;
const NUTRIENT_FIBER = 1079;

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Extract a nutrient value by its USDA nutrient ID.
 * Returns null when the nutrient is absent from the food item.
 */
function extractNutrient(
  nutrients: USDAFoodNutrient[],
  nutrientId: number,
): number | null {
  const match = nutrients.find((n) => n.nutrientId === nutrientId);
  return match !== undefined ? match.value : null;
}

/**
 * Map a raw USDA search result item to our normalised USDAFood shape.
 */
function mapFoodItem(item: USDASearchFoodItem): USDAFood {
  return {
    fdcId: String(item.fdcId),
    name: item.description,
    servingSize: item.servingSize ?? null,
    servingUnit: item.servingSizeUnit ?? null,
    calories: extractNutrient(item.foodNutrients, NUTRIENT_ENERGY),
    protein: extractNutrient(item.foodNutrients, NUTRIENT_PROTEIN),
    carbs: extractNutrient(item.foodNutrients, NUTRIENT_CARBS),
    fat: extractNutrient(item.foodNutrients, NUTRIENT_FAT),
    fiber: extractNutrient(item.foodNutrients, NUTRIENT_FIBER),
  };
}

// ── Retry Wrapper ─────────────────────────────────────────────────────

/**
 * Simple retry wrapper: retries once on 429 (after 1 s delay) or network
 * error. Max 2 total attempts.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.status === 429 && attempt === 0) {
        // Rate-limited — wait 1 s and retry once
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      return res;
    } catch (err: unknown) {
      lastError = err;
      if (attempt === 0) {
        // Network error — wait 1 s and retry once
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
    }
  }

  throw lastError;
}

// ── Public API ────────────────────────────────────────────────────────

const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

/**
 * Search foods via USDA FoodData Central API.
 *
 * Returns an empty array on any failure (network, parse, rate-limit
 * after retry) so callers can degrade gracefully.
 */
export async function searchUSDA(
  apiKey: string,
  query: string,
  pageSize: number = 25,
): Promise<USDAFood[]> {
  try {
    const body: USDASearchRequestBody = {
      query,
      pageSize,
      dataType: ["Foundation", "SR Legacy"],
    };

    const res = await fetchWithRetry(USDA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(
        `[USDA] Search failed: ${String(res.status)} ${res.statusText}`,
      );
      return [];
    }

    const data = (await res.json()) as USDASearchResponse;

    if (!Array.isArray(data.foods)) {
      return [];
    }

    return data.foods.map(mapFoodItem);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[USDA] Search error: ${message}`);
    return [];
  }
}
