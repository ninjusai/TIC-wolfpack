import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

/**
 * GET /api/rules/:siteId
 * Returns all brand_rules for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const rules = db
      .prepare(
        `SELECT id, site_id, category, rule_text, priority, source, scope,
                page_type, section_type, confidence, confirmed, source_session_id,
                active, created_at
         FROM brand_rules
         WHERE site_id = ?
         ORDER BY priority DESC, created_at DESC`
      )
      .all(siteId);

    return json({ siteId, rules });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to fetch rules: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/rules/:siteId
 * Creates a new brand rule.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { category, rule_text, priority, source, scope, page_type, section_type, confidence } = body as {
    category: string;
    rule_text: string;
    priority?: number;
    source?: string;
    scope?: string;
    page_type?: string;
    section_type?: string;
    confidence?: number;
  };

  if (!category || !rule_text) {
    return json({ error: 'category and rule_text are required' }, { status: 400 });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO brand_rules (site_id, category, rule_text, priority, source, scope, page_type, section_type, confidence, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        siteId,
        category,
        rule_text,
        priority ?? 0,
        source ?? 'manual',
        scope ?? 'brand',
        page_type ?? null,
        section_type ?? null,
        confidence ?? 1.0
      );

    const rule = db.prepare('SELECT * FROM brand_rules WHERE id = ?').get(result.lastInsertRowid);

    return json({ rule }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to create rule: ${message}` }, { status: 500 });
  }
};

/**
 * PUT /api/rules/:siteId
 * Updates an existing brand rule.
 * Body: { ruleId: number, updates: { ... } }
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  let body: { ruleId: number; updates: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { ruleId, updates } = body;

  if (!ruleId || !updates) {
    return json({ error: 'ruleId and updates are required' }, { status: 400 });
  }

  // Whitelist of allowed update fields
  const allowedFields = [
    'category', 'rule_text', 'priority', 'source', 'scope',
    'page_type', 'section_type', 'confidence', 'confirmed', 'active'
  ];

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    return json({ error: 'No valid fields to update' }, { status: 400 });
  }

  values.push(ruleId, siteId);

  try {
    const result = db
      .prepare(`UPDATE brand_rules SET ${setClauses.join(', ')} WHERE id = ? AND site_id = ?`)
      .run(...values);

    if (result.changes === 0) {
      return json({ error: 'Rule not found or does not belong to this site' }, { status: 404 });
    }

    const rule = db.prepare('SELECT * FROM brand_rules WHERE id = ?').get(ruleId);
    return json({ rule });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to update rule: ${message}` }, { status: 500 });
  }
};

/**
 * DELETE /api/rules/:siteId
 * Soft-deletes (deactivates) a rule by setting active=0.
 * Body: { ruleId: number }
 */
export const DELETE: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  let body: { ruleId: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { ruleId } = body;

  if (!ruleId) {
    return json({ error: 'ruleId is required' }, { status: 400 });
  }

  try {
    const result = db
      .prepare('UPDATE brand_rules SET active = 0 WHERE id = ? AND site_id = ?')
      .run(ruleId, siteId);

    if (result.changes === 0) {
      return json({ error: 'Rule not found or does not belong to this site' }, { status: 404 });
    }

    return json({ success: true, ruleId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to deactivate rule: ${message}` }, { status: 500 });
  }
};
