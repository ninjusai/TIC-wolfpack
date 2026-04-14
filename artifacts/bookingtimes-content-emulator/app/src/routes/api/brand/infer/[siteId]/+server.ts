import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { inferBrandVoice } from '$lib/server/brand-inference';

/**
 * POST /api/brand/infer/:siteId
 * Triggers brand voice inference for the given site.
 * Gathers content_audit data, calls Claude for analysis,
 * and stores the resulting brand profile.
 */
export const POST: RequestHandler = async ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const profile = await inferBrandVoice(siteId);

    const response: Record<string, unknown> = { profile };

    if (profile.inferenceConfidence < 0.5) {
      response.warning =
        `Low confidence (${(profile.inferenceConfidence * 100).toFixed(0)}%). ` +
        `Only ${profile.sourcePageCount} page(s) available. ` +
        'Consider scraping more pages for a more accurate brand profile.';
    }

    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Distinguish "no data" errors from unexpected failures
    if (message.includes('not found') || message.includes('No content audit data')) {
      return json({ error: message }, { status: 404 });
    }

    return json({ error: `Brand inference failed: ${message}` }, { status: 500 });
  }
};
