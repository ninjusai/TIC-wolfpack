import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { completeStage2 } from '$lib/server/stage-checkpoints';

/**
 * POST /api/stage/complete-2
 * Triggers Stage 2 (Research & Benchmark) completion.
 * This is a GLOBAL checkpoint — no site_id required.
 * Advances all sites currently at stage_1 to stage_2.
 */
export const POST: RequestHandler = async () => {
  const result = completeStage2();
  return json(result, { status: result.success ? 200 : 400 });
};
