/**
 * Saved foods library routes for PeakProtocol (WRK-025).
 *
 * Allows users to save frequently-used foods for quick logging.
 * Foods are sorted by usage_count DESC so most-used appear first.
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1 for saved_foods. */
interface SavedFoodRow {
  id: string;
  name: string;
  fdc_id: string | null;
  custom_serving_size: number | null;
  custom_serving_unit: string | null;
  is_custom: number;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  usage_count: number;
}

/** API-facing camelCase representation. */
interface SavedFood {
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

// ── Helpers ───────────────────────────────────────────────────────────

function rowToSavedFood(row: SavedFoodRow): SavedFood {
  return {
    id: row.id,
    name: row.name,
    fdcId: row.fdc_id,
    customServingSize: row.custom_serving_size,
    customServingUnit: row.custom_serving_unit,
    isCustom: row.is_custom === 1,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    usageCount: row.usage_count,
  };
}

// ── Zod Schemas ───────────────────────────────────────────────────────

const CreateSavedFoodSchema = z.object({
  name: z.string().min(1, "Name is required"),
  fdcId: z.string().optional(),
  customServingSize: z.number().positive().optional(),
  customServingUnit: z.string().optional(),
  isCustom: z.boolean().optional(),
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
});

const UpdateSavedFoodSchema = z.object({
  name: z.string().min(1).optional(),
  fdcId: z.string().optional(),
  customServingSize: z.number().positive().optional(),
  customServingUnit: z.string().optional(),
  isCustom: z.boolean().optional(),
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
});

const SearchQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ── Routes ────────────────────────────────────────────────────────────

export const savedFoodRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all saved food routes
savedFoodRoutes.use("*", requireSession);

/**
 * POST /api/saved-foods
 *
 * Save a food to the user's library for quick future logging.
 */
savedFoodRoutes.post("/", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = CreateSavedFoodSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO saved_foods (id, name, fdc_id, custom_serving_size, custom_serving_unit, is_custom, calories, protein, carbs, fat, fiber, usage_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).bind(
    id,
    data.name,
    data.fdcId ?? null,
    data.customServingSize ?? null,
    data.customServingUnit ?? null,
    data.isCustom ? 1 : 0,
    data.calories ?? null,
    data.protein ?? null,
    data.carbs ?? null,
    data.fat ?? null,
    data.fiber ?? null,
  ).run();

  const food: SavedFood = {
    id,
    name: data.name,
    fdcId: data.fdcId ?? null,
    customServingSize: data.customServingSize ?? null,
    customServingUnit: data.customServingUnit ?? null,
    isCustom: data.isCustom ?? false,
    calories: data.calories ?? null,
    protein: data.protein ?? null,
    carbs: data.carbs ?? null,
    fat: data.fat ?? null,
    fiber: data.fiber ?? null,
    usageCount: 0,
  };

  return c.json({ food }, 201);
});

/**
 * GET /api/saved-foods?search=chicken&limit=50
 *
 * List saved foods sorted by usage_count DESC (most used first).
 * Optional search filters by name LIKE.
 */
savedFoodRoutes.get("/", async (c) => {
  const raw = {
    search: c.req.query("search"),
    limit: c.req.query("limit"),
  };
  const parsed = SearchQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { search, limit } = parsed.data;

  let result;
  if (search) {
    // Escape LIKE special characters
    const escaped = search.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    result = await c.env.DB.prepare(
      `SELECT * FROM saved_foods WHERE name LIKE ? ESCAPE '\\' ORDER BY usage_count DESC LIMIT ?`,
    )
      .bind(`%${escaped}%`, limit)
      .all<SavedFoodRow>();
  } else {
    result = await c.env.DB.prepare(
      `SELECT * FROM saved_foods ORDER BY usage_count DESC LIMIT ?`,
    )
      .bind(limit)
      .all<SavedFoodRow>();
  }

  const foods = (result.results ?? []).map(rowToSavedFood);

  return c.json({ foods });
});

/**
 * PUT /api/saved-foods/:id
 *
 * Partial update of a saved food.
 */
savedFoodRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const rawBody: unknown = await c.req.json();
  const parsed = UpdateSavedFoodSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;

  // Build dynamic SET clause from provided fields
  const fieldMap: Record<string, unknown> = {
    name: data.name,
    fdc_id: data.fdcId,
    custom_serving_size: data.customServingSize,
    custom_serving_unit: data.customServingUnit,
    is_custom: data.isCustom !== undefined ? (data.isCustom ? 1 : 0) : undefined,
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    fiber: data.fiber,
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      setClauses.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (setClauses.length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE saved_foods SET ${setClauses.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  // Fetch updated row
  const row = await c.env.DB.prepare(
    "SELECT * FROM saved_foods WHERE id = ?",
  )
    .bind(id)
    .first<SavedFoodRow>();

  if (!row) {
    return c.json({ error: "Saved food not found" }, 404);
  }

  return c.json({ food: rowToSavedFood(row) });
});

/**
 * DELETE /api/saved-foods/:id
 *
 * Hard delete a saved food by ID.
 */
savedFoodRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM saved_foods WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Saved food not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM saved_foods WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ success: true });
});

/**
 * POST /api/saved-foods/:id/use
 *
 * Increment usage_count by 1. Called when user logs a food from saved list.
 */
savedFoodRoutes.post("/:id/use", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM saved_foods WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Saved food not found" }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE saved_foods SET usage_count = usage_count + 1 WHERE id = ?",
  )
    .bind(id)
    .run();

  const row = await c.env.DB.prepare(
    "SELECT * FROM saved_foods WHERE id = ?",
  )
    .bind(id)
    .first<SavedFoodRow>();

  if (!row) {
    return c.json({ error: "Saved food not found" }, 404);
  }

  return c.json({ food: rowToSavedFood(row) });
});
