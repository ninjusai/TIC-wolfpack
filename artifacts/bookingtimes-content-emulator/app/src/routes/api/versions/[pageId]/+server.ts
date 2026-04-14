import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getVersionHistory,
  createVersion,
} from '$lib/server/version-history';

/**
 * GET /api/versions/[pageId] — list version history (newest first)
 */
export const GET: RequestHandler = async ({ params }) => {
  const pageId = Number(params.pageId);
  if (!Number.isInteger(pageId) || pageId <= 0) {
    throw error(400, 'Invalid pageId — must be a positive integer');
  }

  const versions = getVersionHistory(pageId);
  return json({ pageId, versions });
};

/**
 * POST /api/versions/[pageId] — create a new version
 * Body: { htmlContent: string, changeReason: string }
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

  const { htmlContent, changeReason } = body;

  if (typeof htmlContent !== 'string' || htmlContent.length === 0) {
    throw error(400, '"htmlContent" is required and must be a non-empty string');
  }
  if (typeof changeReason !== 'string' || changeReason.length === 0) {
    throw error(400, '"changeReason" is required and must be a non-empty string');
  }

  try {
    const version = createVersion(pageId, htmlContent, changeReason);
    return json(version, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw error(500, `Failed to create version: ${msg}`);
  }
};
