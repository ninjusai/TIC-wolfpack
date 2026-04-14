import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

/**
 * POST /api/work-backlog/:siteId/reorder
 * Updates priority values for backlog items.
 * Enforces DEC-031: homepage items cannot be moved below position 1.
 *
 * Body: { items: Array<{ id: number, priority: number }> }
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  let body: { items?: Array<{ id: number; priority: number }> };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: 'items must be a non-empty array of { id, priority }' }, { status: 400 });
  }

  for (const item of items) {
    if (
      typeof item.id !== 'number' ||
      !Number.isInteger(item.id) ||
      typeof item.priority !== 'number' ||
      !Number.isInteger(item.priority)
    ) {
      return json({ error: 'Each item must have integer id and priority' }, { status: 400 });
    }
  }

  try {
    // DEC-031 enforcement: check that homepage items stay at lowest priority number (highest priority)
    const homepageCheck = db.prepare(`
      SELECT id FROM work_backlog
      WHERE site_id = ? AND page_type = 'homepage'
    `);
    const homepageItems = homepageCheck.all(siteId) as Array<{ id: number }>;
    const homepageIds = new Set(homepageItems.map((h) => h.id));

    // Find the minimum priority being assigned to non-homepage items
    let minNonHomepagePriority = Infinity;
    let maxHomepagePriority = -Infinity;

    for (const item of items) {
      if (homepageIds.has(item.id)) {
        maxHomepagePriority = Math.max(maxHomepagePriority, item.priority);
      } else {
        minNonHomepagePriority = Math.min(minNonHomepagePriority, item.priority);
      }
    }

    if (
      maxHomepagePriority !== -Infinity &&
      minNonHomepagePriority !== Infinity &&
      maxHomepagePriority > minNonHomepagePriority
    ) {
      return json(
        {
          error:
            'DEC-031 violation: Homepage items must remain at the highest priority (lowest priority number). Cannot move homepage below other items.',
        },
        { status: 400 }
      );
    }

    const updateStmt = db.prepare(`
      UPDATE work_backlog
      SET priority = ?
      WHERE id = ? AND site_id = ?
    `);

    const reorder = db.transaction(() => {
      let updated = 0;
      for (const item of items) {
        const result = updateStmt.run(item.priority, item.id, siteId);
        updated += result.changes;
      }
      return updated;
    });

    const updatedCount = reorder();

    return json({
      siteId,
      requested: items.length,
      updated: updatedCount,
      message: `Updated priority for ${updatedCount} item(s).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Reorder failed: ${message}` }, { status: 500 });
  }
};
