import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { advanceSiteStage } from '$lib/server/pipeline-gates';

/**
 * POST /api/pipeline/advance
 * Advances a site to the next pipeline stage.
 * Body: { siteId: number }
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { siteId } = body;

  if (typeof siteId !== 'number' || !Number.isInteger(siteId)) {
    return json(
      { success: false, error: 'siteId must be an integer' },
      { status: 400 }
    );
  }

  const result = advanceSiteStage(siteId);

  return json(result, { status: result.success ? 200 : 400 });
};
