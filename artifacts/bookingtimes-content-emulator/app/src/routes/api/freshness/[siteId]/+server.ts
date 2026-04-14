import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeFreshnessStatus } from '$lib/server/freshness-tracker';

/**
 * GET /api/freshness/:siteId
 * Returns freshness status for all tracked pages of a site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const statuses = computeFreshnessStatus(siteId);

    const summary = { fresh: 0, aging: 0, stale: 0, unknown: 0 };
    for (const s of statuses) {
      summary[s.freshnessStatus]++;
    }

    return json({
      siteId,
      totalPages: statuses.length,
      summary,
      pages: statuses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to compute freshness: ${message}` }, { status: 500 });
  }
};
