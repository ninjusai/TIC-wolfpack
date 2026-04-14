/**
 * Batch supplement log route for PeakProtocol Phase 6 (WRK-PP6-006).
 *
 * POST /api/supplements/batch-log — marks multiple supplements as taken
 * for a given date in a single atomic D1 batch operation.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Zod Schema ────────────────────────────────────────────────────────

const BatchLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  supplementIds: z
    .array(z.string().min(1))
    .min(1, "At least one supplementId is required")
    .max(10, "Maximum 10 supplements per batch"),
});

// ── Routes ─────────────────────────────────────────────────────────────

export const batchLogRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

batchLogRoutes.use("*", requireSession);

/**
 * POST /api/supplements/batch-log
 *
 * Accepts { date, supplementIds } and inserts taken logs for each supplement
 * that does not already have a taken log for that date.
 * Uses D1 batch() for atomic multi-insert.
 */
batchLogRoutes.post("/batch-log", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = BatchLogSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { date, supplementIds } = parsed.data;

  // 1. Verify all supplement IDs exist
  // Build a parameterized IN clause
  const placeholders = supplementIds.map(() => "?").join(", ");
  const { results: existingSupps } = await c.env.DB.prepare(
    `SELECT id FROM supplements WHERE id IN (${placeholders})`,
  )
    .bind(...supplementIds)
    .all<{ id: string }>();

  const existingIds = new Set((existingSupps ?? []).map((r) => r.id));
  const missingIds = supplementIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    return c.json(
      { error: "Supplements not found", missingIds },
      404,
    );
  }

  // 2. Check for existing taken logs (skip duplicates — no error, just skip)
  const { results: existingLogs } = await c.env.DB.prepare(
    `SELECT supplement_id FROM supplement_logs
     WHERE scheduled_date = ? AND supplement_id IN (${placeholders}) AND skipped = 0 AND taken_at IS NOT NULL`,
  )
    .bind(date, ...supplementIds)
    .all<{ supplement_id: string }>();

  const alreadyLogged = new Set((existingLogs ?? []).map((r) => r.supplement_id));
  const toInsert = supplementIds.filter((id) => !alreadyLogged.has(id));

  if (toInsert.length === 0) {
    return c.json({ created: 0, alreadyLogged: supplementIds.length });
  }

  // 3. Build batch insert statements
  const now = new Date().toISOString();
  const statements = toInsert.map((supplementId) => {
    const id = crypto.randomUUID();
    return c.env.DB.prepare(
      `INSERT INTO supplement_logs
         (id, supplement_id, scheduled_date, scheduled_time, taken_at, actual_dose, skipped, notes)
       VALUES (?, ?, ?, NULL, ?, NULL, 0, NULL)`,
    ).bind(id, supplementId, date, now);
  });

  // 4. Execute as atomic batch
  await c.env.DB.batch(statements);

  return c.json({
    created: toInsert.length,
    alreadyLogged: alreadyLogged.size,
  }, 201);
});
