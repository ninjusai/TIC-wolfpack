/**
 * Training session routes for PeakProtocol (WRK-031).
 *
 * Tracks training sessions: weights, BJJ, cardio, and walks.
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1 for training_sessions. */
interface TrainingSessionRow {
  id: string;
  date: string;
  type: string;
  duration_minutes: number | null;
  intensity: string | null;
  details: string | null; // JSON string in D1
  notes: string | null;
  logged_at: string;
}

/** API-facing camelCase representation. */
interface TrainingSession {
  id: string;
  date: string;
  type: string;
  durationMinutes: number | null;
  intensity: string | null;
  details: Record<string, unknown> | null;
  notes: string | null;
  loggedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function rowToTrainingSession(row: TrainingSessionRow): TrainingSession {
  let parsedDetails: Record<string, unknown> | null = null;
  if (row.details) {
    try {
      parsedDetails = JSON.parse(row.details) as Record<string, unknown>;
    } catch {
      parsedDetails = null;
    }
  }

  return {
    id: row.id,
    date: row.date,
    type: row.type,
    durationMinutes: row.duration_minutes,
    intensity: row.intensity,
    details: parsedDetails,
    notes: row.notes,
    loggedAt: row.logged_at,
  };
}

/**
 * Returns the Monday (ISO week start) of the week containing the given date.
 */
function getMondayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const day = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the Sunday of the week given a Monday date string.
 */
function getSundayOfWeek(mondayStr: string): string {
  const date = new Date(mondayStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

// ── Zod Schemas ───────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const TRAINING_TYPES = ["weights", "bjj", "cardio", "walk"] as const;
const INTENSITY_LEVELS = ["low", "medium", "high"] as const;

const CreateTrainingSessionSchema = z.object({
  date: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD"),
  type: z.enum(TRAINING_TYPES),
  durationMinutes: z.number().int().positive().optional(),
  intensity: z.enum(INTENSITY_LEVELS).optional(),
  details: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

const UpdateTrainingSessionSchema = z.object({
  date: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD").optional(),
  type: z.enum(TRAINING_TYPES).optional(),
  durationMinutes: z.number().int().positive().optional().nullable(),
  intensity: z.enum(INTENSITY_LEVELS).optional().nullable(),
  details: z.record(z.unknown()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ── Routes ────────────────────────────────────────────────────────────

export const trainingRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all training routes
trainingRoutes.use("*", requireSession);

/**
 * GET /api/training-sessions/weekly
 *
 * Returns all sessions for a given week (Monday-Sunday) with summary stats.
 * Query param: weekOf (optional YYYY-MM-DD, defaults to current week).
 *
 * IMPORTANT: This route is registered BEFORE /:id to avoid wildcard conflicts.
 */
trainingRoutes.get("/weekly", async (c) => {
  const weekOfParam = c.req.query("weekOf");

  let weekOfDate: string;
  if (weekOfParam) {
    if (!DATE_REGEX.test(weekOfParam)) {
      return c.json({ error: "Invalid weekOf format. Expected YYYY-MM-DD." }, 400);
    }
    weekOfDate = weekOfParam;
  } else {
    weekOfDate = new Date().toISOString().slice(0, 10);
  }

  const monday = getMondayOfWeek(weekOfDate);
  const sunday = getSundayOfWeek(monday);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM training_sessions
     WHERE date >= ? AND date <= ?
     ORDER BY date DESC, logged_at DESC`,
  )
    .bind(monday, sunday)
    .all<TrainingSessionRow>();

  const sessions = (results ?? []).map(rowToTrainingSession);

  // Build summary
  let totalDuration = 0;
  const byType: Record<string, { count: number; duration: number }> = {};

  for (const session of sessions) {
    totalDuration += session.durationMinutes ?? 0;

    if (!byType[session.type]) {
      byType[session.type] = { count: 0, duration: 0 };
    }
    const entry = byType[session.type]!;
    entry.count += 1;
    entry.duration += session.durationMinutes ?? 0;
  }

  return c.json({
    sessions,
    summary: {
      totalDuration,
      sessionCount: sessions.length,
      byType,
    },
  });
});

/**
 * POST /api/training-sessions
 *
 * Log a new training session. Generates a UUID and sets logged_at to now.
 */
trainingRoutes.post("/", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = CreateTrainingSessionSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const id = crypto.randomUUID();
  const loggedAt = new Date().toISOString();
  const detailsJson = data.details ? JSON.stringify(data.details) : null;

  await c.env.DB.prepare(
    `INSERT INTO training_sessions (id, date, type, duration_minutes, intensity, details, notes, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      data.date,
      data.type,
      data.durationMinutes ?? null,
      data.intensity ?? null,
      detailsJson,
      data.notes ?? null,
      loggedAt,
    )
    .run();

  const session: TrainingSession = {
    id,
    date: data.date,
    type: data.type,
    durationMinutes: data.durationMinutes ?? null,
    intensity: data.intensity ?? null,
    details: data.details ?? null,
    notes: data.notes ?? null,
    loggedAt,
  };

  return c.json({ session }, 201);
});

/**
 * GET /api/training-sessions
 *
 * List training sessions with optional filters.
 * Query params:
 *   - date: exact date (YYYY-MM-DD)
 *   - type: session type filter
 *   - startDate + endDate: date range (YYYY-MM-DD)
 */
trainingRoutes.get("/", async (c) => {
  const date = c.req.query("date");
  const type = c.req.query("type");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  let sql = "SELECT * FROM training_sessions WHERE 1=1";
  const bindings: (string | number)[] = [];

  if (date) {
    if (!DATE_REGEX.test(date)) {
      return c.json({ error: "Invalid date format. Expected YYYY-MM-DD." }, 400);
    }
    sql += " AND date = ?";
    bindings.push(date);
  }

  if (type) {
    sql += " AND type = ?";
    bindings.push(type);
  }

  if (startDate && endDate) {
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      return c.json({ error: "Invalid date range format. Expected YYYY-MM-DD." }, 400);
    }
    sql += " AND date >= ? AND date <= ?";
    bindings.push(startDate, endDate);
  }

  sql += " ORDER BY date DESC, logged_at DESC";

  const stmt = c.env.DB.prepare(sql);
  const { results } = await (bindings.length > 0
    ? stmt.bind(...bindings)
    : stmt
  ).all<TrainingSessionRow>();

  const sessions = (results ?? []).map(rowToTrainingSession);

  return c.json({ sessions });
});

/**
 * GET /api/training-sessions/:id
 *
 * Single session lookup by ID.
 */
trainingRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const row = await c.env.DB.prepare(
    "SELECT * FROM training_sessions WHERE id = ?",
  )
    .bind(id)
    .first<TrainingSessionRow>();

  if (!row) {
    return c.json({ error: "Training session not found" }, 404);
  }

  return c.json({ session: rowToTrainingSession(row) });
});

/**
 * PUT /api/training-sessions/:id
 *
 * Partial update of a training session.
 */
trainingRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");

  // Check existence
  const existing = await c.env.DB.prepare(
    "SELECT * FROM training_sessions WHERE id = ?",
  )
    .bind(id)
    .first<TrainingSessionRow>();

  if (!existing) {
    return c.json({ error: "Training session not found" }, 404);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = UpdateTrainingSessionSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;

  // Merge: provided fields override existing values
  const date = data.date !== undefined ? data.date : existing.date;
  const type = data.type !== undefined ? data.type : existing.type;
  const durationMinutes =
    data.durationMinutes !== undefined ? data.durationMinutes : existing.duration_minutes;
  const intensity =
    data.intensity !== undefined ? data.intensity : existing.intensity;
  const details =
    data.details !== undefined
      ? data.details !== null
        ? JSON.stringify(data.details)
        : null
      : existing.details;
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  await c.env.DB.prepare(
    `UPDATE training_sessions
     SET date = ?, type = ?, duration_minutes = ?, intensity = ?, details = ?, notes = ?
     WHERE id = ?`,
  )
    .bind(date, type, durationMinutes, intensity, details, notes, id)
    .run();

  // Re-read to return updated row
  const updatedRow = await c.env.DB.prepare(
    "SELECT * FROM training_sessions WHERE id = ?",
  )
    .bind(id)
    .first<TrainingSessionRow>();

  if (!updatedRow) {
    return c.json({ error: "Failed to retrieve updated session" }, 500);
  }

  return c.json({ session: rowToTrainingSession(updatedRow) });
});

/**
 * DELETE /api/training-sessions/:id
 *
 * Hard delete a training session.
 */
trainingRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM training_sessions WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Training session not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM training_sessions WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ success: true });
});
