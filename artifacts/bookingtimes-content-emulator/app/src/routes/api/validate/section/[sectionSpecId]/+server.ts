import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';
import { validateSectionHtml } from '$lib/server/html-validator';

interface SectionSpecRow {
  id: number;
  blueprint_id: number;
  generated_html: string | null;
}

interface BlueprintRow {
  site_id: number;
}

/**
 * POST /api/validate/section/:sectionSpecId
 *
 * Validates the generated HTML for a section spec.
 * If the section has generated_html stored, validates that.
 * Alternatively, pass { html } in the request body to validate arbitrary HTML.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const sectionSpecId = parseInt(params.sectionSpecId, 10);

  if (isNaN(sectionSpecId)) {
    return json({ error: 'Invalid sectionSpecId parameter' }, { status: 400 });
  }

  // Look up the section spec
  const spec = db.prepare(
    'SELECT id, blueprint_id, generated_html FROM section_specs WHERE id = ?'
  ).get(sectionSpecId) as SectionSpecRow | undefined;

  if (!spec) {
    return json({ error: `Section spec ${sectionSpecId} not found` }, { status: 404 });
  }

  // Get site_id from blueprint
  const blueprint = db.prepare(
    'SELECT site_id FROM page_blueprints WHERE id = ?'
  ).get(spec.blueprint_id) as BlueprintRow | undefined;

  if (!blueprint) {
    return json({ error: `Blueprint ${spec.blueprint_id} not found for section spec` }, { status: 404 });
  }

  // Determine HTML to validate: body override or stored generated_html
  let html: string | null = null;

  try {
    const body = await request.json();
    if (body && typeof body.html === 'string') {
      html = body.html;
    }
  } catch {
    // No body or invalid JSON — use stored HTML
  }

  if (!html) {
    html = spec.generated_html;
  }

  if (!html) {
    return json(
      { error: `Section spec ${sectionSpecId} has no generated HTML to validate` },
      { status: 422 }
    );
  }

  try {
    const result = validateSectionHtml(html, blueprint.site_id, sectionSpecId);
    return json({
      sectionSpecId,
      siteId: blueprint.site_id,
      blueprintId: spec.blueprint_id,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Validation failed: ${message}` }, { status: 500 });
  }
};
