import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { approveSection } from '$lib/server/feedback-engine';

/**
 * POST /api/feedback/approve/:sectionSpecId
 * Approve a generated section. Optionally include a quality rating (1-5).
 *
 * Body: { qualityRating?: number }
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const sectionSpecId = parseInt(params.sectionSpecId, 10);

  if (isNaN(sectionSpecId)) {
    return json({ error: 'Invalid sectionSpecId parameter' }, { status: 400 });
  }

  let body: { qualityRating?: number } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.qualityRating !== undefined) {
    if (typeof body.qualityRating !== 'number' || body.qualityRating < 1 || body.qualityRating > 5) {
      return json({ error: 'qualityRating must be a number between 1 and 5' }, { status: 400 });
    }
  }

  try {
    approveSection(sectionSpecId, body.qualityRating);
    return json({ success: true, sectionSpecId, action: 'approved' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return json({ error: message }, { status: 404 });
    }
    return json({ error: `Approval failed: ${message}` }, { status: 500 });
  }
};
