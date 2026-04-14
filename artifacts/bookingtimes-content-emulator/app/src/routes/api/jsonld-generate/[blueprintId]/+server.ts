import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateJsonLd, validateJsonLd } from '$lib/server/jsonld-generator';
import db from '$lib/db';

/**
 * GET /api/jsonld-generate/:blueprintId
 * Returns existing generated JSON-LD for the blueprint (from schema_spec after resolution).
 * If schema_spec exists, resolves and returns it; otherwise 404.
 */
export const GET: RequestHandler = ({ params }) => {
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(blueprintId)) {
    return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
  }

  try {
    const result = generateJsonLd(blueprintId);

    if (!result.jsonLd) {
      return json(
        {
          blueprintId,
          valid: false,
          jsonLd: null,
          message: 'No JSON-LD available. Run POST to generate.',
        },
        { status: 404 }
      );
    }

    // Parse for display
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(result.jsonLd);
    } catch {
      // Return raw string if parse fails
    }

    return json({
      blueprintId: result.blueprintId,
      valid: result.valid,
      schemaTypes: result.schemaTypes,
      validationErrors: result.validationErrors,
      jsonLd: parsed || result.jsonLd,
      scriptTag: `<script type="application/ld+json">\n${result.jsonLd}\n</script>`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve JSON-LD: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/jsonld-generate/:blueprintId
 * Generates resolved JSON-LD for the blueprint by:
 *   1. Loading the schema_spec template
 *   2. Resolving all template variables
 *   3. Resolving FAQ content from generated HTML
 *   4. Validating the result
 *   5. Returning the ready-to-embed script tag
 */
export const POST: RequestHandler = ({ params }) => {
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(blueprintId)) {
    return json({ error: 'Invalid blueprintId parameter' }, { status: 400 });
  }

  try {
    const result = generateJsonLd(blueprintId);

    if (!result.jsonLd) {
      return json(
        {
          blueprintId,
          valid: false,
          validationErrors: result.validationErrors,
          message: 'Could not generate JSON-LD. Check errors.',
        },
        { status: 422 }
      );
    }

    // Parse for display
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(result.jsonLd);
    } catch {
      // Return raw if parse fails
    }

    return json({
      blueprintId: result.blueprintId,
      valid: result.valid,
      schemaTypes: result.schemaTypes,
      validationErrors: result.validationErrors,
      jsonLd: parsed || result.jsonLd,
      scriptTag: `<script type="application/ld+json">\n${result.jsonLd}\n</script>`,
      message: result.valid
        ? `JSON-LD generated successfully with ${result.schemaTypes.length} schema type(s).`
        : `JSON-LD generated with ${result.validationErrors.length} validation error(s).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `JSON-LD generation failed: ${message}` }, { status: 500 });
  }
};
