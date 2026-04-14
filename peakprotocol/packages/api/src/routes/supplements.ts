/**
 * Supplement CRUD routes for PeakProtocol (WRK-011).
 *
 * Manages the supplement catalog: create, read, update, soft-delete.
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1. */
interface SupplementRow {
  id: string;
  name: string;
  current_dose: string | null;
  unit: string | null;
  schedule_type: string | null;
  schedule_value: string | null;
  time_of_day: string | null;
  tags: string | null;
  active: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

/** API-facing camelCase representation. */
interface Supplement {
  id: string;
  name: string;
  currentDose: string | null;
  unit: string | null;
  scheduleType: string | null;
  scheduleValue: Record<string, unknown> | null;
  timeOfDay: string | null;
  tags: string[];
  active: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 16-color palette for supplement calendar dots (DEC-phase6-001).
 * Auto-assigned on creation; cycled if all colors are in use.
 */
export const SUPPLEMENT_PALETTE = [
  '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981', '#F97316',
  '#06B6D4', '#EC4899', '#84CC16', '#6366F1', '#14B8A6', '#F43F5E',
  '#A855F7', '#0EA5E9', '#D946EF', '#78716C',
] as const;

function rowToSupplement(row: SupplementRow): Supplement {
  return {
    id: row.id,
    name: row.name,
    currentDose: row.current_dose,
    unit: row.unit,
    scheduleType: row.schedule_type,
    scheduleValue: row.schedule_value
      ? (JSON.parse(row.schedule_value) as Record<string, unknown>)
      : null,
    timeOfDay: row.time_of_day,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    active: row.active === 1,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Zod Schemas ────────────────────────────────────────────────────────

const CreateSupplementSchema = z.object({
  name: z.string().min(1, "Name is required"),
  currentDose: z.string().optional(),
  unit: z.string().optional(),
  scheduleType: z
    .enum(["daily", "every_n_days", "weekly", "specific_days"])
    .optional(),
  scheduleValue: z.record(z.unknown()).optional(),
  timeOfDay: z.enum(["morning", "evening", "with_food", "anytime"]).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "color must be a hex color like #3B82F6").optional(),
});

const UpdateSupplementSchema = CreateSupplementSchema.partial();

// ── Helpers ───────────────────────────────────────────────────────────

/** Escape LIKE-special characters so they match literally. */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

// ── Routes ─────────────────────────────────────────────────────────────

export const supplementRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all supplement routes
supplementRoutes.use("*", requireSession);

/**
 * GET /api/supplements
 *
 * List supplements with optional filters.
 * Query params:
 *   - active: "true" | "false" — filter by active status
 *   - tag: string — filter supplements whose tags JSON array contains the value
 */
supplementRoutes.get("/", async (c) => {
  const activeParam = c.req.query("active");
  const tagParam = c.req.query("tag");

  let sql = "SELECT * FROM supplements";
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (activeParam !== undefined) {
    conditions.push("active = ?");
    bindings.push(activeParam === "true" ? 1 : 0);
  }

  if (tagParam) {
    conditions.push("tags LIKE ? ESCAPE '\\'");
    bindings.push(`%"${escapeLike(tagParam)}"%`);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY time_of_day, name";

  let stmt = c.env.DB.prepare(sql);
  if (bindings.length > 0) {
    stmt = stmt.bind(...bindings);
  }

  const { results } = await stmt.all<SupplementRow>();
  const allRows = results ?? [];

  // Lazy backfill: assign colors to any supplements with null color
  const usedColors = new Set(allRows.filter((r) => r.color).map((r) => r.color!));
  const backfillPromises: Promise<unknown>[] = [];

  for (const row of allRows) {
    if (!row.color) {
      const nextColor: string = SUPPLEMENT_PALETTE.find((clr) => !usedColors.has(clr))
        ?? SUPPLEMENT_PALETTE[0] ?? '#3B82F6';
      usedColors.add(nextColor);
      row.color = nextColor;

      // Persist to D1 (best-effort)
      backfillPromises.push(
        c.env.DB.prepare("UPDATE supplements SET color = ? WHERE id = ? AND color IS NULL")
          .bind(nextColor, row.id)
          .run()
          .catch(() => {
            // Deterministic fallback if persist fails
            let hash = 0;
            for (let i = 0; i < row.id.length; i++) {
              hash = ((hash << 5) - hash + row.id.charCodeAt(i)) | 0;
            }
            row.color = SUPPLEMENT_PALETTE[Math.abs(hash) % SUPPLEMENT_PALETTE.length] ?? '#3B82F6';
          }),
      );
    }
  }

  await Promise.all(backfillPromises);

  const supplements = allRows.map(rowToSupplement);

  return c.json({ supplements });
});

/**
 * POST /api/supplements
 *
 * Create a new supplement.
 */
supplementRoutes.post("/", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = CreateSupplementSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Auto-assign color from palette if not provided (DEC-phase6-001)
  let color = data.color ?? null;
  if (!color) {
    const { results: existingRows } = await c.env.DB.prepare(
      "SELECT color FROM supplements WHERE color IS NOT NULL",
    ).all<{ color: string }>();
    const usedColors = new Set((existingRows ?? []).map((r) => r.color));
    const nextColor = SUPPLEMENT_PALETTE.find((c) => !usedColors.has(c));
    // If all 16 are used, cycle back to the first palette color
    color = nextColor ?? SUPPLEMENT_PALETTE[0];
  }

  await c.env.DB.prepare(
    `INSERT INTO supplements
       (id, name, current_dose, unit, schedule_type, schedule_value, time_of_day, tags, active, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
    .bind(
      id,
      data.name,
      data.currentDose ?? null,
      data.unit ?? null,
      data.scheduleType ?? null,
      data.scheduleValue ? JSON.stringify(data.scheduleValue) : null,
      data.timeOfDay ?? null,
      data.tags ? JSON.stringify(data.tags) : null,
      color,
      now,
      now,
    )
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM supplements WHERE id = ?")
    .bind(id)
    .first<SupplementRow>();

  if (!row) {
    return c.json({ error: "Failed to create supplement" }, 500);
  }

  return c.json({ supplement: rowToSupplement(row) }, 201);
});

/**
 * GET /api/supplements/:id
 *
 * Retrieve a single supplement by ID.
 */
supplementRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const row = await c.env.DB.prepare("SELECT * FROM supplements WHERE id = ?")
    .bind(id)
    .first<SupplementRow>();

  if (!row) {
    return c.json({ error: "Supplement not found" }, 404);
  }

  // Lazy backfill: assign color if null
  if (!row.color) {
    const { results: existingRows } = await c.env.DB.prepare(
      "SELECT color FROM supplements WHERE color IS NOT NULL",
    ).all<{ color: string }>();
    const usedColors = new Set((existingRows ?? []).map((r) => r.color));
    const nextColor: string = SUPPLEMENT_PALETTE.find((clr) => !usedColors.has(clr))
      ?? SUPPLEMENT_PALETTE[0] ?? '#3B82F6';
    row.color = nextColor;

    // Persist (best-effort)
    try {
      await c.env.DB.prepare("UPDATE supplements SET color = ? WHERE id = ? AND color IS NULL")
        .bind(nextColor, row.id)
        .run();
    } catch {
      // Deterministic fallback
      let hash = 0;
      for (let i = 0; i < row.id.length; i++) {
        hash = ((hash << 5) - hash + row.id.charCodeAt(i)) | 0;
      }
      row.color = SUPPLEMENT_PALETTE[Math.abs(hash) % SUPPLEMENT_PALETTE.length] ?? '#3B82F6';
    }
  }

  return c.json({ supplement: rowToSupplement(row) });
});

/**
 * PUT /api/supplements/:id
 *
 * Partial update of a supplement. All fields optional.
 */
supplementRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");

  // Verify the supplement exists
  const existing = await c.env.DB.prepare(
    "SELECT id FROM supplements WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Supplement not found" }, 404);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = UpdateSupplementSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const now = new Date().toISOString();

  // Build dynamic SET clause from provided fields
  const setClauses: string[] = ["updated_at = ?"];
  const bindings: (string | number | null)[] = [now];

  if (data.name !== undefined) {
    setClauses.push("name = ?");
    bindings.push(data.name);
  }
  if (data.currentDose !== undefined) {
    setClauses.push("current_dose = ?");
    bindings.push(data.currentDose);
  }
  if (data.unit !== undefined) {
    setClauses.push("unit = ?");
    bindings.push(data.unit);
  }
  if (data.scheduleType !== undefined) {
    setClauses.push("schedule_type = ?");
    bindings.push(data.scheduleType);
  }
  if (data.scheduleValue !== undefined) {
    setClauses.push("schedule_value = ?");
    bindings.push(JSON.stringify(data.scheduleValue));
  }
  if (data.timeOfDay !== undefined) {
    setClauses.push("time_of_day = ?");
    bindings.push(data.timeOfDay);
  }
  if (data.tags !== undefined) {
    setClauses.push("tags = ?");
    bindings.push(JSON.stringify(data.tags));
  }
  if (data.color !== undefined) {
    setClauses.push("color = ?");
    bindings.push(data.color);
  }

  // id goes last for the WHERE clause
  bindings.push(id);

  await c.env.DB.prepare(
    `UPDATE supplements SET ${setClauses.join(", ")} WHERE id = ?`,
  )
    .bind(...bindings)
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM supplements WHERE id = ?")
    .bind(id)
    .first<SupplementRow>();

  if (!row) {
    return c.json({ error: "Failed to retrieve updated supplement" }, 500);
  }

  return c.json({ supplement: rowToSupplement(row) });
});

/**
 * DELETE /api/supplements/:id
 *
 * Soft-delete: sets active = 0 instead of removing the row.
 */
supplementRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM supplements WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Supplement not found" }, 404);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE supplements SET active = 0, updated_at = ? WHERE id = ?",
  )
    .bind(now, id)
    .run();

  return c.json({ success: true });
});
