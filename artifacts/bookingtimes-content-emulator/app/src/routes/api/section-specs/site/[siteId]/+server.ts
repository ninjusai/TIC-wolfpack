import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAllSectionSpecs } from '$lib/server/section-spec-generator';

/**
 * POST /api/section-specs/site/:siteId
 * Generates section specs for ALL blueprints belonging to the site.
 * Clears and regenerates existing specs per blueprint (idempotent).
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = generateAllSectionSpecs(siteId);

    return json({
      siteId,
      ...result,
      message: result.blueprintsProcessed > 0
        ? `Processed ${result.blueprintsProcessed} blueprint(s), generated ${result.totalSections} total section spec(s).`
        : 'No blueprints found for this site.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Bulk section spec generation failed: ${message}` }, { status: 500 });
  }
};
