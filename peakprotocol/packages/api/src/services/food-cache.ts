/**
 * Food cache service for PeakProtocol (WRK-022 / WRK-PP6-008).
 *
 * Provides D1-backed caching of USDA FoodData Central and
 * OpenFoodFacts results to minimise external API calls.  Implements
 * a cache-first search pattern with multi-source parallel fetch.
 */

import { searchUSDA } from "./usda";
import { searchOFF } from "./openfoodfacts";

// ── Public Types ──────────────────────────────────────────────────────

export interface CachedFood {
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
  cachedAt: string;
}

// ── D1 Row Shape ─────────────────────────────────────────────────────

interface FoodCacheRow {
  fdc_id: string;
  name: string;
  serving_size: number | null;
  serving_unit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  source: string;
  cached_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Escape LIKE-special characters so they match literally. */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/** Map a D1 row to the public CachedFood shape. */
function rowToFood(row: FoodCacheRow): CachedFood {
  return {
    fdcId: row.fdc_id,
    name: row.name,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    source: row.source ?? "usda",
    cachedAt: row.cached_at,
  };
}

/** Default cache staleness threshold in days. */
const DEFAULT_MAX_AGE_DAYS = 90;

// ── Cache Operations ─────────────────────────────────────────────────

/**
 * Search the food_cache table by name using a LIKE query.
 * Returns up to `limit` results (default 25).
 */
export async function searchCache(
  db: D1Database,
  query: string,
  limit: number = 25,
): Promise<CachedFood[]> {
  const pattern = `%${escapeLike(query)}%`;
  const stmt = db
    .prepare(
      "SELECT * FROM food_cache WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT ?",
    )
    .bind(pattern, limit);

  const { results } = await stmt.all<FoodCacheRow>();
  return (results ?? []).map(rowToFood);
}

/**
 * Get a single cached food by its FDC ID.
 * Returns null when the entry does not exist.
 */
export async function getCachedFood(
  db: D1Database,
  fdcId: string,
): Promise<CachedFood | null> {
  const row = await db
    .prepare("SELECT * FROM food_cache WHERE fdc_id = ?")
    .bind(fdcId)
    .first<FoodCacheRow>();

  return row ? rowToFood(row) : null;
}

/** Generic food shape for caching (works for both USDA and OFF results). */
interface CacheableFood {
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

/**
 * Cache foods from API results (batch insert).
 *
 * Uses INSERT OR IGNORE so existing entries are never overwritten.
 * Batches in chunks of 45 rows to stay well under D1's bound-
 * parameter limit (each row binds 11 params → 45 * 11 = 495).
 */
export async function cacheFoods(
  db: D1Database,
  foods: CacheableFood[],
  source: string = "usda",
): Promise<void> {
  if (foods.length === 0) return;

  const now = new Date().toISOString();
  const CHUNK_SIZE = 45;

  for (let i = 0; i < foods.length; i += CHUNK_SIZE) {
    const chunk = foods.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const sql = `INSERT OR IGNORE INTO food_cache (fdc_id, name, serving_size, serving_unit, calories, protein, carbs, fat, fiber, source, cached_at) VALUES ${placeholders}`;

    const bindings: (string | number | null)[] = [];
    for (const f of chunk) {
      bindings.push(
        f.fdcId,
        f.name,
        f.servingSize,
        f.servingUnit,
        f.calories,
        f.protein,
        f.carbs,
        f.fat,
        f.fiber,
        source,
        now,
      );
    }

    await db.prepare(sql).bind(...bindings).run();
  }
}

/**
 * Check whether a cache entry is stale (older than `maxAgeDays`).
 * Defaults to 90 days.
 */
export function isCacheStale(
  cachedAt: string,
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
): boolean {
  const cachedDate = new Date(cachedAt).getTime();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return cachedDate < cutoff;
}

/**
 * Purge cache entries older than `maxAgeDays` (default 90).
 * Returns the number of rows deleted.
 */
export async function purgeStaleCache(
  db: D1Database,
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const result = await db
    .prepare("DELETE FROM food_cache WHERE cached_at < ?")
    .bind(cutoff)
    .run();

  return result.meta.changes ?? 0;
}

// ── Name Similarity ──────────────────────────────────────────────────

/**
 * Simple name similarity check for deduplication.
 * Returns true if the normalised names are identical.
 */
function namesAreSimilar(a: string, b: string): boolean {
  const normalise = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalise(a) === normalise(b);
}

// ── Cache-First Search ───────────────────────────────────────────────

/**
 * Search local D1 cache first, fall back to USDA API for misses.
 *
 * 1. Query D1 cache with LIKE
 * 2. If enough results (>= limit), return cache hits
 * 3. Otherwise call USDA API
 * 4. Cache the API results in D1
 * 5. Merge cache + API results, deduplicate by fdcId
 * 6. Return merged results (up to limit)
 */
export async function searchFoodsWithCache(
  db: D1Database,
  apiKey: string,
  query: string,
  limit: number = 25,
): Promise<CachedFood[]> {
  // Step 1 — check cache
  const cached = await searchCache(db, query, limit);

  // Step 2 — if cache has enough results, return them
  if (cached.length >= limit) {
    return cached.slice(0, limit);
  }

  // Step 3 — fetch from USDA and OpenFoodFacts in parallel
  const [usdaResults, offResults] = await Promise.all([
    searchUSDA(apiKey, query, limit),
    searchOFF(query, limit),
  ]);

  // Step 4 — persist API results for next time
  if (usdaResults.length > 0) {
    await cacheFoods(db, usdaResults, "usda");
  }
  if (offResults.length > 0) {
    await cacheFoods(db, offResults, "off");
  }

  // Step 5 — merge: cached first, then USDA, then OFF, deduplicate
  const seen = new Set<string>(cached.map((f) => f.fdcId));
  const seenNames: string[] = cached.map((f) => f.name);
  const now = new Date().toISOString();

  const merged: CachedFood[] = [...cached];

  const addResults = (
    foods: CacheableFood[],
    source: string,
  ) => {
    for (const food of foods) {
      if (seen.has(food.fdcId)) continue;
      // Deduplicate by name similarity
      if (seenNames.some((n) => namesAreSimilar(n, food.name))) continue;
      seen.add(food.fdcId);
      seenNames.push(food.name);
      merged.push({
        fdcId: food.fdcId,
        name: food.name,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        source,
        cachedAt: now,
      });
    }
  };

  // USDA first, then OFF
  addResults(usdaResults, "usda");
  addResults(offResults, "off");

  // Step 6 — trim to limit
  return merged.slice(0, limit);
}

/**
 * Search for a single food term, returning the best match from
 * USDA or OFF cache/API. Used by the calculate-all batch resolver.
 * Returns null if no match is found.
 */
export async function findBestMatch(
  db: D1Database,
  apiKey: string,
  query: string,
): Promise<CachedFood | null> {
  const results = await searchFoodsWithCache(db, apiKey, query, 1);
  return results.length > 0 ? results[0] : null;
}
