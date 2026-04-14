/**
 * Dose titration routes for PeakProtocol (WRK-014).
 *
 * Tracks dose change history for supplements. History records are immutable —
 * they are never updated or deleted once created.
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1 for dose_history. */
interface DoseChangeRow {
  id: string;
  supplement_id: string;
  dose: string | null;
  unit: string | null;
  changed_at: string;
  notes: string | null;
}

/** API-facing camelCase representation. */
interface DoseChange {
  id: string;
  supplementId: string;
  dose: string | null;
  unit: string | null;
  changedAt: string;
  notes: string | null;
}

/** Minimal supplement row for existence check + current dose. */
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
  created_at: string;
  updated_at: string;
}

/** API-facing supplement shape (matches supplements.ts). */
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
  createdAt: string;
  updatedAt: string;
}

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDoseChange(row: DoseChangeRow): DoseChange {
  return {
    id: row.id,
    supplementId: row.supplement_id,
    dose: row.dose,
    unit: row.unit,
    changedAt: row.changed_at,
    notes: row.notes,
  };
}

// ── Zod Schemas ────────────────────────────────────────────────────────

const ChangeDoseSchema = z.object({
  dose: z.string(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Routes ─────────────────────────────────────────────────────────────

export const doseRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all dose routes
doseRoutes.use("*", requireSession);

/**
 * POST /api/supplements/:id/dose
 *
 * Change the dose for a supplement. Records the current dose in
 * dose_history (immutable) and updates the supplement's current dose.
 * Uses DB.batch() for atomicity.
 */
doseRoutes.post("/:id/dose", async (c) => {
  const supplementId = c.req.param("id");

  // 1. Validate supplement exists
  const existing = await c.env.DB.prepare(
    "SELECT * FROM supplements WHERE id = ?",
  )
    .bind(supplementId)
    .first<SupplementRow>();

  if (!existing) {
    return c.json({ error: "Supplement not found" }, 404);
  }

  // 2. Validate request body
  const rawBody: unknown = await c.req.json();
  const parsed = ChangeDoseSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const historyId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 3. Record current dose in history (immutable snapshot) + update supplement
  const insertHistory = c.env.DB.prepare(
    `INSERT INTO dose_history (id, supplement_id, dose, unit, changed_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    historyId,
    supplementId,
    existing.current_dose,
    existing.unit,
    now,
    data.notes ?? null,
  );

  const updateSupplement = c.env.DB.prepare(
    `UPDATE supplements SET current_dose = ?, unit = ?, updated_at = ? WHERE id = ?`,
  ).bind(
    data.dose,
    data.unit ?? existing.unit,
    now,
    supplementId,
  );

  await c.env.DB.batch([insertHistory, updateSupplement]);

  // 4. Fetch updated records for response
  const [updatedRow, historyRow] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM supplements WHERE id = ?")
      .bind(supplementId)
      .first<SupplementRow>(),
    c.env.DB.prepare("SELECT * FROM dose_history WHERE id = ?")
      .bind(historyId)
      .first<DoseChangeRow>(),
  ]);

  if (!updatedRow || !historyRow) {
    return c.json({ error: "Failed to retrieve dose change result" }, 500);
  }

  return c.json(
    {
      doseChange: rowToDoseChange(historyRow),
      supplement: rowToSupplement(updatedRow),
    },
    201,
  );
});

/**
 * GET /api/supplements/:id/dose-history
 *
 * Returns paginated dose change history for a supplement, ordered by
 * changed_at DESC (most recent first).
 */
doseRoutes.get("/:id/dose-history", async (c) => {
  const supplementId = c.req.param("id");

  // Validate supplement exists
  const existing = await c.env.DB.prepare(
    "SELECT id FROM supplements WHERE id = ?",
  )
    .bind(supplementId)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Supplement not found" }, 404);
  }

  // Parse query params
  const queryParsed = HistoryQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  if (!queryParsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: queryParsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { limit, offset } = queryParsed.data;

  // Fetch total count and paginated results in parallel
  const [countResult, historyResult] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM dose_history WHERE supplement_id = ?",
    )
      .bind(supplementId)
      .first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT * FROM dose_history
       WHERE supplement_id = ?
       ORDER BY changed_at DESC
       LIMIT ? OFFSET ?`,
    )
      .bind(supplementId, limit, offset)
      .all<DoseChangeRow>(),
  ]);

  const total = countResult?.total ?? 0;
  const history = (historyResult.results ?? []).map(rowToDoseChange);

  return c.json({ history, total });
});
