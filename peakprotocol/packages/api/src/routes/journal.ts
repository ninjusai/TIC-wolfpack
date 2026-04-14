/**
 * Journal entry CRUD + search routes for PeakProtocol (WRK-035).
 *
 * Manages personal journal entries: create, read, update, delete, search.
 * All routes require an authenticated session via requireSession middleware.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireSession } from "../middleware/session";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape returned from D1. */
interface JournalEntryRow {
  id: string;
  date: string;
  content: string;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

/** API-facing camelCase representation. */
interface JournalEntry {
  id: string;
  date: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function rowToJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Zod Schemas ────────────────────────────────────────────────────────

const CreateJournalEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  content: z.string().min(1, "Content is required"),
  tags: z.array(z.string()).optional(),
});

const UpdateJournalEntrySchema = z.object({
  date: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────

/** Escape LIKE-special characters so they match literally. */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

// ── Routes ─────────────────────────────────────────────────────────────

export const journalRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply session middleware to all journal routes
journalRoutes.use("*", requireSession);

/**
 * GET /api/journal/search
 *
 * Full-text search on content and tags using LIKE.
 * Query params:
 *   - q: string (required) — search query
 *   - limit: number (optional, default 20) — max results
 *
 * Mounted before /:id to avoid route conflicts.
 */
journalRoutes.get("/search", async (c) => {
  const q = c.req.query("q");
  const limitParam = c.req.query("limit");

  if (!q) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 20;
  const pattern = `%${escapeLike(q)}%`;

  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM journal_entries WHERE content LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'",
  )
    .bind(pattern, pattern)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM journal_entries
     WHERE content LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'
     ORDER BY date DESC, created_at DESC
     LIMIT ?`,
  )
    .bind(pattern, pattern, limit)
    .all<JournalEntryRow>();

  const entries = (results ?? []).map(rowToJournalEntry);

  return c.json({ entries, total: countResult?.total ?? 0 });
});

/**
 * GET /api/journal
 *
 * List journal entries with optional filters.
 * Query params:
 *   - date: string — filter entries for a specific day
 *   - startDate + endDate: string — filter entries within a date range
 *   - tag: string — filter entries whose tags JSON array contains the value
 */
journalRoutes.get("/", async (c) => {
  const dateParam = c.req.query("date");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const tagParam = c.req.query("tag");

  let sql = "SELECT * FROM journal_entries";
  const conditions: string[] = [];
  const bindings: string[] = [];

  if (dateParam) {
    conditions.push("date = ?");
    bindings.push(dateParam);
  } else if (startDate && endDate) {
    conditions.push("date >= ? AND date <= ?");
    bindings.push(startDate, endDate);
  }

  if (tagParam) {
    conditions.push("tags LIKE ? ESCAPE '\\'");
    bindings.push(`%"${escapeLike(tagParam)}"%`);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY date DESC, created_at DESC";

  let stmt = c.env.DB.prepare(sql);
  if (bindings.length > 0) {
    stmt = stmt.bind(...bindings);
  }

  const { results } = await stmt.all<JournalEntryRow>();
  const entries = (results ?? []).map(rowToJournalEntry);

  return c.json({ entries });
});

/**
 * POST /api/journal
 *
 * Create a new journal entry.
 */
journalRoutes.post("/", async (c) => {
  const rawBody: unknown = await c.req.json();
  const parsed = CreateJournalEntrySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const data = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO journal_entries
       (id, date, content, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      data.date,
      data.content,
      data.tags ? JSON.stringify(data.tags) : null,
      now,
      now,
    )
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM journal_entries WHERE id = ?")
    .bind(id)
    .first<JournalEntryRow>();

  if (!row) {
    return c.json({ error: "Failed to create journal entry" }, 500);
  }

  return c.json({ entry: rowToJournalEntry(row) }, 201);
});

/**
 * GET /api/journal/:id
 *
 * Retrieve a single journal entry by ID.
 */
journalRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const row = await c.env.DB.prepare("SELECT * FROM journal_entries WHERE id = ?")
    .bind(id)
    .first<JournalEntryRow>();

  if (!row) {
    return c.json({ error: "Journal entry not found" }, 404);
  }

  return c.json({ entry: rowToJournalEntry(row) });
});

/**
 * PUT /api/journal/:id
 *
 * Partial update of a journal entry. All fields optional.
 */
journalRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");

  // Verify the entry exists
  const existing = await c.env.DB.prepare(
    "SELECT id FROM journal_entries WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Journal entry not found" }, 404);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = UpdateJournalEntrySchema.safeParse(rawBody);

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
  const bindings: (string | null)[] = [now];

  if (data.date !== undefined) {
    setClauses.push("date = ?");
    bindings.push(data.date);
  }
  if (data.content !== undefined) {
    setClauses.push("content = ?");
    bindings.push(data.content);
  }
  if (data.tags !== undefined) {
    setClauses.push("tags = ?");
    bindings.push(JSON.stringify(data.tags));
  }

  // id goes last for the WHERE clause
  bindings.push(id);

  await c.env.DB.prepare(
    `UPDATE journal_entries SET ${setClauses.join(", ")} WHERE id = ?`,
  )
    .bind(...bindings)
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM journal_entries WHERE id = ?")
    .bind(id)
    .first<JournalEntryRow>();

  if (!row) {
    return c.json({ error: "Failed to retrieve updated journal entry" }, 500);
  }

  return c.json({ entry: rowToJournalEntry(row) });
});

/**
 * DELETE /api/journal/:id
 *
 * Hard delete a journal entry.
 */
journalRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM journal_entries WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Journal entry not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM journal_entries WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ success: true });
});
