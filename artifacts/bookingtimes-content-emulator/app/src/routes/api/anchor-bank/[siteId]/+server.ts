import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAnchorBank, getAnchorBank } from '$lib/server/anchor-bank';

/**
 * GET /api/anchor-bank/:siteId
 * Returns the current anchor text bank for a site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const entries = getAnchorBank(siteId);

    if (entries.length === 0) {
      return json(
        {
          siteId,
          totalEntries: 0,
          entries: [],
          message: 'No anchor bank data found. Run POST to generate the anchor bank.',
        },
        { status: 404 }
      );
    }

    // Summarise by variant type
    const byVariantType: Record<string, number> = {};
    const targetUrls = new Set<string>();
    for (const entry of entries) {
      byVariantType[entry.variantType] = (byVariantType[entry.variantType] || 0) + 1;
      targetUrls.add(entry.targetUrl);
    }

    return json({
      siteId,
      totalEntries: entries.length,
      targets: targetUrls.size,
      byVariantType,
      entries,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve anchor bank: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/anchor-bank/:siteId
 * Triggers anchor text bank generation for a site.
 * Clears existing bank and rebuilds from current pages.
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = generateAnchorBank(siteId);

    return json({
      ...result,
      message: `Anchor bank generated: ${result.totalEntries} entries across ${result.targets} target pages.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Anchor bank generation failed: ${message}` }, { status: 500 });
  }
};
