import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { markAsDeployed } from '$lib/server/freshness-tracker';

/**
 * POST /api/freshness/deploy
 * Body: { siteId: number, pageUrl: string }
 * Marks a page as deployed and recomputes its freshness status.
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: { siteId?: number; pageUrl?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { siteId, pageUrl } = body;

  if (typeof siteId !== 'number' || isNaN(siteId)) {
    return json({ error: 'Missing or invalid siteId (must be a number)' }, { status: 400 });
  }

  if (typeof pageUrl !== 'string' || pageUrl.trim().length === 0) {
    return json({ error: 'Missing or invalid pageUrl (must be a non-empty string)' }, { status: 400 });
  }

  try {
    markAsDeployed(siteId, pageUrl);

    return json({
      success: true,
      siteId,
      pageUrl,
      message: 'Page marked as deployed. Freshness status updated.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to mark as deployed: ${message}` }, { status: 500 });
  }
};
