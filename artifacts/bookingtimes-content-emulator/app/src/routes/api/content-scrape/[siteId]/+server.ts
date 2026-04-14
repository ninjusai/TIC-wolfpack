import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeSiteContent, getContentAudit } from '$lib/server/content-scraper';

/**
 * GET /api/content-scrape/:siteId
 * Returns existing content_audit data for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const result = getContentAudit(siteId);

  if (result.errors.length > 0 && result.pagesScraped === 0) {
    return json(result, { status: 404 });
  }

  return json(result);
};

/**
 * POST /api/content-scrape/:siteId
 * Triggers content scraping for the given site.
 * Selects 5-10 representative pages from site_structure_map,
 * scrapes each, extracts content, and stores in content_audit.
 */
export const POST: RequestHandler = async ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = await scrapeSiteContent(siteId);

    if (result.errors.length > 0 && result.pagesScraped === 0) {
      return json(result, { status: 404 });
    }

    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Content scrape failed: ${message}` }, { status: 500 });
  }
};
