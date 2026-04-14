/**
 * Pipeline Stage Gate Enforcement Service
 *
 * Enforces the 5-stage pipeline: Audit → Benchmark → Gap Analysis → Blueprint → Generate
 * Each site progresses independently through stages. No skipping, no backwards transitions.
 *
 * Valid stages: not_started → stage_1 → stage_2 → stage_3 → stage_4 → stage_5 → maintaining
 */

import db from '$lib/db';

// Ordered pipeline stages
const STAGES = [
  'not_started',
  'stage_1',
  'stage_2',
  'stage_3',
  'stage_4',
  'stage_5',
  'maintaining'
] as const;

type PipelineStage = (typeof STAGES)[number];

export interface TransitionResult {
  success: boolean;
  fromStage: string;
  toStage: string;
  siteId: number;
  siteName: string;
  error?: string;
}

interface SiteRow {
  id: number;
  name: string;
  pipeline_stage: string;
}

/**
 * Get the next stage in the pipeline, or null if at the final stage.
 */
function getNextStage(current: PipelineStage): PipelineStage | null {
  const idx = STAGES.indexOf(current);
  if (idx === -1 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

/**
 * Fetch a site row by ID. Returns null if not found.
 */
function getSite(siteId: number): SiteRow | null {
  const row = db.prepare('SELECT id, name, pipeline_stage FROM sites WHERE id = ?').get(siteId) as
    | SiteRow
    | undefined;
  return row ?? null;
}

/**
 * Attempt to advance a site to the next pipeline stage.
 * Validates the transition and updates the database if valid.
 */
export function advanceSiteStage(siteId: number): TransitionResult {
  const site = getSite(siteId);

  if (!site) {
    return {
      success: false,
      fromStage: 'unknown',
      toStage: 'unknown',
      siteId,
      siteName: 'unknown',
      error: `Site with id ${siteId} not found`
    };
  }

  const currentStage = site.pipeline_stage as PipelineStage;
  const nextStage = getNextStage(currentStage);

  if (!nextStage) {
    return {
      success: false,
      fromStage: currentStage,
      toStage: currentStage,
      siteId: site.id,
      siteName: site.name,
      error: `Site "${site.name}" is already at the final stage (${currentStage}). No further advancement possible.`
    };
  }

  // All transitions are sequential — the gate logic simply ensures you advance one step at a time.
  // The "global" nature of Stage 2 is enforced at the UI/workflow level, not here.

  // Perform the transition inside a transaction
  const advance = db.transaction(() => {
    db.prepare('UPDATE sites SET pipeline_stage = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      nextStage,
      site.id
    );

    // Insert scribe checkpoint for the completed stage
    db.prepare(
      `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions)
       VALUES (?, ?, 'stage_complete', '{}', '{}')`
    ).run(site.id, currentStage);
  });

  advance();

  return {
    success: true,
    fromStage: currentStage,
    toStage: nextStage,
    siteId: site.id,
    siteName: site.name
  };
}

/**
 * Check if a site CAN advance to the next stage without actually doing it.
 */
export function canAdvance(siteId: number): { canAdvance: boolean; reason?: string } {
  const site = getSite(siteId);

  if (!site) {
    return { canAdvance: false, reason: `Site with id ${siteId} not found` };
  }

  const currentStage = site.pipeline_stage as PipelineStage;
  const nextStage = getNextStage(currentStage);

  if (!nextStage) {
    return {
      canAdvance: false,
      reason: `Site "${site.name}" is already at the final stage (${currentStage}).`
    };
  }

  return { canAdvance: true };
}

/**
 * Get the current pipeline status for all sites.
 */
export function getPipelineStatus(): Array<{
  siteId: number;
  siteName: string;
  currentStage: string;
  canAdvance: boolean;
  nextStage: string | null;
}> {
  const sites = db.prepare('SELECT id, name, pipeline_stage FROM sites ORDER BY id').all() as SiteRow[];

  return sites.map((site) => {
    const currentStage = site.pipeline_stage as PipelineStage;
    const nextStage = getNextStage(currentStage);

    return {
      siteId: site.id,
      siteName: site.name,
      currentStage,
      canAdvance: nextStage !== null,
      nextStage
    };
  });
}
