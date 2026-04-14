import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

interface CheckpointRow {
  id: number;
  site_id: number | null;
  stage: string;
  checkpoint_type: string;
  deliverables: string;
  decisions: string | null;
  state_for_next_session: string | null;
  issues: string | null;
  created_at: string;
}

interface ParsedCheckpoint {
  id: number;
  siteId: number | null;
  stage: string;
  checkpointType: string;
  deliverables: Record<string, unknown> | null;
  decisions: Record<string, unknown> | null;
  stateForNextSession: Record<string, unknown> | null;
  issues: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * GET /api/site/:siteId/checkpoints
 * Returns all scribe_checkpoints for the site, with parsed JSON fields.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId)) {
    return json(
      { error: 'Invalid siteId parameter' },
      { status: 400 }
    );
  }

  const rows = db
    .prepare(
      `SELECT id, site_id, stage, checkpoint_type, deliverables, decisions,
              state_for_next_session, issues, created_at
       FROM scribe_checkpoints
       WHERE site_id = ? OR site_id IS NULL
       ORDER BY created_at DESC`
    )
    .all(siteId) as CheckpointRow[];

  const checkpoints: ParsedCheckpoint[] = rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    stage: row.stage,
    checkpointType: row.checkpoint_type,
    deliverables: safeJsonParse(row.deliverables),
    decisions: safeJsonParse(row.decisions),
    stateForNextSession: safeJsonParse(row.state_for_next_session),
    issues: safeJsonParse(row.issues),
    createdAt: row.created_at,
  }));

  return json({ siteId, checkpoints });
};

function safeJsonParse(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
