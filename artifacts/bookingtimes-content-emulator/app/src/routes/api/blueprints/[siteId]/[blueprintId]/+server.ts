/**
 * Blueprint Detail API — WRK-BCE2-032
 *
 * GET  /api/blueprints/:siteId/:blueprintId — Single blueprint with section_specs, CSS decisions, links
 * PUT  /api/blueprints/:siteId/:blueprintId — Update blueprint fields (operator adjustments)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getBlueprint: db.prepare(`
    SELECT pb.*, wb.page_type, wb.action, wb.priority, wb.target_url AS backlog_target_url
    FROM page_blueprints pb
    JOIN work_backlog wb ON pb.backlog_id = wb.id
    WHERE pb.id = ? AND pb.site_id = ?
  `),

  getSectionSpecs: db.prepare(`
    SELECT id, blueprint_id, section_type, section_order, heading_text,
           target_word_count_min, target_word_count_max,
           cta_required, cta_text, content_requirements,
           links_required, direct_answer_block_required,
           statistics_required, faq_questions, css_classes,
           design_pattern, status, generated_html
    FROM section_specs
    WHERE blueprint_id = ?
    ORDER BY section_order ASC
  `),

  getCssDecisions: db.prepare(`
    SELECT id, decision_type, class_name, replacement_class, rationale
    FROM css_decisions
    WHERE site_id = ?
  `),

  updateBlueprint: db.prepare(`
    UPDATE page_blueprints
    SET working_title = COALESCE(?, working_title),
        h1_text = COALESCE(?, h1_text),
        meta_title = COALESCE(?, meta_title),
        meta_description = COALESCE(?, meta_description),
        canonical_url = COALESCE(?, canonical_url),
        page_level_seo_rules = COALESCE(?, page_level_seo_rules),
        page_level_geo_rules = COALESCE(?, page_level_geo_rules),
        page_level_voice_rules = COALESCE(?, page_level_voice_rules)
    WHERE id = ? AND site_id = ?
  `),
};

// ── Handlers ────────────────────────────────────────────────────────────────

export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(siteId) || isNaN(blueprintId)) {
    return json({ error: 'Invalid siteId or blueprintId parameter' }, { status: 400 });
  }

  try {
    const blueprint = stmts.getBlueprint.get(blueprintId, siteId) as Record<string, unknown> | undefined;

    if (!blueprint) {
      return json({ error: 'Blueprint not found' }, { status: 404 });
    }

    const sectionSpecs = stmts.getSectionSpecs.all(blueprintId) as Record<string, unknown>[];
    const cssDecisions = stmts.getCssDecisions.all(siteId) as Record<string, unknown>[];

    // Parse JSON fields for convenience
    const parsed = {
      ...blueprint,
      page_level_seo_rules: safeJsonParse(blueprint.page_level_seo_rules as string | null),
      page_level_geo_rules: safeJsonParse(blueprint.page_level_geo_rules as string | null),
      page_level_voice_rules: safeJsonParse(blueprint.page_level_voice_rules as string | null),
      page_level_css_rules: safeJsonParse(blueprint.page_level_css_rules as string | null),
      target_keywords: safeJsonParse(blueprint.target_keywords as string | null),
      internal_links_required: safeJsonParse(blueprint.internal_links_required as string | null),
      internal_links_optional: safeJsonParse(blueprint.internal_links_optional as string | null),
      breadcrumb_path: safeJsonParse(blueprint.breadcrumb_path as string | null),
      schema_spec: safeJsonParse(blueprint.schema_spec as string | null),
      section_order: safeJsonParse(blueprint.section_order as string | null),
      coherence_requirements: safeJsonParse(blueprint.coherence_requirements as string | null),
    };

    // Parse JSON fields in section specs
    const parsedSpecs = sectionSpecs.map((spec) => ({
      ...spec,
      links_required: safeJsonParse(spec.links_required as string | null),
      faq_questions: safeJsonParse(spec.faq_questions as string | null),
      css_classes: safeJsonParse(spec.css_classes as string | null),
      content_requirements: safeJsonParse(spec.content_requirements as string | null),
    }));

    return json({
      blueprint: parsed,
      sectionSpecs: parsedSpecs,
      cssDecisions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve blueprint: ${message}` }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const siteId = parseInt(params.siteId, 10);
  const blueprintId = parseInt(params.blueprintId, 10);

  if (isNaN(siteId) || isNaN(blueprintId)) {
    return json({ error: 'Invalid siteId or blueprintId parameter' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const result = stmts.updateBlueprint.run(
      (body.working_title as string) ?? null,
      (body.h1_text as string) ?? null,
      (body.meta_title as string) ?? null,
      (body.meta_description as string) ?? null,
      (body.canonical_url as string) ?? null,
      body.page_level_seo_rules ? JSON.stringify(body.page_level_seo_rules) : null,
      body.page_level_geo_rules ? JSON.stringify(body.page_level_geo_rules) : null,
      body.page_level_voice_rules ? JSON.stringify(body.page_level_voice_rules) : null,
      blueprintId,
      siteId
    );

    if (result.changes === 0) {
      return json({ error: 'Blueprint not found or no changes made' }, { status: 404 });
    }

    return json({ message: 'Blueprint updated successfully', blueprintId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to update blueprint: ${message}` }, { status: 500 });
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeJsonParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
