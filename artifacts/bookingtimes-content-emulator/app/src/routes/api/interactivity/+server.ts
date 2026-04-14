import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  generateInteractiveElement,
  generateInteractivityForBlueprint,
  getAllInteractiveTypes,
  getHeadJsForPage,
} from '$lib/server/interactivity-engine';

/**
 * GET /api/interactivity
 * Returns all available interactive element types with tier and description.
 *
 * Optional query param: ?blueprintId=N — returns the combined head JS for that blueprint.
 */
export const GET: RequestHandler = ({ url }) => {
  const blueprintIdParam = url.searchParams.get('blueprintId');

  // If blueprintId is provided, return the head JS for that blueprint
  if (blueprintIdParam) {
    const blueprintId = parseInt(blueprintIdParam, 10);
    if (isNaN(blueprintId)) {
      return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
    }

    try {
      const headJs = getHeadJsForPage(blueprintId);
      if (!headJs) {
        return json(
          {
            blueprintId,
            headJs: null,
            message: 'No interactive elements found for this blueprint.',
          },
          { status: 404 }
        );
      }
      return json({ blueprintId, headJs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: `Failed to generate head JS: ${message}` }, { status: 500 });
    }
  }

  // Default: return all available interactive types
  const types = getAllInteractiveTypes();
  return json({
    totalTypes: types.length,
    types,
  });
};

/**
 * POST /api/interactivity
 * Generate interactive elements.
 *
 * Two modes:
 *   1. Blueprint mode: { blueprintId: number }
 *      Generates interactivity for all eligible sections of the blueprint.
 *
 *   2. Single element mode: { type: string, content: any }
 *      Generates a single interactive element by type.
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: { type?: string; content?: unknown; blueprintId?: number };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  // Mode 1: Blueprint-level interactivity generation
  if (body.blueprintId !== undefined) {
    const blueprintId =
      typeof body.blueprintId === 'string'
        ? parseInt(body.blueprintId, 10)
        : body.blueprintId;

    if (typeof blueprintId !== 'number' || isNaN(blueprintId)) {
      return json({ error: 'Invalid "blueprintId" — must be a number.' }, { status: 400 });
    }

    try {
      const result = generateInteractivityForBlueprint(blueprintId);

      const generatedCount = result.generated.length;
      const message =
        generatedCount > 0
          ? `Generated ${generatedCount} interactive element(s) for blueprint #${blueprintId}.`
          : `No new interactive elements generated for blueprint #${blueprintId}. ${result.skipped.length} section(s) skipped.`;

      return json({
        ...result,
        message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: `Interactivity generation failed: ${message}` }, { status: 500 });
    }
  }

  // Mode 2: Single element generation
  const { type, content } = body;

  if (!type || typeof type !== 'string') {
    return json(
      { error: 'Missing or invalid "type" field. Provide { blueprintId } for blueprint mode, or { type, content } for single element mode.' },
      { status: 400 }
    );
  }

  if (content === undefined || content === null) {
    return json({ error: 'Missing "content" field.' }, { status: 400 });
  }

  try {
    const element = generateInteractiveElement(type, content);
    return json({ element });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, { status: 400 });
  }
};
