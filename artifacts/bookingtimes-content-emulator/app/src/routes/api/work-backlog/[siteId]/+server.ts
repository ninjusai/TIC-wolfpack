import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { identifyMissingPages, getWorkBacklog } from '$lib/server/missing-pages';

/**
 * GET /api/work-backlog/:siteId
 * Returns current work_backlog entries for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const backlog = getWorkBacklog(siteId);

  if (backlog.length === 0) {
    return json(
      {
        siteId,
        totalItems: 0,
        backlog: [],
        message: 'No work backlog items found. Run POST to trigger missing page identification.',
      },
      { status: 404 }
    );
  }

  const summary = buildSummary(backlog);

  return json({
    siteId,
    ...summary,
    backlog,
  });
};

/**
 * POST /api/work-backlog/:siteId
 * Triggers missing page identification and creates work_backlog entries.
 * Clears previous backlog and re-computes (idempotent).
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const result = identifyMissingPages(siteId);

    return json({
      siteId,
      missingPages: result.missingPages,
      weakPages: result.weakPages,
      backlogItemsCreated: result.backlogItemsCreated,
      message: result.backlogItemsCreated > 0
        ? `Identified ${result.missingPages.length} missing page(s) and ${result.weakPages.length} weak page(s). Created ${result.backlogItemsCreated} backlog item(s).`
        : 'No missing or weak pages detected — site structure matches taxonomy.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Missing page identification failed: ${message}` }, { status: 500 });
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BacklogItemLike {
  action: string;
  status: string;
  page_type: string;
}

function buildSummary(backlog: BacklogItemLike[]) {
  const totalItems = backlog.length;
  const byAction = {
    create: backlog.filter((b) => b.action === 'create').length,
    improve: backlog.filter((b) => b.action === 'improve').length,
    rewrite: backlog.filter((b) => b.action === 'rewrite').length,
  };
  const byStatus = {
    pending: backlog.filter((b) => b.status === 'pending').length,
    blueprinted: backlog.filter((b) => b.status === 'blueprinted').length,
    in_progress: backlog.filter((b) => b.status === 'in_progress').length,
    generated: backlog.filter((b) => b.status === 'generated').length,
    approved: backlog.filter((b) => b.status === 'approved').length,
    skipped: backlog.filter((b) => b.status === 'skipped').length,
  };

  // Unique page types in the backlog
  const pageTypes = [...new Set(backlog.map((b) => b.page_type))];

  return {
    totalItems,
    byAction,
    byStatus,
    pageTypes,
  };
}
