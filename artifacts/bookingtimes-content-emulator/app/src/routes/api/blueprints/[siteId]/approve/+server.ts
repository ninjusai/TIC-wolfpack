/**
 * Blueprint Approval API — WRK-BCE2-032
 *
 * POST /api/blueprints/:siteId/approve
 * Body: { blueprintIds: number[] }
 * Sets user_approved = 1 on the specified blueprints.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

export const POST: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  let body: { blueprintIds?: number[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { blueprintIds } = body;

  if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) {
    return json({ error: 'blueprintIds must be a non-empty array of numbers' }, { status: 400 });
  }

  if (!blueprintIds.every((id) => typeof id === 'number' && Number.isInteger(id))) {
    return json({ error: 'All blueprintIds must be integers' }, { status: 400 });
  }

  try {
    const updateStmt = db.prepare(`
      UPDATE page_blueprints
      SET user_approved = 1
      WHERE id = ? AND site_id = ? AND user_approved = 0
    `);

    const approve = db.transaction(() => {
      let updated = 0;
      for (const id of blueprintIds) {
        const result = updateStmt.run(id, siteId);
        updated += result.changes;
      }
      return updated;
    });

    const updatedCount = approve();

    return json({
      siteId,
      requested: blueprintIds.length,
      approved: updatedCount,
      message: `Approved ${updatedCount} of ${blueprintIds.length} requested blueprint(s).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Blueprint approval failed: ${message}` }, { status: 500 });
  }
};
