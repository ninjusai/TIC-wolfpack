import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPipelineStatus } from '$lib/server/pipeline-gates';

/**
 * GET /api/pipeline/status
 * Returns pipeline status for all sites.
 */
export const GET: RequestHandler = () => {
  const status = getPipelineStatus();
  return json({ sites: status });
};
