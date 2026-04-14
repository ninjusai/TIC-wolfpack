import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeGaps, getGapAnalysis } from '$lib/server/gap-engine';

/**
 * GET /api/gap-analysis/:siteId
 * Returns existing gap analysis data for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const results = getGapAnalysis(siteId);

  if (results.length === 0) {
    return json(
      { siteId, totalGaps: 0, results: [], message: 'No gap analysis data found. Run POST to trigger analysis.' },
      { status: 404 }
    );
  }

  const summary = buildSummary(results);

  return json({
    siteId,
    ...summary,
    results,
  });
};

/**
 * POST /api/gap-analysis/:siteId
 * Triggers gap analysis — compares existing pages against taxonomy benchmarks.
 * Clears previous results and re-computes (idempotent).
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const results = analyzeGaps(siteId);

    if (results.length === 0) {
      return json(
        {
          siteId,
          totalGaps: 0,
          results: [],
          message: 'No taxonomy data or site pages found. Seed taxonomy and run scraping pipeline first.',
        },
        { status: 404 }
      );
    }

    const summary = buildSummary(results);

    return json({
      siteId,
      ...summary,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Gap analysis failed: ${message}` }, { status: 500 });
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface GapResultLike {
  status: string;
  seoGapScore: number;
  geoGapScore: number;
  schemaGapScore: number;
  designGapScore: number;
  contentGapScore: number;
}

function buildSummary(results: GapResultLike[]) {
  const totalGaps = results.length;
  const missing = results.filter((r) => r.status === 'missing').length;
  const weak = results.filter((r) => r.status === 'weak').length;
  const adequate = results.filter((r) => r.status === 'adequate').length;
  const strong = results.filter((r) => r.status === 'strong').length;

  const avgSeoGap = results.reduce((s, r) => s + r.seoGapScore, 0) / totalGaps;
  const avgGeoGap = results.reduce((s, r) => s + r.geoGapScore, 0) / totalGaps;
  const avgSchemaGap = results.reduce((s, r) => s + r.schemaGapScore, 0) / totalGaps;
  const avgDesignGap = results.reduce((s, r) => s + r.designGapScore, 0) / totalGaps;
  const avgContentGap = results.reduce((s, r) => s + r.contentGapScore, 0) / totalGaps;

  return {
    totalGaps,
    statusBreakdown: { missing, weak, adequate, strong },
    averageGapScores: {
      seo: parseFloat(avgSeoGap.toFixed(3)),
      geo: parseFloat(avgGeoGap.toFixed(3)),
      schema: parseFloat(avgSchemaGap.toFixed(3)),
      design: parseFloat(avgDesignGap.toFixed(3)),
      content: parseFloat(avgContentGap.toFixed(3)),
    },
  };
}
