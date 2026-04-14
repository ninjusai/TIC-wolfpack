import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refineSection } from '$lib/server/feedback-engine';

/**
 * POST /api/feedback/refine/:sectionSpecId
 * Provide feedback for regeneration of a section.
 *
 * Body: { feedback: string }
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const sectionSpecId = parseInt(params.sectionSpecId, 10);

  if (isNaN(sectionSpecId)) {
    return json({ error: 'Invalid sectionSpecId parameter' }, { status: 400 });
  }

  let body: { feedback?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.feedback || typeof body.feedback !== 'string' || body.feedback.trim().length === 0) {
    return json({ error: 'feedback is required and must be a non-empty string' }, { status: 400 });
  }

  try {
    refineSection(sectionSpecId, body.feedback.trim());
    return json({ success: true, sectionSpecId, action: 'refined' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return json({ error: message }, { status: 404 });
    }
    return json({ error: `Refinement failed: ${message}` }, { status: 500 });
  }
};
