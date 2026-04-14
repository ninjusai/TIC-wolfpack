import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';
import { validatePageHtml } from '$lib/server/html-validator';

interface BlueprintRow {
  id: number;
  site_id: number;
}

/**
 * POST /api/validate/page/:blueprintId
 *
 * Validates all sections for a page blueprint.
 * Returns a combined ValidationResult covering every section.
 */
export const POST: RequestHandler = async ({ params }) => {
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(blueprintId)) {
    return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
  }

  // Verify blueprint exists
  const blueprint = db.prepare(
    'SELECT id, site_id FROM page_blueprints WHERE id = ?'
  ).get(blueprintId) as BlueprintRow | undefined;

  if (!blueprint) {
    return json({ error: `Blueprint ${blueprintId} not found` }, { status: 404 });
  }

  try {
    const result = validatePageHtml(blueprintId);
    return json({
      blueprintId,
      siteId: blueprint.site_id,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Validation failed: ${message}` }, { status: 500 });
  }
};
