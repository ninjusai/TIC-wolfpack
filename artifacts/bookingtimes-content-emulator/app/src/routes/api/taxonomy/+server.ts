import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  seedPageTaxonomy,
  seedSiloDefinitions,
  getPageTaxonomy,
  getSiloDefinitions
} from '$lib/server/taxonomy-silo';

/**
 * GET /api/taxonomy
 * Returns current page taxonomy and (optionally) silo definitions.
 * Query params:
 *   - siteId (optional): include silo definitions for this site
 */
export const GET: RequestHandler = ({ url }) => {
  try {
    const taxonomy = getPageTaxonomy();
    const siteIdParam = url.searchParams.get('siteId');

    const response: Record<string, unknown> = {
      taxonomy: { count: taxonomy.length, entries: taxonomy }
    };

    if (siteIdParam) {
      const siteId = parseInt(siteIdParam, 10);
      if (isNaN(siteId)) {
        return json({ error: 'siteId must be a number' }, { status: 400 });
      }
      const silos = getSiloDefinitions(siteId);
      response.silos = { count: silos.length, definitions: silos };
    }

    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve taxonomy: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/taxonomy
 * Seeds page taxonomy and (optionally) silo definitions.
 * Body: { siteId?: number }
 *   - Always seeds page taxonomy + generation_order benchmark
 *   - If siteId provided, also seeds silo definitions for that site
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    let siteId: number | null = null;

    // Body is optional; if provided, extract siteId
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.siteId !== undefined) {
        siteId = parseInt(body.siteId, 10);
        if (isNaN(siteId)) {
          return json({ error: 'siteId must be a number' }, { status: 400 });
        }
      }
    }

    const taxonomyResult = seedPageTaxonomy();
    const taxonomy = getPageTaxonomy();

    const response: Record<string, unknown> = {
      message: 'Page taxonomy seeded successfully',
      taxonomy: { ...taxonomyResult, entries: taxonomy }
    };

    if (siteId !== null) {
      const siloResult = seedSiloDefinitions(siteId);
      const silos = getSiloDefinitions(siteId);
      response.silos = { ...siloResult, definitions: silos };
      response.message = 'Page taxonomy and silo definitions seeded successfully';
    }

    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to seed taxonomy: ${message}` }, { status: 500 });
  }
};
