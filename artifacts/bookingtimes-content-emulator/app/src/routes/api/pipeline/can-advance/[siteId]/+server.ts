import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canAdvance } from '$lib/server/pipeline-gates';

/**
 * GET /api/pipeline/can-advance/:siteId
 * Checks if a site can advance to the next pipeline stage.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json(
      { canAdvance: false, reason: 'Invalid siteId parameter' },
      { status: 400 }
    );
  }

  const result = canAdvance(siteId);
  return json(result);
};
