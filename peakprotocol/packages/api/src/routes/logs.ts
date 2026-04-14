/**
 * Supplement logging routes for PeakProtocol (WRK-013).
 *
 * Tracks when supplements are taken or skipped, with optional dose
 * overrides and notes. All routes require an authenticated session.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1. */
interface SupplementLogRow {
  id: string;
  supplement_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  taken_at: string | null;
  actual_dose: string | null;
  skipped: number;
  notes: string | null;
}

/** API-facing camelCase representation. */
interface SupplementLog {
  id: string;
  supplementId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  takenAt: string | null;
  actualDose: string | null;
  skipped: boolean;
  notes: string | null;
}

function rowToLog(row: SupplementLogRow): SupplementLog {
  return {
    id: row.id,
    supplementId: row.supplement_id,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    takenAt: row.taken_at,
    actualDose: row.actual_dose,
    skipped: row.skipped === 1,
    notes: row.notes,
  };
}

// ── Zod Schemas ────────────────────────────────────────────────────────

const CreateLogSchema = z.object({
  scheduledDate: z.string().min(1, "scheduledDate is required"),
  scheduledTime: z.string().optional(),
  takenAt: z.string().optional(),
  actualDose: z.string().optional(),
  skipped: z.boolean().optional(),
  notes: z.string().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────

export const logRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all log routes
logRoutes.use("*", requireSession);

/**
 * POST /api/supplements/:id/log
 *
 * Mark a supplement as taken or skipped.
 */
logRoutes.post("/:id/log", async (c) => {
  const supplementId = c.req.param("id");

  // Validate supplement exists
  const supplement = await c.env.DB.prepare(
    "SELECT id FROM supplements WHERE id = ?",
  )
    .bind(supplementId)
    .first<{ id: string }>();

  if (!supplement) {
    return c.json({ error: "Supplement not found" }, 404);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = CreateLogSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const id = crypto.randomUUID();
  const skipped = data.skipped ? 1 : 0;

  // Default takenAt to now if not skipped and not provided
  let takenAt: string | null = data.takenAt ?? null;
  if (!takenAt && !data.skipped) {
    takenAt = new Date().toISOString();
  }

  await c.env.DB.prepare(
    `INSERT INTO supplement_logs
       (id, supplement_id, scheduled_date, scheduled_time, taken_at, actual_dose, skipped, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      supplementId,
      data.scheduledDate,
      data.scheduledTime ?? null,
      takenAt,
      data.actualDose ?? null,
      skipped,
      data.notes ?? null,
    )
    .run();

  const row = await c.env.DB.prepare(
    "SELECT * FROM supplement_logs WHERE id = ?",
  )
    .bind(id)
    .first<SupplementLogRow>();

  if (!row) {
    return c.json({ error: "Failed to create log entry" }, 500);
  }

  return c.json({ log: rowToLog(row) }, 201);
});

/**
 * GET /api/supplements/logs
 *
 * Query logs for a given date, optionally filtered by supplement.
 * Query params: date (required, YYYY-MM-DD), supplementId (optional)
 */
logRoutes.get("/logs", async (c) => {
  const date = c.req.query("date");

  if (!date) {
    return c.json({ error: "date query parameter is required" }, 400);
  }

  let sql = "SELECT * FROM supplement_logs WHERE scheduled_date = ?";
  const bindings: string[] = [date];

  const supplementId = c.req.query("supplementId");
  if (supplementId) {
    sql += " AND supplement_id = ?";
    bindings.push(supplementId);
  }

  sql += " ORDER BY scheduled_date DESC";

  const { results } = await c.env.DB.prepare(sql)
    .bind(...bindings)
    .all<SupplementLogRow>();

  const logs = (results ?? []).map(rowToLog);

  return c.json({ logs });
});

/**
 * GET /api/supplements/:id/logs
 *
 * List logs for a specific supplement with optional date range.
 * Query params: startDate (optional), endDate (optional)
 */
logRoutes.get("/:id/logs", async (c) => {
  const supplementId = c.req.param("id");

  let sql = "SELECT * FROM supplement_logs WHERE supplement_id = ?";
  const bindings: string[] = [supplementId];

  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  if (startDate) {
    sql += " AND scheduled_date >= ?";
    bindings.push(startDate);
  }

  if (endDate) {
    sql += " AND scheduled_date <= ?";
    bindings.push(endDate);
  }

  sql += " ORDER BY scheduled_date DESC";

  const { results } = await c.env.DB.prepare(sql)
    .bind(...bindings)
    .all<SupplementLogRow>();

  const logs = (results ?? []).map(rowToLog);

  return c.json({ logs });
});

/**
 * DELETE /api/supplements/logs/:logId
 *
 * Delete a specific log entry (undo a mistaken log).
 */
logRoutes.delete("/logs/:logId", async (c) => {
  const logId = c.req.param("logId");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM supplement_logs WHERE id = ?",
  )
    .bind(logId)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Log entry not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM supplement_logs WHERE id = ?")
    .bind(logId)
    .run();

  return c.json({ success: true });
});
