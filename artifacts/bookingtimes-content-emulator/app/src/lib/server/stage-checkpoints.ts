/**
 * Stage Checkpoint Service
 *
 * Fires a Scribe checkpoint when a pipeline stage is complete for a site.
 * Gathers deliverables, computes scores, writes checkpoint, advances stage.
 */

import db from '$lib/db';
import { advanceSiteStage, type TransitionResult } from '$lib/server/pipeline-gates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageDeliverables {
  pagesInventoried: number;
  pagesScraped: number;
  cssClassesAudited: number;
  brandProfileInferred: boolean;
  schemaAudited: number;
  seoAudited: number;
  geoAudited: number;
}

interface AverageScores {
  seo: number;
  geo: number;
  schema: number;
  overall: number;
}

export interface StageCheckpointResult {
  siteId: number;
  siteName: string;
  stage: string;
  success: boolean;
  checkpoint: {
    deliverables: StageDeliverables;
    averageScores: AverageScores;
  };
  error?: string;
}

interface SiteRow {
  id: number;
  name: string;
  pipeline_stage: string;
}

interface CountRow {
  cnt: number;
}

interface AvgRow {
  avg_seo: number | null;
  avg_geo: number | null;
  avg_schema: number | null;
  avg_overall: number | null;
}

interface ContentAuditRow {
  id: number;
  seo_score: number | null;
  geo_score: number | null;
  schema_score: number | null;
  content_depth_score: number | null;
  voice_score: number | null;
}

// ---------------------------------------------------------------------------
// Score weights for overall_score computation
// ---------------------------------------------------------------------------

const WEIGHTS = {
  seo: 0.30,
  geo: 0.25,
  schema: 0.20,
  content_depth: 0.15,
  voice: 0.10,
} as const;

/**
 * Compute a weighted overall score, redistributing weight proportionally
 * when some component scores are NULL.
 */
function computeOverallScore(row: ContentAuditRow): number | null {
  const components: Array<{ value: number | null; weight: number }> = [
    { value: row.seo_score, weight: WEIGHTS.seo },
    { value: row.geo_score, weight: WEIGHTS.geo },
    { value: row.schema_score, weight: WEIGHTS.schema },
    { value: row.content_depth_score, weight: WEIGHTS.content_depth },
    { value: row.voice_score, weight: WEIGHTS.voice },
  ];

  const available = components.filter((c) => c.value !== null && c.value !== undefined);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const weighted = available.reduce((sum, c) => sum + (c.value as number) * (c.weight / totalWeight), 0);

  return Math.round(weighted * 100) / 100;
}

// ---------------------------------------------------------------------------
// Prepared statements (lazily created on first call)
// ---------------------------------------------------------------------------

let stmts: ReturnType<typeof prepareStatements> | null = null;

function prepareStatements() {
  return {
    getSite: db.prepare<[number], SiteRow>(
      'SELECT id, name, pipeline_stage FROM sites WHERE id = ?'
    ),
    countStructureMap: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM site_structure_map WHERE site_id = ?'
    ),
    countContentAudit: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = ?'
    ),
    countCssAudit: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM css_audit WHERE site_id = ?'
    ),
    hasBrandProfile: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM brand_profiles WHERE site_id = ?'
    ),
    countSchemaAudit: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM schema_audit WHERE site_id = ?'
    ),
    countSeoAudited: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = ? AND seo_score IS NOT NULL'
    ),
    countGeoAudited: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = ? AND geo_score IS NOT NULL'
    ),
    getContentAuditRows: db.prepare<[number], ContentAuditRow>(
      `SELECT id, seo_score, geo_score, schema_score, content_depth_score, voice_score
       FROM content_audit WHERE site_id = ?`
    ),
    updateOverallScore: db.prepare(
      'UPDATE content_audit SET overall_score = ? WHERE id = ?'
    ),
    insertCheckpoint: db.prepare(
      `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
       VALUES (?, 'stage_1', 'stage_complete', ?, ?, ?)`
    ),
    avgScores: db.prepare<[number], AvgRow>(
      `SELECT
         AVG(seo_score)     AS avg_seo,
         AVG(geo_score)     AS avg_geo,
         AVG(schema_score)  AS avg_schema,
         AVG(overall_score) AS avg_overall
       FROM content_audit WHERE site_id = ?`
    ),
  };
}

function getStmts() {
  if (!stmts) stmts = prepareStatements();
  return stmts;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Complete Stage 1 for a site: gather deliverables, compute overall scores,
 * write checkpoint, and advance the pipeline stage.
 */
export function completeStage1(siteId: number): StageCheckpointResult {
  const s = getStmts();

  // ------ 1. Verify prerequisites ------

  const site = s.getSite.get(siteId) as SiteRow | undefined;
  if (!site) {
    return errorResult(siteId, 'unknown', `Site with id ${siteId} not found`);
  }

  if (site.pipeline_stage !== 'stage_1' && site.pipeline_stage !== 'not_started') {
    return errorResult(siteId, site.name, `Site "${site.name}" is at "${site.pipeline_stage}", expected "stage_1" or "not_started"`);
  }

  const missing: string[] = [];

  const structureCount = (s.countStructureMap.get(siteId) as CountRow).cnt;
  if (structureCount === 0) missing.push('site_structure_map has no entries');

  const contentAuditCount = (s.countContentAudit.get(siteId) as CountRow).cnt;
  if (contentAuditCount === 0) missing.push('content_audit has no entries');

  const brandExists = (s.hasBrandProfile.get(siteId) as CountRow).cnt > 0;
  if (!brandExists) missing.push('brand_profiles has no entry');

  if (missing.length > 0) {
    return errorResult(
      siteId,
      site.name,
      `Prerequisites not met: ${missing.join('; ')}`
    );
  }

  // ------ 2. Gather deliverable counts ------

  const cssCount = (s.countCssAudit.get(siteId) as CountRow).cnt;
  const schemaCount = (s.countSchemaAudit.get(siteId) as CountRow).cnt;
  const seoCount = (s.countSeoAudited.get(siteId) as CountRow).cnt;
  const geoCount = (s.countGeoAudited.get(siteId) as CountRow).cnt;

  const deliverables: StageDeliverables = {
    pagesInventoried: structureCount,
    pagesScraped: contentAuditCount,
    cssClassesAudited: cssCount,
    brandProfileInferred: brandExists,
    schemaAudited: schemaCount,
    seoAudited: seoCount,
    geoAudited: geoCount,
  };

  // ------ 3–5. Atomic transaction: compute scores, write checkpoint, advance ------

  const runCheckpoint = db.transaction(() => {
    // 3. Compute overall_score for each content_audit row
    const rows = s.getContentAuditRows.all(siteId) as ContentAuditRow[];
    for (const row of rows) {
      const overall = computeOverallScore(row);
      if (overall !== null) {
        s.updateOverallScore.run(overall, row.id);
      }
    }

    // 4. Compute averages (after overall_score has been written)
    const avgs = s.avgScores.get(siteId) as AvgRow;
    const averageScores: AverageScores = {
      seo: round2(avgs.avg_seo),
      geo: round2(avgs.avg_geo),
      schema: round2(avgs.avg_schema),
      overall: round2(avgs.avg_overall),
    };

    // 5. Write checkpoint record
    const checkpointDeliverables = JSON.stringify(deliverables);
    const decisions = JSON.stringify({
      note: 'Stage 1 auto-completed — all prerequisites verified',
      averageScores,
    });
    const stateForNext = JSON.stringify({
      readyFor: 'stage_2',
      pagesInventoried: deliverables.pagesInventoried,
      pagesScraped: deliverables.pagesScraped,
      averageScores,
    });

    s.insertCheckpoint.run(siteId, checkpointDeliverables, decisions, stateForNext);

    return averageScores;
  });

  const averageScores = runCheckpoint();

  // 6. Advance pipeline stage (has its own transaction internally)
  const transition: TransitionResult = advanceSiteStage(siteId);

  if (!transition.success) {
    // Checkpoint was written but advance failed — surface the error
    return {
      siteId: site.id,
      siteName: site.name,
      stage: 'stage_1',
      success: false,
      checkpoint: { deliverables, averageScores },
      error: `Checkpoint saved but stage advance failed: ${transition.error}`,
    };
  }

  return {
    siteId: site.id,
    siteName: site.name,
    stage: 'stage_1',
    success: true,
    checkpoint: { deliverables, averageScores },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(val: number | null): number {
  if (val === null || val === undefined) return 0;
  return Math.round(val * 100) / 100;
}

function errorResult(siteId: number, siteName: string, error: string): StageCheckpointResult {
  return {
    siteId,
    siteName,
    stage: 'stage_1',
    success: false,
    checkpoint: {
      deliverables: {
        pagesInventoried: 0,
        pagesScraped: 0,
        cssClassesAudited: 0,
        brandProfileInferred: false,
        schemaAudited: 0,
        seoAudited: 0,
        geoAudited: 0,
      },
      averageScores: { seo: 0, geo: 0, schema: 0, overall: 0 },
    },
    error,
  };
}

// ---------------------------------------------------------------------------
// Stage 2 types
// ---------------------------------------------------------------------------

interface Stage2Deliverables {
  seoBenchmarks: number;
  geoBenchmarks: number;
  schemaBenchmarks: number;
  taxonomyEntries: number;
  siloDefinitions: number;
}

export interface Stage2CheckpointResult {
  success: boolean;
  checkpoint: {
    deliverables: Stage2Deliverables;
  };
  sitesUnlocked: string[];
  error?: string;
}

interface SiteIdNameRow {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Stage 2 prepared statements (lazily created)
// ---------------------------------------------------------------------------

let s2Stmts: ReturnType<typeof prepareStage2Statements> | null = null;

function prepareStage2Statements() {
  return {
    countSeoBenchmarks: db.prepare<[], CountRow>(
      "SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category IN ('seo', 'content', 'linking')"
    ),
    countGeoBenchmarks: db.prepare<[], CountRow>(
      "SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category = 'geo'"
    ),
    countSchemaBenchmarks: db.prepare<[], CountRow>(
      "SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category = 'schema'"
    ),
    countTaxonomy: db.prepare<[], CountRow>(
      'SELECT COUNT(*) AS cnt FROM page_taxonomy'
    ),
    countSilos: db.prepare<[], CountRow>(
      'SELECT COUNT(*) AS cnt FROM silo_definitions'
    ),
    sitesAtStage1: db.prepare<[], SiteIdNameRow>(
      "SELECT id, name FROM sites WHERE pipeline_stage = 'stage_1'"
    ),
    insertGlobalCheckpoint: db.prepare(
      `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
       VALUES (NULL, 'stage_2', 'stage_complete', ?, ?, ?)`
    ),
  };
}

function getS2Stmts() {
  if (!s2Stmts) s2Stmts = prepareStage2Statements();
  return s2Stmts;
}

// ---------------------------------------------------------------------------
// Stage 2 completion
// ---------------------------------------------------------------------------

/**
 * Complete Stage 2 (Research & Benchmark) — a GLOBAL checkpoint (no site_id).
 * Verifies that benchmark_standards and page_taxonomy are populated,
 * writes the checkpoint, and advances all sites currently at stage_1 → stage_2.
 */
export function completeStage2(): Stage2CheckpointResult {
  const s = getS2Stmts();

  // ------ 1. Verify prerequisites ------

  const missing: string[] = [];

  const seoBenchmarks = (s.countSeoBenchmarks.get() as CountRow).cnt;
  const geoBenchmarks = (s.countGeoBenchmarks.get() as CountRow).cnt;
  const schemaBenchmarks = (s.countSchemaBenchmarks.get() as CountRow).cnt;
  const taxonomyEntries = (s.countTaxonomy.get() as CountRow).cnt;
  const siloDefinitions = (s.countSilos.get() as CountRow).cnt;

  if (seoBenchmarks === 0) missing.push('benchmark_standards has no SEO/content/linking entries');
  if (geoBenchmarks === 0) missing.push('benchmark_standards has no geo entries');
  if (schemaBenchmarks === 0) missing.push('benchmark_standards has no schema entries');
  if (taxonomyEntries === 0) missing.push('page_taxonomy has no entries');

  if (missing.length > 0) {
    return {
      success: false,
      checkpoint: {
        deliverables: {
          seoBenchmarks,
          geoBenchmarks,
          schemaBenchmarks,
          taxonomyEntries,
          siloDefinitions,
        },
      },
      sitesUnlocked: [],
      error: `Prerequisites not met: ${missing.join('; ')}`,
    };
  }

  // ------ 2. Gather deliverable counts ------

  const deliverables: Stage2Deliverables = {
    seoBenchmarks,
    geoBenchmarks,
    schemaBenchmarks,
    taxonomyEntries,
    siloDefinitions,
  };

  // ------ 3. Write checkpoint and advance eligible sites in a transaction ------

  const sitesAtStage1 = s.sitesAtStage1.all() as SiteIdNameRow[];

  const runCheckpoint = db.transaction(() => {
    // Write global checkpoint (site_id = NULL)
    const checkpointDeliverables = JSON.stringify(deliverables);
    const decisions = JSON.stringify({
      note: 'Stage 2 auto-completed — all research & benchmark prerequisites verified',
      totalBenchmarks: seoBenchmarks + geoBenchmarks + schemaBenchmarks,
      taxonomyEntries,
      siloDefinitions,
    });
    const stateForNext = JSON.stringify({
      readyFor: 'stage_3',
      benchmarkCounts: deliverables,
      sitesAdvanced: sitesAtStage1.map((s) => s.name),
    });

    s.insertGlobalCheckpoint.run(checkpointDeliverables, decisions, stateForNext);

    // Advance each site at stage_1 → stage_2
    const unlocked: string[] = [];
    for (const site of sitesAtStage1) {
      const result = advanceSiteStage(site.id);
      if (result.success) {
        unlocked.push(site.name);
      }
    }
    return unlocked;
  });

  const sitesUnlocked = runCheckpoint();

  return {
    success: true,
    checkpoint: { deliverables },
    sitesUnlocked,
  };
}

// ---------------------------------------------------------------------------
// Stage 3 types
// ---------------------------------------------------------------------------

interface Stage3Deliverables {
  gapAnalysisEntries: number;
  workBacklogItems: number;
  linkGraphEdges: number;
  anchorTextEntries: number;
  orphanPages: number;
}

export interface Stage3CheckpointResult {
  success: boolean;
  checkpoint: {
    deliverables: Stage3Deliverables;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Stage 3 prepared statements (lazily created)
// ---------------------------------------------------------------------------

let s3Stmts: ReturnType<typeof prepareStage3Statements> | null = null;

function prepareStage3Statements() {
  return {
    getSite: db.prepare<[number], SiteRow>(
      'SELECT id, name, pipeline_stage FROM sites WHERE id = ?'
    ),
    countGapAnalysis: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM gap_analysis WHERE site_id = ?'
    ),
    countWorkBacklog: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM work_backlog WHERE site_id = ?'
    ),
    countLinkGraph: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM internal_link_graph WHERE site_id = ?'
    ),
    countAnchorText: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM anchor_text_bank WHERE site_id = ?'
    ),
    countOrphanPages: db.prepare<[number], CountRow>(
      `SELECT COUNT(*) AS cnt FROM (
         SELECT DISTINCT target_url FROM internal_link_graph WHERE site_id = ?
         GROUP BY target_url
         HAVING COUNT(*) < 2
       )`
    ),
    insertCheckpoint: db.prepare(
      `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
       VALUES (?, 'stage_3', 'stage_complete', ?, ?, ?)`
    ),
  };
}

function getS3Stmts() {
  if (!s3Stmts) s3Stmts = prepareStage3Statements();
  return s3Stmts;
}

// ---------------------------------------------------------------------------
// Stage 3 completion
// ---------------------------------------------------------------------------

/**
 * Complete Stage 3 (Gap Analysis & Link Architecture) for a site.
 * Verifies that gap_analysis, work_backlog, internal_link_graph, and
 * anchor_text_bank are populated, counts orphan pages, writes checkpoint,
 * and advances the pipeline stage.
 */
export function completeStage3(siteId: number): Stage3CheckpointResult {
  const s = getS3Stmts();

  // ------ 1. Verify prerequisites ------

  const site = s.getSite.get(siteId) as SiteRow | undefined;
  if (!site) {
    return {
      success: false,
      checkpoint: { deliverables: emptyStage3Deliverables() },
      error: `Site with id ${siteId} not found`,
    };
  }

  if (site.pipeline_stage !== 'stage_2' && site.pipeline_stage !== 'stage_3') {
    return {
      success: false,
      checkpoint: { deliverables: emptyStage3Deliverables() },
      error: `Site "${site.name}" is at "${site.pipeline_stage}", expected "stage_2" or "stage_3"`,
    };
  }

  const missing: string[] = [];

  const gapAnalysisEntries = (s.countGapAnalysis.get(siteId) as CountRow).cnt;
  if (gapAnalysisEntries === 0) missing.push('gap_analysis has no entries');

  const workBacklogItems = (s.countWorkBacklog.get(siteId) as CountRow).cnt;
  if (workBacklogItems === 0) missing.push('work_backlog has no entries');

  const linkGraphEdges = (s.countLinkGraph.get(siteId) as CountRow).cnt;
  if (linkGraphEdges === 0) missing.push('internal_link_graph has no entries');

  const anchorTextEntries = (s.countAnchorText.get(siteId) as CountRow).cnt;
  if (anchorTextEntries === 0) missing.push('anchor_text_bank has no entries');

  if (missing.length > 0) {
    return {
      success: false,
      checkpoint: {
        deliverables: {
          gapAnalysisEntries,
          workBacklogItems,
          linkGraphEdges,
          anchorTextEntries,
          orphanPages: 0,
        },
      },
      error: `Prerequisites not met: ${missing.join('; ')}`,
    };
  }

  // ------ 2. Gather deliverable counts ------

  const orphanPages = (s.countOrphanPages.get(siteId) as CountRow).cnt;

  const deliverables: Stage3Deliverables = {
    gapAnalysisEntries,
    workBacklogItems,
    linkGraphEdges,
    anchorTextEntries,
    orphanPages,
  };

  // ------ 3. Write checkpoint and advance stage in a transaction ------

  const runCheckpoint = db.transaction(() => {
    const checkpointDeliverables = JSON.stringify(deliverables);
    const decisions = JSON.stringify({
      note: 'Stage 3 auto-completed — all gap analysis & link architecture prerequisites verified',
      orphanPages,
    });
    const stateForNext = JSON.stringify({
      readyFor: 'stage_4',
      gapAnalysisEntries,
      workBacklogItems,
      linkGraphEdges,
      anchorTextEntries,
      orphanPages,
    });

    s.insertCheckpoint.run(siteId, checkpointDeliverables, decisions, stateForNext);
  });

  runCheckpoint();

  // Advance pipeline stage (has its own transaction internally)
  const transition: TransitionResult = advanceSiteStage(siteId);

  if (!transition.success) {
    return {
      success: false,
      checkpoint: { deliverables },
      error: `Checkpoint saved but stage advance failed: ${transition.error}`,
    };
  }

  return {
    success: true,
    checkpoint: { deliverables },
  };
}

function emptyStage3Deliverables(): Stage3Deliverables {
  return {
    gapAnalysisEntries: 0,
    workBacklogItems: 0,
    linkGraphEdges: 0,
    anchorTextEntries: 0,
    orphanPages: 0,
  };
}

// ---------------------------------------------------------------------------
// Stage 4 types
// ---------------------------------------------------------------------------

interface Stage4Deliverables {
  blueprintsTotal: number;
  blueprintsApproved: number;
  totalSections: number;
  cssDecisions: number;
  schemasSpecified: number;
}

export interface Stage4CheckpointResult {
  success: boolean;
  checkpoint: {
    deliverables: Stage4Deliverables;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Stage 4 prepared statements (lazily created)
// ---------------------------------------------------------------------------

let s4Stmts: ReturnType<typeof prepareStage4Statements> | null = null;

function prepareStage4Statements() {
  return {
    getSite: db.prepare<[number], SiteRow>(
      'SELECT id, name, pipeline_stage FROM sites WHERE id = ?'
    ),
    countBlueprints: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM page_blueprints WHERE site_id = ?'
    ),
    countApprovedBlueprints: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM page_blueprints WHERE site_id = ? AND user_approved = 1'
    ),
    countSections: db.prepare<[number], CountRow>(
      `SELECT COUNT(*) AS cnt FROM section_specs ss
       JOIN page_blueprints pb ON ss.blueprint_id = pb.id
       WHERE pb.site_id = ?`
    ),
    countCssDecisions: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM css_decisions WHERE site_id = ?'
    ),
    countSchemasSpecified: db.prepare<[number], CountRow>(
      'SELECT COUNT(*) AS cnt FROM page_blueprints WHERE site_id = ? AND schema_spec IS NOT NULL'
    ),
    insertCheckpoint: db.prepare(
      `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
       VALUES (?, 'stage_4', 'stage_complete', ?, ?, ?)`
    ),
  };
}

function getS4Stmts() {
  if (!s4Stmts) s4Stmts = prepareStage4Statements();
  return s4Stmts;
}

// ---------------------------------------------------------------------------
// Stage 4 completion
// ---------------------------------------------------------------------------

/**
 * Complete Stage 4 (Blueprints & Section Specs) for a site.
 * Verifies that page_blueprints, section_specs, css_decisions, and schema_spec
 * are populated, checks approval status, writes checkpoint, and advances the
 * pipeline stage.
 */
export function completeStage4(siteId: number): Stage4CheckpointResult {
  const s = getS4Stmts();

  // ------ 1. Verify prerequisites ------

  const site = s.getSite.get(siteId) as SiteRow | undefined;
  if (!site) {
    return {
      success: false,
      checkpoint: { deliverables: emptyStage4Deliverables() },
      error: `Site with id ${siteId} not found`,
    };
  }

  if (site.pipeline_stage !== 'stage_3' && site.pipeline_stage !== 'stage_4') {
    return {
      success: false,
      checkpoint: { deliverables: emptyStage4Deliverables() },
      error: `Site "${site.name}" is at "${site.pipeline_stage}", expected "stage_3" or "stage_4"`,
    };
  }

  const missing: string[] = [];

  const blueprintsTotal = (s.countBlueprints.get(siteId) as CountRow).cnt;
  if (blueprintsTotal === 0) missing.push('page_blueprints has no entries');

  const totalSections = (s.countSections.get(siteId) as CountRow).cnt;
  if (totalSections === 0) missing.push('section_specs has no entries for site blueprints');

  const cssDecisions = (s.countCssDecisions.get(siteId) as CountRow).cnt;
  if (cssDecisions === 0) missing.push('css_decisions has no entries');

  const schemasSpecified = (s.countSchemasSpecified.get(siteId) as CountRow).cnt;
  if (schemasSpecified === 0) missing.push('no page_blueprints have schema_spec populated');

  const blueprintsApproved = (s.countApprovedBlueprints.get(siteId) as CountRow).cnt;
  if (blueprintsApproved === 0) missing.push('no page_blueprints have user_approved = 1');

  if (missing.length > 0) {
    return {
      success: false,
      checkpoint: {
        deliverables: {
          blueprintsTotal,
          blueprintsApproved,
          totalSections,
          cssDecisions,
          schemasSpecified,
        },
      },
      error: `Prerequisites not met: ${missing.join('; ')}`,
    };
  }

  // ------ 2. Gather deliverable counts ------

  const deliverables: Stage4Deliverables = {
    blueprintsTotal,
    blueprintsApproved,
    totalSections,
    cssDecisions,
    schemasSpecified,
  };

  // ------ 3. Write checkpoint and advance stage in a transaction ------

  const runCheckpoint = db.transaction(() => {
    const checkpointDeliverables = JSON.stringify(deliverables);
    const decisions = JSON.stringify({
      note: 'Stage 4 auto-completed — all blueprint & section spec prerequisites verified',
      approvalRate: `${blueprintsApproved}/${blueprintsTotal}`,
    });
    const stateForNext = JSON.stringify({
      readyFor: 'stage_5',
      blueprintsTotal,
      blueprintsApproved,
      totalSections,
      cssDecisions,
      schemasSpecified,
    });

    s.insertCheckpoint.run(siteId, checkpointDeliverables, decisions, stateForNext);
  });

  runCheckpoint();

  // Advance pipeline stage (has its own transaction internally)
  const transition: TransitionResult = advanceSiteStage(siteId);

  if (!transition.success) {
    return {
      success: false,
      checkpoint: { deliverables },
      error: `Checkpoint saved but stage advance failed: ${transition.error}`,
    };
  }

  return {
    success: true,
    checkpoint: { deliverables },
  };
}

function emptyStage4Deliverables(): Stage4Deliverables {
  return {
    blueprintsTotal: 0,
    blueprintsApproved: 0,
    totalSections: 0,
    cssDecisions: 0,
    schemasSpecified: 0,
  };
}
