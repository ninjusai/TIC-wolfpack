/**
 * Food entry logging routes for PeakProtocol (WRK-024 / WRK-PP6-010 / WRK-PP6-011 / WRK-PP6-012).
 *
 * Tracks daily food intake with macro totals per date.
 * Includes text-only entry, batch calculation, and manual override.
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";
import { findBestMatch } from "../services/food-cache";
import { estimateMacros } from "../services/ai-estimation";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1 for food_entries. */
interface FoodEntryRow {
  id: string;
  date: string;
  meal: string;
  food_name: string;
  fdc_id: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  source: string | null;
  description: string | null;
  logged_at: string;
}

/** API-facing camelCase representation. */
interface FoodEntry {
  id: string;
  date: string;
  meal: string;
  foodName: string;
  fdcId: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  source: string | null;
  description: string | null;
  loggedAt: string;
}

/** Daily macro totals. */
interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

function rowToFoodEntry(row: FoodEntryRow): FoodEntry {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    foodName: row.food_name,
    fdcId: row.fdc_id,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    source: row.source ?? null,
    description: row.description ?? null,
    loggedAt: row.logged_at,
  };
}

/** Meal ordering for display: breakfast -> lunch -> dinner -> snack. */
const MEAL_ORDER: Record<string, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

function calculateTotals(entries: FoodEntry[]): DailyTotals {
  return entries.reduce<DailyTotals>(
    (totals, entry) => ({
      calories: totals.calories + (entry.calories ?? 0),
      protein: totals.protein + (entry.protein ?? 0),
      carbs: totals.carbs + (entry.carbs ?? 0),
      fat: totals.fat + (entry.fat ?? 0),
      fiber: totals.fiber + (entry.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

// ── Zod Schemas ───────────────────────────────────────────────────────

const CreateFoodEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  foodName: z.string().min(1, "Food name is required"),
  fdcId: z.string().optional(),
  servingSize: z.number().positive().optional(),
  servingUnit: z.string().optional(),
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  source: z.string().optional(),
});

const DateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

const TextFoodEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  description: z.string().min(1, "Description is required"),
});

const CalculateAllSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

const ManualOverrideSchema = z.object({
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────

export const foodEntryRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all food entry routes
foodEntryRoutes.use("*", requireSession);

/**
 * POST /api/food-entries
 *
 * Log a new food entry. Generates a UUID and sets logged_at to now.
 */
foodEntryRoutes.post("/", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = CreateFoodEntrySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const id = crypto.randomUUID();
  const loggedAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO food_entries (id, date, meal, food_name, fdc_id, serving_size, serving_unit, calories, protein, carbs, fat, fiber, source, description, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    data.date,
    data.meal,
    data.foodName,
    data.fdcId ?? null,
    data.servingSize ?? null,
    data.servingUnit ?? null,
    data.calories ?? null,
    data.protein ?? null,
    data.carbs ?? null,
    data.fat ?? null,
    data.fiber ?? null,
    data.source ?? null,
    null,
    loggedAt,
  ).run();

  const entry: FoodEntry = {
    id,
    date: data.date,
    meal: data.meal,
    foodName: data.foodName,
    fdcId: data.fdcId ?? null,
    servingSize: data.servingSize ?? null,
    servingUnit: data.servingUnit ?? null,
    calories: data.calories ?? null,
    protein: data.protein ?? null,
    carbs: data.carbs ?? null,
    fat: data.fat ?? null,
    fiber: data.fiber ?? null,
    source: data.source ?? null,
    description: null,
    loggedAt,
  };

  return c.json({ entry }, 201);
});

/**
 * GET /api/food-entries?date=YYYY-MM-DD
 *
 * Returns all entries for a date ordered by meal then logged_at,
 * plus daily macro totals.
 */
foodEntryRoutes.get("/", async (c) => {
  const raw = { date: c.req.query("date") };
  const parsed = DateQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { date } = parsed.data;

  const result = await c.env.DB.prepare(
    `SELECT * FROM food_entries WHERE date = ? ORDER BY logged_at ASC`,
  )
    .bind(date)
    .all<FoodEntryRow>();

  const entries = (result.results ?? [])
    .map(rowToFoodEntry)
    .sort((a, b) => {
      const mealDiff = (MEAL_ORDER[a.meal] ?? 99) - (MEAL_ORDER[b.meal] ?? 99);
      if (mealDiff !== 0) return mealDiff;
      return a.loggedAt.localeCompare(b.loggedAt);
    });

  const totals = calculateTotals(entries);

  return c.json({ entries, totals });
});

/**
 * POST /api/food-entries/text (WRK-PP6-010)
 *
 * Create a text-only food entry with deferred macro calculation.
 * Entry is created with NULL macros and NULL source.
 */
foodEntryRoutes.post("/text", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = TextFoodEntrySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const id = crypto.randomUUID();
  const loggedAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO food_entries (id, date, meal, food_name, fdc_id, serving_size, serving_unit, calories, protein, carbs, fat, fiber, source, description, logged_at)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
  ).bind(
    id,
    data.date,
    data.meal,
    data.description,
    data.description,
    loggedAt,
  ).run();

  const entry: FoodEntry = {
    id,
    date: data.date,
    meal: data.meal,
    foodName: data.description,
    fdcId: null,
    servingSize: null,
    servingUnit: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
    source: null,
    description: data.description,
    loggedAt,
  };

  return c.json({ entry }, 201);
});

/**
 * POST /api/food-entries/calculate-all (WRK-PP6-011)
 *
 * Batch resolve all unresolved food entries for a date.
 * Sequential processing per DEC-phase6-007.
 * Resolution priority: USDA cache/API -> OFF -> AI estimation.
 */
foodEntryRoutes.post("/calculate-all", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = CalculateAllSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { date } = parsed.data;

  // Find all entries with NULL calories for the given date
  const result = await c.env.DB.prepare(
    "SELECT * FROM food_entries WHERE date = ? AND calories IS NULL",
  )
    .bind(date)
    .all<FoodEntryRow>();

  const unresolvedRows = result.results ?? [];

  if (unresolvedRows.length === 0) {
    return c.json({ resolved: [], failed: [] });
  }

  const resolved: Array<{
    id: string;
    source: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }> = [];

  const failed: Array<{ id: string; reason: string }> = [];

  // Process sequentially per DEC-phase6-007
  for (const row of unresolvedRows) {
    const searchTerm = row.description ?? row.food_name;

    try {
      // Step 1: Try USDA cache/API + OFF (via findBestMatch which uses multi-source search)
      const match = await findBestMatch(c.env.DB, c.env.USDA_API_KEY, searchTerm);

      if (match && match.calories !== null) {
        // Found a match from USDA or OFF
        await c.env.DB.prepare(
          `UPDATE food_entries SET calories = ?, protein = ?, carbs = ?, fat = ?, fiber = ?, source = ? WHERE id = ?`,
        ).bind(
          match.calories,
          match.protein,
          match.carbs,
          match.fat,
          match.fiber,
          match.source,
          row.id,
        ).run();

        resolved.push({
          id: row.id,
          source: match.source,
          calories: match.calories ?? 0,
          protein: match.protein ?? 0,
          carbs: match.carbs ?? 0,
          fat: match.fat ?? 0,
          fiber: match.fiber ?? 0,
        });
        continue;
      }

      // Step 2: Try AI estimation
      const estimation = await estimateMacros(c.env.ANTHROPIC_API_KEY, searchTerm);

      if (estimation.ok) {
        const { data } = estimation;
        await c.env.DB.prepare(
          `UPDATE food_entries SET calories = ?, protein = ?, carbs = ?, fat = ?, fiber = ?, source = ? WHERE id = ?`,
        ).bind(
          data.calories,
          data.protein,
          data.carbs,
          data.fat,
          data.fiber,
          "ai",
          row.id,
        ).run();

        resolved.push({
          id: row.id,
          source: "ai",
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          fiber: data.fiber,
        });
        continue;
      }

      // All methods failed
      const reason = estimation.error.type === "not_configured"
        ? "No match found and AI estimation not configured"
        : "No match found and AI estimation failed";
      failed.push({ id: row.id, reason });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ id: row.id, reason: `Processing error: ${message}` });
    }
  }

  return c.json({ resolved, failed });
});

/**
 * GET /api/food-entries/:id
 *
 * Single entry lookup by ID.
 */
foodEntryRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const row = await c.env.DB.prepare(
    "SELECT * FROM food_entries WHERE id = ?",
  )
    .bind(id)
    .first<FoodEntryRow>();

  if (!row) {
    return c.json({ error: "Food entry not found" }, 404);
  }

  return c.json({ entry: rowToFoodEntry(row) });
});

/**
 * PUT /api/food-entries/:id (WRK-PP6-012)
 *
 * Manual override of macro fields on a food entry.
 * Updates specified fields, sets source = "manual", preserves unspecified fields.
 */
foodEntryRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const rawBody: unknown = await c.req.json();
  const parsed = ManualOverrideSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  // Check existence
  const existing = await c.env.DB.prepare(
    "SELECT id FROM food_entries WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Food entry not found" }, 404);
  }

  const data = parsed.data;

  // Build dynamic SET clause for provided macro fields.
  // Safety: column names come from this hardcoded fieldMap (not user input),
  // so the dynamic SQL construction is not vulnerable to injection.
  const fieldMap: Record<string, number | undefined> = {
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    fiber: data.fiber,
  };

  const setClauses: string[] = ["source = ?"];
  const values: (string | number)[] = ["manual"];

  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      setClauses.push(`${col} = ?`);
      values.push(val);
    }
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE food_entries SET ${setClauses.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  // Fetch and return updated row
  const row = await c.env.DB.prepare(
    "SELECT * FROM food_entries WHERE id = ?",
  )
    .bind(id)
    .first<FoodEntryRow>();

  if (!row) {
    return c.json({ error: "Food entry not found" }, 404);
  }

  return c.json({ entry: rowToFoodEntry(row) });
});

/**
 * DELETE /api/food-entries/:id
 *
 * Delete a food entry by ID.
 */
foodEntryRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Check existence first
  const existing = await c.env.DB.prepare(
    "SELECT id FROM food_entries WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Food entry not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM food_entries WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ success: true });
});
