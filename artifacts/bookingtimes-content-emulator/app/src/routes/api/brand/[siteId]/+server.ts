import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrandProfile, updateBrandProfile } from '$lib/server/brand-inference';

/**
 * GET /api/brand/:siteId
 * Returns the current brand profile for the given site.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  const profile = getBrandProfile(siteId);

  if (!profile) {
    return json(
      { error: `No brand profile found for site ${siteId}. Run inference first.` },
      { status: 404 }
    );
  }

  return json({ profile });
};

/**
 * PUT /api/brand/:siteId
 * Updates the brand profile with operator edits.
 * Accepts a partial BrandProfile in the request body.
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  let updates: Record<string, unknown>;
  try {
    updates = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    updateBrandProfile(siteId, updates);
    const profile = getBrandProfile(siteId);
    return json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('No brand profile exists')) {
      return json({ error: message }, { status: 404 });
    }
    return json({ error: `Update failed: ${message}` }, { status: 500 });
  }
};
