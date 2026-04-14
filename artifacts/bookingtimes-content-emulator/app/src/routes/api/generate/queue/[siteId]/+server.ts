import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

interface QueueItem {
  blueprintId: number;
  pageType: string;
  title: string;
  priority: number;
  status: 'pending' | 'generating' | 'generated' | 'approved';
  locked: boolean;
  lockReason: string | null;
  sectionTotal: number;
  sectionsDone: number;
}

interface QueueResponse {
  siteId: number;
  homepageStatus: 'pending' | 'generating' | 'generated' | 'approved' | 'missing';
  approvedSuburbCount: number;
  batchUnlockThreshold: number;
  batchUnlocked: boolean;
  queue: QueueItem[];
}

// ── Row types from DB ───────────────────────────────────────────────────────

interface BlueprintRow {
  bp_id: number;
  page_type: string;
  working_title: string | null;
  priority: number;
  user_approved: number;
  wb_status: string;
  section_total: number;
  sections_generated: number;
  sections_approved: number;
}

// ── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
  /**
   * Fetch all blueprints for a site, joined with work_backlog for page_type
   * and status, plus section_specs aggregates. Ordered: homepage first, then
   * by priority ascending.
   */
  getQueue: db.prepare(`
    SELECT
      pb.id               AS bp_id,
      wb.page_type         AS page_type,
      pb.working_title     AS working_title,
      wb.priority          AS priority,
      pb.user_approved     AS user_approved,
      wb.status            AS wb_status,
      COALESCE(pb.section_count, 0) AS section_total,
      COALESCE(sec_agg.generated, 0) AS sections_generated,
      COALESCE(sec_agg.approved, 0) AS sections_approved
    FROM page_blueprints pb
    JOIN work_backlog wb ON wb.id = pb.backlog_id
    LEFT JOIN (
      SELECT
        blueprint_id,
        SUM(CASE WHEN status IN ('generated', 'approved') THEN 1 ELSE 0 END) AS generated,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
      FROM section_specs
      GROUP BY blueprint_id
    ) sec_agg ON sec_agg.blueprint_id = pb.id
    WHERE pb.site_id = ?
    ORDER BY
      CASE WHEN wb.page_type = 'homepage' THEN 0 ELSE 1 END,
      wb.priority ASC
  `),
};

const BATCH_UNLOCK_THRESHOLD = 3;

/**
 * GET /api/generate/queue/:siteId
 *
 * Returns the generation queue for a site with lock status per blueprint.
 * Enforces DEC-031: homepage-first workflow.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);
  if (isNaN(siteId)) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const rows = stmts.getQueue.all(siteId) as BlueprintRow[];

    // ── Determine homepage status ─────────────────────────────────────────

    const homepageRow = rows.find((r) => r.page_type === 'homepage');
    let homepageStatus: QueueResponse['homepageStatus'] = 'missing';

    if (homepageRow) {
      if (homepageRow.user_approved === 1 && homepageRow.wb_status === 'approved') {
        homepageStatus = 'approved';
      } else if (
        homepageRow.wb_status === 'generated' ||
        homepageRow.sections_generated > 0
      ) {
        homepageStatus = 'generated';
      } else if (homepageRow.wb_status === 'in_progress') {
        homepageStatus = 'generating';
      } else {
        homepageStatus = 'pending';
      }
    }

    // ── Count approved suburb/location pages ──────────────────────────────

    const approvedSuburbCount = rows.filter(
      (r) => r.page_type === 'location' && r.user_approved === 1 && r.wb_status === 'approved'
    ).length;

    const batchUnlocked = approvedSuburbCount >= BATCH_UNLOCK_THRESHOLD;

    // ── Build queue items with lock logic ─────────────────────────────────

    const queue: QueueItem[] = rows.map((row) => {
      let status: QueueItem['status'] = 'pending';
      if (row.user_approved === 1 && row.wb_status === 'approved') {
        status = 'approved';
      } else if (
        row.wb_status === 'generated' ||
        row.sections_generated > 0
      ) {
        status = 'generated';
      } else if (row.wb_status === 'in_progress') {
        status = 'generating';
      }

      let locked = false;
      let lockReason: string | null = null;

      // Homepage is never locked
      if (row.page_type !== 'homepage') {
        if (homepageStatus === 'missing' || homepageStatus === 'pending') {
          locked = true;
          lockReason = 'Generate homepage first';
        } else if (homepageStatus === 'generating') {
          locked = true;
          lockReason = 'Homepage generation in progress';
        } else if (homepageStatus === 'generated') {
          locked = true;
          lockReason = 'Approve homepage first';
        }
        // If homepageStatus === 'approved', pages are unlocked
      }

      return {
        blueprintId: row.bp_id,
        pageType: row.page_type,
        title: row.working_title || 'Untitled',
        priority: row.priority,
        status,
        locked,
        lockReason,
        sectionTotal: row.section_total,
        sectionsDone: row.sections_generated,
      };
    });

    const response: QueueResponse = {
      siteId,
      homepageStatus,
      approvedSuburbCount,
      batchUnlockThreshold: BATCH_UNLOCK_THRESHOLD,
      batchUnlocked,
      queue,
    };

    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to load generation queue: ${message}` }, { status: 500 });
  }
};
