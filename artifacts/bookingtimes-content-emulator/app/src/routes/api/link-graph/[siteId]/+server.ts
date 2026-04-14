import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildLinkGraph, getLinkGraph } from '$lib/server/link-graph';

/**
 * GET /api/link-graph/:siteId
 * Returns the current internal link graph for a site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const links = getLinkGraph(siteId);

    if (links.length === 0) {
      return json(
        {
          siteId,
          totalEdges: 0,
          links: [],
          message: 'No link graph data found. Run POST to build the link graph.',
        },
        { status: 404 }
      );
    }

    // Summarise by link type
    const byType: Record<string, number> = {};
    for (const link of links) {
      byType[link.link_type] = (byType[link.link_type] || 0) + 1;
    }

    return json({
      siteId,
      totalEdges: links.length,
      byType,
      links,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve link graph: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/link-graph/:siteId
 * Triggers link graph construction for a site.
 * Clears existing graph and rebuilds from current pages and silo definitions.
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = buildLinkGraph(siteId);

    return json({
      ...result,
      message: result.valid
        ? 'Link graph built successfully — all validations passed.'
        : `Link graph built with ${result.issues.length} issue(s).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Link graph construction failed: ${message}` }, { status: 500 });
  }
};
