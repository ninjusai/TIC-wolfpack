import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { completeStage4 } from '$lib/server/stage-checkpoints';

/**
 * POST /api/stage/complete-4/[siteId]
 * Triggers Stage 4 (Blueprints & Section Specs) completion for the given site.
 * Gathers deliverables, checks approval status, writes checkpoint, advances stage.
 */
export const POST: RequestHandler = async ({ params }) => {
  const siteId = Number(params.siteId);

  if (!Number.isInteger(siteId) || siteId <= 0) {
    return json(
      { success: false, error: 'siteId must be a positive integer' },
      { status: 400 }
    );
  }

  const result = completeStage4(siteId);

  return json(result, { status: result.success ? 200 : 400 });
};
