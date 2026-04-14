import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

/**
 * POST /api/work-backlog/:siteId/approve
 * Approves selected backlog items by setting their status to 'blueprinted'.
 *
 * Body: { itemIds: number[] }
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  let body: { itemIds?: number[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { itemIds } = body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return json({ error: 'itemIds must be a non-empty array of numbers' }, { status: 400 });
  }

  if (!itemIds.every((id) => typeof id === 'number' && Number.isInteger(id))) {
    return json({ error: 'All itemIds must be integers' }, { status: 400 });
  }

  try {
    const updateStmt = db.prepare(`
      UPDATE work_backlog
      SET status = 'blueprinted'
      WHERE id = ? AND site_id = ? AND status = 'pending'
    `);

    const approve = db.transaction(() => {
      let updated = 0;
      for (const id of itemIds) {
        const result = updateStmt.run(id, siteId);
        updated += result.changes;
      }
      return updated;
    });

    const updatedCount = approve();

    return json({
      siteId,
      requested: itemIds.length,
      approved: updatedCount,
      message: `Approved ${updatedCount} of ${itemIds.length} requested item(s).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Approval failed: ${message}` }, { status: 500 });
  }
};
