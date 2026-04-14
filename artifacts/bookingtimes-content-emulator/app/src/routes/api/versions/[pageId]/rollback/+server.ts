import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rollbackToVersion } from '$lib/server/version-history';

/**
 * POST /api/versions/[pageId]/rollback — non-destructive rollback
 * Body: { targetVersion: number }
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const pageId = Number(params.pageId);
  if (!Number.isInteger(pageId) || pageId <= 0) {
    throw error(400, 'Invalid pageId — must be a positive integer');
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    throw error(400, 'Request body must be valid JSON');
  }

  const { targetVersion } = body;

  if (typeof targetVersion !== 'number' || !Number.isInteger(targetVersion) || targetVersion <= 0) {
    throw error(400, '"targetVersion" is required and must be a positive integer');
  }

  try {
    const version = rollbackToVersion(pageId, targetVersion);
    return json(version, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found')) {
      throw error(404, msg);
    }
    throw error(500, `Rollback failed: ${msg}`);
  }
};
