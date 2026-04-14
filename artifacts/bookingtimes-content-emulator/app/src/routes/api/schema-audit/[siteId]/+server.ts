import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeSiteSchema, getSchemaAudit } from '$lib/server/schema-detector';

/**
 * GET /api/schema-audit/:siteId
 * Returns existing schema_audit data for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const result = getSchemaAudit(siteId);

  if (result.errors.length > 0 && result.pagesAnalyzed === 0) {
    return json(result, { status: 404 });
  }

  return json(result);
};

/**
 * POST /api/schema-audit/:siteId
 * Triggers schema analysis for all audited pages of the site.
 * Fetches each page, extracts JSON-LD / Microdata / RDFa,
 * validates, identifies gaps, and stores results in schema_audit.
 */
export const POST: RequestHandler = async ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = await analyzeSiteSchema(siteId);

    if (result.errors.length > 0 && result.pagesAnalyzed === 0) {
      return json(result, { status: 404 });
    }

    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Schema audit failed: ${message}` }, { status: 500 });
  }
};
