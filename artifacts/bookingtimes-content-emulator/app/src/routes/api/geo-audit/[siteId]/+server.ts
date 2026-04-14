import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auditSiteGeo } from '$lib/server/geo-auditor';
import db from '$lib/db';

/**
 * GET /api/geo-audit/:siteId
 * Returns current GEO audit data for all pages of the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const rows = db
    .prepare(
      `SELECT ca.structure_map_id, ca.geo_score, ca.geo_deficiencies,
              ssm.url, ssm.page_type
       FROM content_audit ca
       JOIN site_structure_map ssm ON ssm.id = ca.structure_map_id
       WHERE ca.site_id = ? AND ca.geo_score IS NOT NULL`
    )
    .all(siteId) as Array<{
      structure_map_id: number;
      geo_score: number | null;
      geo_deficiencies: string | null;
      url: string;
      page_type: string | null;
    }>;

  if (rows.length === 0) {
    return json(
      {
        siteId,
        message: 'No GEO audit data found. POST to this endpoint to run the audit.',
        pages: [],
      },
      { status: 404 }
    );
  }

  const pages = rows.map((row) => ({
    structureMapId: row.structure_map_id,
    url: row.url,
    pageType: row.page_type,
    geoScore: row.geo_score,
    deficiencies: row.geo_deficiencies ? JSON.parse(row.geo_deficiencies) : [],
  }));

  const avgScore =
    pages.reduce((sum, p) => sum + (p.geoScore ?? 0), 0) / pages.length;

  return json({
    siteId,
    pagesAudited: pages.length,
    averageGeoScore: Number(avgScore.toFixed(3)),
    pages,
  });
};

/**
 * POST /api/geo-audit/:siteId
 * Triggers a GEO readiness audit for all content-scraped pages of the site.
 * Requires content scraping (WRK-011) to have been run first.
 */
export const POST: RequestHandler = async ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  // Validate site exists
  const site = db
    .prepare('SELECT id FROM sites WHERE id = ?')
    .get(siteId) as { id: number } | undefined;

  if (!site) {
    return json({ error: `Site with id ${siteId} not found` }, { status: 404 });
  }

  try {
    const results = await auditSiteGeo(siteId);

    if (results.length === 0) {
      return json(
        {
          siteId,
          error:
            'No content_audit data found for this site. Run content scraper (WRK-011) first.',
          pagesAudited: 0,
          results: [],
        },
        { status: 404 }
      );
    }

    const avgScore =
      results.reduce((sum, r) => sum + r.geoScore, 0) / results.length;

    return json({
      siteId,
      pagesAudited: results.length,
      averageGeoScore: Number(avgScore.toFixed(3)),
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `GEO audit failed: ${message}` }, { status: 500 });
  }
};
