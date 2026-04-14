import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSectionSpecs, getSectionSpecs } from '$lib/server/section-spec-generator';

/**
 * GET /api/section-specs/:blueprintId
 * Returns existing section specs for the given blueprint.
 */
export const GET: RequestHandler = ({ params }) => {
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(blueprintId)) {
    return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
  }

  try {
    const specs = getSectionSpecs(blueprintId);

    if (specs.length === 0) {
      return json(
        {
          blueprintId,
          totalSpecs: 0,
          specs: [],
          message: 'No section specs found. Run POST to generate specs for this blueprint.',
        },
        { status: 404 }
      );
    }

    return json({
      blueprintId,
      totalSpecs: specs.length,
      specs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve section specs: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/section-specs/:blueprintId
 * Generates section specs for the given blueprint.
 * Clears and regenerates existing specs (idempotent).
 */
export const POST: RequestHandler = ({ params }) => {
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(blueprintId)) {
    return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
  }

  try {
    const result = generateSectionSpecs(blueprintId);

    return json({
      ...result,
      message: result.sectionsCreated > 0
        ? `Generated ${result.sectionsCreated} section spec(s) for blueprint ${blueprintId}.`
        : 'No sections generated.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Section spec generation failed: ${message}` }, { status: 500 });
  }
};
