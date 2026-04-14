import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateJsonLdSpecs, getJsonLdSpecs } from '$lib/server/jsonld-spec-generator';

/**
 * GET /api/jsonld-specs/:siteId
 * Returns current JSON-LD specs for all blueprints belonging to the site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const specs = getJsonLdSpecs(siteId);

    if (specs.length === 0) {
      return json(
        {
          siteId,
          totalSpecs: 0,
          specs: [],
          message: 'No JSON-LD specs found. Run POST to generate specs from existing blueprints.',
        },
        { status: 404 }
      );
    }

    // Summarise by page type
    const byPageType: Record<string, number> = {};
    for (const s of specs) {
      byPageType[s.pageType] = (byPageType[s.pageType] || 0) + 1;
    }

    return json({
      siteId,
      totalSpecs: specs.length,
      byPageType,
      specs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve JSON-LD specs: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/jsonld-specs/:siteId
 * Generates JSON-LD specs for all blueprints belonging to the site.
 * Updates the schema_spec column on each page_blueprint (idempotent).
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = generateJsonLdSpecs(siteId);

    return json({
      ...result,
      message: result.blueprintsUpdated > 0
        ? `Generated JSON-LD specs for ${result.blueprintsUpdated} blueprint(s) across site ${siteId}.`
        : 'No blueprints found for this site. Generate blueprints first.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `JSON-LD spec generation failed: ${message}` }, { status: 500 });
  }
};
