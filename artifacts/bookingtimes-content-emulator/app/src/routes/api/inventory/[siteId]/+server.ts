import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { inventorySite, getInventory } from '$lib/server/sitemap-crawler';

/**
 * GET /api/inventory/:siteId
 * Returns the current page inventory from the database for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const result = getInventory(siteId);

  if (result.errors.length > 0 && result.totalPages === 0) {
    return json(result, { status: 404 });
  }

  return json(result);
};

/**
 * POST /api/inventory/:siteId
 * Triggers a sitemap crawl and page inventory for the given site.
 */
export const POST: RequestHandler = async ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = await inventorySite(siteId);

    if (result.errors.length > 0 && result.totalPages === 0) {
      return json(result, { status: 404 });
    }

    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Inventory failed: ${message}` }, { status: 500 });
  }
};
