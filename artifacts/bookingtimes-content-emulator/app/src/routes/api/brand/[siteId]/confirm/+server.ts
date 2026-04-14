import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { confirmBrandProfile, getBrandProfile } from '$lib/server/brand-inference';

/**
 * POST /api/brand/:siteId/confirm
 * Marks the brand profile as confirmed by the operator.
 */
export const POST: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    confirmBrandProfile(siteId);
    const profile = getBrandProfile(siteId);
    return json({ profile, confirmed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('No brand profile exists')) {
      return json({ error: message }, { status: 404 });
    }
    return json({ error: `Confirm failed: ${message}` }, { status: 500 });
  }
};
