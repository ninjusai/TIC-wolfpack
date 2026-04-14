/**
 * OpenFoodFacts API client (WRK-PP6-007).
 *
 * Searches the OpenFoodFacts database for foods and returns
 * normalised nutritional data matching the USDA client schema.
 * Uses the public search API with no authentication required.
 */

// ── Public Types ──────────────────────────────────────────────────────

export interface OFFFood {
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

// ── OFF API Response Types ───────────────────────────────────────────

interface OFFNutriments {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  nutriments?: OFFNutriments;
  serving_size?: string;
}

interface OFFSearchResponse {
  products: OFFProduct[];
  count: number;
  page: number;
  page_size: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Parse a serving_size string like "100g" or "250 ml" into a numeric value.
 * Returns null when the string is absent or unparseable.
 */
function parseServingSize(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract the unit from a serving_size string like "100g" or "250 ml".
 * Returns "g" as default when unparseable.
 */
function parseServingUnit(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/\d+(?:\.\d+)?\s*([a-zA-Z]+)/);
  return match ? match[1].toLowerCase() : "g";
}

/**
 * Map a raw OFF product to our normalised OFFFood shape.
 * Skips products without a name or barcode.
 */
function mapProduct(product: OFFProduct): OFFFood | null {
  if (!product.product_name || !product.code) return null;

  const n = product.nutriments;

  return {
    fdcId: `off:${product.code}`,
    name: product.product_name,
    servingSize: parseServingSize(product.serving_size),
    servingUnit: parseServingUnit(product.serving_size),
    calories: n?.["energy-kcal_100g"] ?? null,
    protein: n?.proteins_100g ?? null,
    carbs: n?.carbohydrates_100g ?? null,
    fat: n?.fat_100g ?? null,
    fiber: n?.fiber_100g ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────────────

const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const TIMEOUT_MS = 3000;

/**
 * Search foods via OpenFoodFacts API.
 *
 * Returns an empty array on any failure (network, parse, timeout)
 * so callers can degrade gracefully.
 */
export async function searchOFF(
  query: string,
  pageSize: number = 25,
): Promise<OFFFood[]> {
  try {
    const url = new URL(OFF_SEARCH_URL);
    url.searchParams.set("search_terms", query);
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", String(pageSize));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "User-Agent": "PeakProtocol/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.error(
          `[OFF] Search failed: ${String(res.status)} ${res.statusText}`,
        );
        return [];
      }

      const data = (await res.json()) as OFFSearchResponse;

      if (!Array.isArray(data.products)) {
        return [];
      }

      const foods: OFFFood[] = [];
      for (const product of data.products) {
        const mapped = mapProduct(product);
        if (mapped) {
          foods.push(mapped);
        }
      }

      return foods;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[OFF] Search error: ${message}`);
    return [];
  }
}
