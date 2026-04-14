/**
 * Food search routes for PeakProtocol (WRK-021 / WRK-022 / WRK-023 / WRK-PP6-009).
 *
 * Provides search and lookup endpoints backed by the D1 food cache
 * with USDA FoodData Central API fallback, plus AI macro estimation.
 * All routes require an authenticated session.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { calculateNutrition } from "../lib/nutrition";
import { requireSession } from "../middleware/session";
import {
  getCachedFood,
  searchFoodsWithCache,
  type CachedFood,
} from "../services/food-cache";
import { estimateMacros } from "../services/ai-estimation";

// ── Zod Schemas ───────────────────────────────────────────────────────

const FoodSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  servingSize: z.coerce.number().positive().optional(),
  servingUnit: z.string().min(1).optional().default("g"),
});

const FdcIdParamSchema = z.object({
  fdcId: z.string().min(1, "FDC ID is required"),
});

const EstimateBodySchema = z.object({
  description: z.string().min(1, "Description is required"),
});

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Build a food response object, optionally including calculated macros
 * for the requested serving size.
 */
function buildFoodResponse(
  food: CachedFood,
  servingSize?: number,
  servingUnit?: string,
) {
  const base = {
    fdcId: food.fdcId,
    name: food.name,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    source: food.source,
  };

  if (servingSize === undefined) return base;

  return {
    ...base,
    calculated: calculateNutrition(
      {
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
      },
      servingSize,
      servingUnit,
    ),
  };
}

// ── Routes ────────────────────────────────────────────────────────────

export const foodRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all food routes
foodRoutes.use("*", requireSession);

/**
 * GET /api/foods/search?q=chicken&limit=10&servingSize=150&servingUnit=g
 *
 * Search USDA FoodData Central for foods matching the query string.
 * Returns normalised nutritional data per food item.
 *
 * When `servingSize` is provided, each result includes a `calculated`
 * object with macros scaled from the per-100g base values.
 */
foodRoutes.get("/search", async (c) => {
  const raw = {
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    servingSize: c.req.query("servingSize"),
    servingUnit: c.req.query("servingUnit"),
  };

  const parsed = FoodSearchQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const { q, limit, servingSize, servingUnit } = parsed.data;
  const foods = await searchFoodsWithCache(c.env.DB, c.env.USDA_API_KEY, q, limit);

  return c.json({
    foods: foods.map((f) => buildFoodResponse(f, servingSize, servingUnit)),
  });
});

/**
 * POST /api/foods/estimate (WRK-PP6-009)
 *
 * AI-powered macro estimation for free-text food descriptions.
 * Uses Anthropic Claude (Haiku-class) to estimate nutritional content.
 */
foodRoutes.post("/estimate", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = EstimateBodySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { description } = parsed.data;
  const result = await estimateMacros(c.env.ANTHROPIC_API_KEY, description);

  if (!result.ok) {
    switch (result.error.type) {
      case "not_configured":
        return c.json({ error: "AI estimation not configured" }, 503);
      case "api_error":
        return c.json({ error: "AI estimation temporarily unavailable" }, 502);
      case "invalid_response":
        return c.json({ error: "AI estimation temporarily unavailable" }, 502);
    }
  }

  return c.json({
    calories: result.data.calories,
    protein: result.data.protein,
    carbs: result.data.carbs,
    fat: result.data.fat,
    fiber: result.data.fiber,
    source: "ai",
    confidence: "estimated",
    servingDescription: result.data.servingDescription,
  });
});

/**
 * GET /api/foods/:fdcId
 *
 * Look up a specific food by its FDC ID from the local cache.
 * Returns 404 if the food is not cached.
 */
foodRoutes.get("/:fdcId", async (c) => {
  const paramParsed = FdcIdParamSchema.safeParse({ fdcId: c.req.param("fdcId") });

  if (!paramParsed.success) {
    return c.json(
      {
        error: "Invalid FDC ID",
        details: paramParsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const { fdcId } = paramParsed.data;
  const food = await getCachedFood(c.env.DB, fdcId);

  if (!food) {
    return c.json({ error: "Food not found" }, 404);
  }

  return c.json({ food });
});
