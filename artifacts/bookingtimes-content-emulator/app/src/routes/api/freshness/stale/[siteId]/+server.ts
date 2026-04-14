import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStalePages } from '$lib/server/freshness-tracker';

/**
 * GET /api/freshness/stale/:siteId
 * Returns only pages with 'aging' or 'stale' freshness status.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const stalePages = getStalePages(siteId);

    const agingCount = stalePages.filter((p) => p.freshnessStatus === 'aging').length;
    const staleCount = stalePages.filter((p) => p.freshnessStatus === 'stale').length;

    return json({
      siteId,
      totalAlerts: stalePages.length,
      aging: agingCount,
      stale: staleCount,
      pages: stalePages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve stale pages: ${message}` }, { status: 500 });
  }
};
