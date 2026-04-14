import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auditSiteSeo, getSeoAuditResults } from '$lib/server/seo-auditor';

/**
 * GET /api/seo-audit/:siteId
 * Returns existing SEO audit data for all scraped pages of the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const results = getSeoAuditResults(siteId);

  if (results.length === 0) {
    return json(
      { siteId, pagesAudited: 0, results: [], message: 'No SEO audit data found. Run POST to trigger an audit.' },
      { status: 404 }
    );
  }

  const avgScore = results.reduce((sum, r) => sum + r.seoScore, 0) / results.length;

  return json({
    siteId,
    pagesAudited: results.length,
    averageSeoScore: parseFloat(avgScore.toFixed(3)),
    results,
  });
};

/**
 * POST /api/seo-audit/:siteId
 * Triggers SEO audit for all content-scraped pages of the given site.
 * Reads data from site_structure_map and content_audit — no HTTP fetches needed.
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const results = auditSiteSeo(siteId);

    if (results.length === 0) {
      return json(
        {
          siteId,
          pagesAudited: 0,
          results: [],
          message: 'No content-scraped pages found. Run content scraper (WRK-011) first.',
        },
        { status: 404 }
      );
    }

    const avgScore = results.reduce((sum, r) => sum + r.seoScore, 0) / results.length;

    return json({
      siteId,
      pagesAudited: results.length,
      averageSeoScore: parseFloat(avgScore.toFixed(3)),
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `SEO audit failed: ${message}` }, { status: 500 });
  }
};
