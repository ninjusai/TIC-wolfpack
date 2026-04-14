import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

interface SiteRow {
  id: number;
  name: string;
  url: string;
  slug: string;
  pipeline_stage: string;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface AvgRow {
  avg_seo: number | null;
  avg_geo: number | null;
  avg_schema: number | null;
}

interface BacklogRow {
  status: string;
  count: number;
}

interface BlueprintRow {
  total: number;
  approved: number;
}

/**
 * GET /api/site/:siteId/summary
 * Returns page count, audit score averages, backlog stats, blueprint stats.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    // Get site info
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) as SiteRow | undefined;
    if (!site) {
      return json({ error: `Site ${siteId} not found` }, { status: 404 });
    }

    // Page count
    const pageCount = db
      .prepare('SELECT COUNT(*) as count FROM pages WHERE site_id = ?')
      .get(siteId) as CountRow;

    // Audit score averages
    const auditAvg = db
      .prepare(
        `SELECT
          AVG(seo_score) as avg_seo,
          AVG(geo_score) as avg_geo,
          AVG(schema_score) as avg_schema
        FROM content_audit
        WHERE site_id = ?`
      )
      .get(siteId) as AvgRow;

    // Backlog stats by status
    const backlogRows = db
      .prepare(
        `SELECT status, COUNT(*) as count
        FROM work_backlog
        WHERE site_id = ?
        GROUP BY status`
      )
      .all(siteId) as BacklogRow[];

    const backlog: Record<string, number> = {};
    let backlogTotal = 0;
    for (const row of backlogRows) {
      backlog[row.status] = row.count;
      backlogTotal += row.count;
    }

    // Blueprint stats
    const blueprintStats = db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN user_approved = 1 THEN 1 ELSE 0 END) as approved
        FROM page_blueprints
        WHERE site_id = ?`
      )
      .get(siteId) as BlueprintRow;

    // Recent activity: latest section specs with status changes
    const recentActivity = db
      .prepare(
        `SELECT ss.section_type, ss.status, ss.heading_text, ss.created_at, pb.working_title
        FROM section_specs ss
        JOIN page_blueprints pb ON ss.blueprint_id = pb.id
        WHERE pb.site_id = ?
        ORDER BY ss.created_at DESC
        LIMIT 10`
      )
      .all(siteId);

    return json({
      siteId: site.id,
      siteName: site.name,
      siteUrl: site.url,
      slug: site.slug,
      pipelineStage: site.pipeline_stage,
      pageCount: pageCount.count,
      auditScores: {
        seo: auditAvg.avg_seo !== null ? Math.round(auditAvg.avg_seo * 10) / 10 : null,
        geo: auditAvg.avg_geo !== null ? Math.round(auditAvg.avg_geo * 10) / 10 : null,
        schema: auditAvg.avg_schema !== null ? Math.round(auditAvg.avg_schema * 10) / 10 : null
      },
      backlog: {
        total: backlogTotal,
        byStatus: backlog
      },
      blueprints: {
        total: blueprintStats.total,
        approved: blueprintStats.approved
      },
      recentActivity
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to fetch site summary: ${message}` }, { status: 500 });
  }
};
