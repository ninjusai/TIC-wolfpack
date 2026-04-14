import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrandEvolution } from '$lib/server/feedback-engine';

/**
 * GET /api/feedback/evolution/:siteId
 * Returns the brand profile evolution history for a site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const evolution = getBrandEvolution(siteId);
    return json({ siteId, evolution });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve evolution: ${message}` }, { status: 500 });
  }
};
