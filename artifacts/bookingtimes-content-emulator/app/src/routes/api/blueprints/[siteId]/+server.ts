import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateBlueprints, getBlueprints } from '$lib/server/blueprint-generator';

/**
 * GET /api/blueprints/:siteId
 * Returns existing page blueprints for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const blueprints = getBlueprints(siteId);

    if (blueprints.length === 0) {
      return json(
        {
          siteId,
          totalBlueprints: 0,
          blueprints: [],
          message: 'No blueprints found. Run POST to generate blueprints from pending backlog items.',
        },
        { status: 404 }
      );
    }

    // Summarise by page type
    const byPageType: Record<string, number> = {};
    for (const bp of blueprints) {
      const pageType = (bp as Record<string, unknown>).page_type as string;
      byPageType[pageType] = (byPageType[pageType] || 0) + 1;
    }

    return json({
      siteId,
      totalBlueprints: blueprints.length,
      byPageType,
      blueprints,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve blueprints: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/blueprints/:siteId
 * Generates page blueprints for all pending/blueprinted work_backlog items.
 * Replaces existing blueprints for the same backlog items (idempotent).
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = generateBlueprints(siteId);

    return json({
      ...result,
      message: result.blueprintsCreated > 0
        ? `Generated ${result.blueprintsCreated} blueprint(s) for site ${siteId}.`
        : 'No pending backlog items found to generate blueprints for.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Blueprint generation failed: ${message}` }, { status: 500 });
  }
};
