import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';
import {
  assembleExport,
  assembleAndVersion,
  getExportValidation,
} from '$lib/server/export-pipeline';

interface BlueprintRow {
  id: number;
  site_id: number;
}

/**
 * GET /api/export/:blueprintId
 *
 * Returns the assembled export artifacts with validation results.
 * Does NOT create a version — use POST for that.
 */
export const GET: RequestHandler = async ({ params }) => {
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(blueprintId)) {
    return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
  }

  const blueprint = db.prepare(
    'SELECT id, site_id FROM page_blueprints WHERE id = ?'
  ).get(blueprintId) as BlueprintRow | undefined;

  if (!blueprint) {
    return json({ error: `Blueprint ${blueprintId} not found` }, { status: 404 });
  }

  try {
    const result = assembleExport(blueprintId);
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Export assembly failed: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/export/:blueprintId
 *
 * Assembles export artifacts, runs validation, and if validation passes,
 * creates a page version and updates freshness tracking.
 */
export const POST: RequestHandler = async ({ params }) => {
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(blueprintId)) {
    return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
  }

  const blueprint = db.prepare(
    'SELECT id, site_id FROM page_blueprints WHERE id = ?'
  ).get(blueprintId) as BlueprintRow | undefined;

  if (!blueprint) {
    return json({ error: `Blueprint ${blueprintId} not found` }, { status: 404 });
  }

  try {
    const result = assembleAndVersion(blueprintId);
    const status = result.exportBlocked ? 422 : 200;
    return json(result, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Export failed: ${message}` }, { status: 500 });
  }
};
