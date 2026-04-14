import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

/**
 * GET /api/site/:siteId/step-status
 *
 * Returns completion status for ALL workflow steps across all pipeline stages.
 * Each step is considered "done" if the relevant DB table has rows for this site.
 *
 * Used by Site Detail, Pipeline, and Blueprints pages to persist step completion
 * across page reloads.
 */

interface CountResult {
  count: number;
}

export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const count = (table: string, where?: string): number => {
      const clause = where ?? `site_id = ?`;
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE ${clause}`).get(siteId) as CountResult;
      return row?.count ?? 0;
    };

    // Helper: count with an additional condition
    const countWhere = (table: string, extraCondition: string): number => {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE site_id = ? AND ${extraCondition}`).get(siteId) as CountResult;
      return row?.count ?? 0;
    };

    // -----------------------------------------------------------------------
    // Stage 1: Site Audit & Inventory
    // -----------------------------------------------------------------------
    const cssAuditCount = count('css_audit');
    const cssClassifiedCount = countWhere('css_audit', 'tier IS NOT NULL');
    const contentAuditCount = count('content_audit');
    const structureMapCount = count('site_structure_map');
    const brandProfileCount = count('brand_profiles');
    const seoAuditCount = countWhere('content_audit', 'seo_score IS NOT NULL');
    const geoAuditCount = countWhere('content_audit', 'geo_score IS NOT NULL');
    const schemaAuditCount = count('schema_audit');

    // -----------------------------------------------------------------------
    // Stage 2: Benchmark Research
    // Note: benchmark_standards and page_taxonomy are global (no site_id column)
    // -----------------------------------------------------------------------
    const seoBenchmarkGlobal = (db.prepare(`SELECT COUNT(*) as count FROM benchmark_standards WHERE category = 'seo'`).get() as CountResult)?.count ?? 0;
    const geoBenchmarkGlobal = (db.prepare(`SELECT COUNT(*) as count FROM benchmark_standards WHERE category = 'geo'`).get() as CountResult)?.count ?? 0;
    const schemaBenchmarkGlobal = (db.prepare(`SELECT COUNT(*) as count FROM benchmark_standards WHERE category = 'schema'`).get() as CountResult)?.count ?? 0;
    const taxonomyCount = (db.prepare(`SELECT COUNT(*) as count FROM page_taxonomy`).get() as CountResult)?.count ?? 0;

    // -----------------------------------------------------------------------
    // Stage 3: Gap Analysis
    // -----------------------------------------------------------------------
    const gapAnalysisCount = count('gap_analysis');
    const workBacklogCount = count('work_backlog');
    const linkGraphCount = count('internal_link_graph');
    const anchorBankCount = count('anchor_text_bank');

    // -----------------------------------------------------------------------
    // Stage 4: Design & Architecture
    // -----------------------------------------------------------------------
    const blueprintCount = count('page_blueprints');
    const sectionSpecCount = (db.prepare(
      `SELECT COUNT(*) as count FROM section_specs ss
       JOIN page_blueprints pb ON ss.blueprint_id = pb.id
       WHERE pb.site_id = ?`
    ).get(siteId) as CountResult)?.count ?? 0;
    const cssDecisionCount = count('css_decisions');
    const jsonldSpecCount = countWhere('page_blueprints', 'schema_spec IS NOT NULL');

    // -----------------------------------------------------------------------
    // Build response
    // -----------------------------------------------------------------------
    const steps: Record<string, boolean> = {
      // Stage 1
      'scrape-css': cssAuditCount > 0,
      'classify-css': cssClassifiedCount > 0,
      'scrape-content': contentAuditCount > 0,
      'inventory': structureMapCount > 0,
      'brand-infer': brandProfileCount > 0,
      'seo-audit': seoAuditCount > 0,
      'geo-audit': geoAuditCount > 0,
      'schema-audit': schemaAuditCount > 0,

      // Stage 2 (pipeline page)
      's2-seo': seoBenchmarkGlobal > 0,
      's2-geo': geoBenchmarkGlobal > 0,
      's2-schema': schemaBenchmarkGlobal > 0,
      's2-taxonomy': taxonomyCount > 0,

      // Stage 3 (pipeline page)
      's3-gap': gapAnalysisCount > 0,
      's3-backlog': workBacklogCount > 0,
      's3-linkgraph': linkGraphCount > 0,
      's3-anchor': anchorBankCount > 0,

      // Stage 4 (blueprints page)
      'blueprints': blueprintCount > 0,
      'section-specs': sectionSpecCount > 0,
      'css-decisions': cssDecisionCount > 0,
      'jsonld-specs': jsonldSpecCount > 0,
    };

    // Also provide counts for UI detail if needed
    const counts: Record<string, number> = {
      cssAudit: cssAuditCount,
      cssClassified: cssClassifiedCount,
      contentAudit: contentAuditCount,
      structureMap: structureMapCount,
      brandProfile: brandProfileCount,
      seoAudit: seoAuditCount,
      geoAudit: geoAuditCount,
      schemaAudit: schemaAuditCount,
      seoBenchmarks: seoBenchmarkGlobal,
      geoBenchmarks: geoBenchmarkGlobal,
      schemaBenchmarks: schemaBenchmarkGlobal,
      taxonomy: taxonomyCount,
      gapAnalysis: gapAnalysisCount,
      workBacklog: workBacklogCount,
      linkGraph: linkGraphCount,
      anchorBank: anchorBankCount,
      blueprints: blueprintCount,
      sectionSpecs: sectionSpecCount,
      cssDecisions: cssDecisionCount,
      jsonldSpecs: jsonldSpecCount,
    };

    return json({ siteId, steps, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to compute step status: ${message}` }, { status: 500 });
  }
};
