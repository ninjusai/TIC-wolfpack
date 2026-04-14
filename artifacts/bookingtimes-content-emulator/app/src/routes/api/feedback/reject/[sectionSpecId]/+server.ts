import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rejectSection } from '$lib/server/feedback-engine';

/**
 * POST /api/feedback/reject/:sectionSpecId
 * Reject a generated section with a reason.
 *
 * Body: { reason: string }
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const sectionSpecId = parseInt(params.sectionSpecId, 10);

  if (isNaN(sectionSpecId)) {
    return json({ error: 'Invalid sectionSpecId parameter' }, { status: 400 });
  }

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return json({ error: 'reason is required and must be a non-empty string' }, { status: 400 });
  }

  try {
    rejectSection(sectionSpecId, body.reason.trim());
    return json({ success: true, sectionSpecId, action: 'rejected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return json({ error: message }, { status: 404 });
    }
    return json({ error: `Rejection failed: ${message}` }, { status: 500 });
  }
};
