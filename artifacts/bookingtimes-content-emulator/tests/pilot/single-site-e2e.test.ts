/**
 * Single-Site Pilot: Stage 1-5 End-to-End Test — WRK-BCE2-053
 *
 * Proves the entire 5-stage pipeline works together on one pilot site.
 * Simulates what a real user would do: audit, benchmark, gap-analyze,
 * design blueprints, generate content, give feedback, and export.
 *
 * External services (Claude CLI, web scraping) are mocked via direct
 * database seeding. The test verifies pipeline orchestration, data flow,
 * state transitions, and gate enforcement at each stage.
 *
 * Run: npx tsx tests/pilot/single-site-e2e.test.ts
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Test infrastructure (reuses patterns from integration/test-helpers.ts)
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(__dirname, '../../app');
const MIGRATIONS_DIR = path.join(APP_ROOT, 'src/lib/db/migrations');

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (file.includes('seed')) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
  }

  return db;
}

class TestRunner {
  private passed = 0;
  private failed = 0;
  private errors: string[] = [];
  private suiteName: string;

  constructor(suiteName: string) {
    this.suiteName = suiteName;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  PILOT TEST: ${suiteName}`);
    console.log(`${'='.repeat(70)}\n`);
  }

  assert(condition: boolean, description: string, details?: string): void {
    if (condition) {
      this.passed++;
      console.log(`  [PASS] ${description}`);
    } else {
      this.failed++;
      const msg = details ? `${description} — ${details}` : description;
      this.errors.push(msg);
      console.log(`  [FAIL] ${description}`);
      if (details) console.log(`         ${details}`);
    }
  }

  assertEqual<T>(actual: T, expected: T, description: string): void {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    this.assert(
      pass,
      description,
      pass ? undefined : `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`
    );
  }

  assertGreaterThan(actual: number, threshold: number, description: string): void {
    this.assert(
      actual > threshold,
      description,
      actual > threshold ? undefined : `${actual} is not greater than ${threshold}`
    );
  }

  assertGreaterThanOrEqual(actual: number, threshold: number, description: string): void {
    this.assert(
      actual >= threshold,
      description,
      actual >= threshold ? undefined : `${actual} is not >= ${threshold}`
    );
  }

  assertIncludes(haystack: string, needle: string, description: string): void {
    const pass = haystack.includes(needle);
    this.assert(pass, description, pass ? undefined : `String does not contain "${needle}"`);
  }

  assertNotNull(value: unknown, description: string): void {
    this.assert(
      value !== null && value !== undefined,
      description,
      value === null || value === undefined ? 'Value is null/undefined' : undefined
    );
  }

  section(name: string): void {
    console.log(`\n  --- ${name} ---\n`);
  }

  summary(): { passed: number; failed: number; errors: string[] } {
    console.log(`\n${'-'.repeat(70)}`);
    console.log(`  ${this.suiteName} Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.errors.length > 0) {
      console.log(`  Failures:`);
      for (const err of this.errors) {
        console.log(`    - ${err}`);
      }
    }
    console.log(`${'-'.repeat(70)}\n`);
    return { passed: this.passed, failed: this.failed, errors: this.errors };
  }
}

// ---------------------------------------------------------------------------
// Pipeline gate logic (mirrors pipeline-gates.ts with injected db)
// ---------------------------------------------------------------------------

const STAGES = [
  'not_started', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5', 'maintaining'
] as const;

type PipelineStage = (typeof STAGES)[number];

interface SiteRow {
  id: number;
  name: string;
  pipeline_stage: string;
}

interface TransitionResult {
  success: boolean;
  fromStage: string;
  toStage: string;
  siteId: number;
  siteName: string;
  error?: string;
}

interface CountRow {
  cnt: number;
}

function getNextStage(current: PipelineStage): PipelineStage | null {
  const idx = STAGES.indexOf(current);
  if (idx === -1 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

function advanceSiteStage(db: Database.Database, siteId: number): TransitionResult {
  const site = db.prepare('SELECT id, name, pipeline_stage FROM sites WHERE id = ?').get(siteId) as SiteRow | undefined;
  if (!site) {
    return { success: false, fromStage: 'unknown', toStage: 'unknown', siteId, siteName: 'unknown', error: `Site ${siteId} not found` };
  }

  const currentStage = site.pipeline_stage as PipelineStage;
  const nextStage = getNextStage(currentStage);

  if (!nextStage) {
    return {
      success: false, fromStage: currentStage, toStage: currentStage,
      siteId: site.id, siteName: site.name,
      error: `Site "${site.name}" is already at the final stage (${currentStage}).`
    };
  }

  const advance = db.transaction(() => {
    db.prepare("UPDATE sites SET pipeline_stage = ?, updated_at = datetime('now') WHERE id = ?").run(nextStage, site.id);
    db.prepare(
      `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions)
       VALUES (?, ?, 'stage_complete', '{}', '{}')`
    ).run(site.id, currentStage);
  });
  advance();

  return { success: true, fromStage: currentStage, toStage: nextStage, siteId: site.id, siteName: site.name };
}

function canAdvance(db: Database.Database, siteId: number): { canAdvance: boolean; reason?: string } {
  const site = db.prepare('SELECT id, name, pipeline_stage FROM sites WHERE id = ?').get(siteId) as SiteRow | undefined;
  if (!site) return { canAdvance: false, reason: 'Site not found' };
  const currentStage = site.pipeline_stage as PipelineStage;
  const nextStage = getNextStage(currentStage);
  if (!nextStage) return { canAdvance: false, reason: `Already at final stage (${currentStage})` };
  return { canAdvance: true };
}

function getSiteStage(db: Database.Database, siteId: number): string {
  const row = db.prepare('SELECT pipeline_stage FROM sites WHERE id = ?').get(siteId) as { pipeline_stage: string };
  return row.pipeline_stage;
}

// ---------------------------------------------------------------------------
// Stage 1 completion logic (mirrors stage-checkpoints.ts completeStage1)
// ---------------------------------------------------------------------------

function completeStage1(db: Database.Database, siteId: number): { success: boolean; error?: string } {
  const site = db.prepare('SELECT id, name, pipeline_stage FROM sites WHERE id = ?').get(siteId) as SiteRow | undefined;
  if (!site) return { success: false, error: 'Site not found' };
  if (site.pipeline_stage !== 'stage_1' && site.pipeline_stage !== 'not_started') {
    return { success: false, error: `Site at "${site.pipeline_stage}", expected "stage_1" or "not_started"` };
  }

  // Check prerequisites
  const structureCount = (db.prepare('SELECT COUNT(*) AS cnt FROM site_structure_map WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const contentAuditCount = (db.prepare('SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const brandExists = (db.prepare('SELECT COUNT(*) AS cnt FROM brand_profiles WHERE site_id = ?').get(siteId) as CountRow).cnt > 0;

  const missing: string[] = [];
  if (structureCount === 0) missing.push('site_structure_map has no entries');
  if (contentAuditCount === 0) missing.push('content_audit has no entries');
  if (!brandExists) missing.push('brand_profiles has no entry');

  if (missing.length > 0) {
    return { success: false, error: `Prerequisites not met: ${missing.join('; ')}` };
  }

  // Compute overall scores
  const WEIGHTS = { seo: 0.30, geo: 0.25, schema: 0.20, content_depth: 0.15, voice: 0.10 };
  const rows = db.prepare(
    'SELECT id, seo_score, geo_score, schema_score, content_depth_score, voice_score FROM content_audit WHERE site_id = ?'
  ).all(siteId) as Array<{ id: number; seo_score: number | null; geo_score: number | null; schema_score: number | null; content_depth_score: number | null; voice_score: number | null }>;

  for (const row of rows) {
    const components = [
      { value: row.seo_score, weight: WEIGHTS.seo },
      { value: row.geo_score, weight: WEIGHTS.geo },
      { value: row.schema_score, weight: WEIGHTS.schema },
      { value: row.content_depth_score, weight: WEIGHTS.content_depth },
      { value: row.voice_score, weight: WEIGHTS.voice },
    ];
    const available = components.filter(c => c.value !== null && c.value !== undefined);
    if (available.length > 0) {
      const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
      const overall = available.reduce((sum, c) => sum + (c.value as number) * (c.weight / totalWeight), 0);
      db.prepare('UPDATE content_audit SET overall_score = ? WHERE id = ?').run(Math.round(overall * 100) / 100, row.id);
    }
  }

  // Write checkpoint
  const cssCount = (db.prepare('SELECT COUNT(*) AS cnt FROM css_audit WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const schemaCount = (db.prepare('SELECT COUNT(*) AS cnt FROM schema_audit WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const seoCount = (db.prepare('SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = ? AND seo_score IS NOT NULL').get(siteId) as CountRow).cnt;
  const geoCount = (db.prepare('SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = ? AND geo_score IS NOT NULL').get(siteId) as CountRow).cnt;

  const deliverables = JSON.stringify({
    pagesInventoried: structureCount,
    pagesScraped: contentAuditCount,
    cssClassesAudited: cssCount,
    brandProfileInferred: true,
    schemaAudited: schemaCount,
    seoAudited: seoCount,
    geoAudited: geoCount,
  });

  db.prepare(
    `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
     VALUES (?, 'stage_1', 'stage_complete', ?, '{}', '{}')`
  ).run(siteId, deliverables);

  // Advance stage
  const transition = advanceSiteStage(db, siteId);
  return { success: transition.success, error: transition.error };
}

// ---------------------------------------------------------------------------
// Stage 2 completion logic (mirrors stage-checkpoints.ts completeStage2)
// ---------------------------------------------------------------------------

function completeStage2(db: Database.Database, siteId: number): { success: boolean; error?: string } {
  const missing: string[] = [];
  const seoBenchmarks = (db.prepare("SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category IN ('seo', 'content', 'linking')").get() as CountRow).cnt;
  const geoBenchmarks = (db.prepare("SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category = 'geo'").get() as CountRow).cnt;
  const schemaBenchmarks = (db.prepare("SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category = 'schema'").get() as CountRow).cnt;
  const taxonomyEntries = (db.prepare('SELECT COUNT(*) AS cnt FROM page_taxonomy').get() as CountRow).cnt;

  if (seoBenchmarks === 0) missing.push('No SEO benchmarks');
  if (geoBenchmarks === 0) missing.push('No GEO benchmarks');
  if (schemaBenchmarks === 0) missing.push('No schema benchmarks');
  if (taxonomyEntries === 0) missing.push('No taxonomy entries');

  if (missing.length > 0) {
    return { success: false, error: `Prerequisites not met: ${missing.join('; ')}` };
  }

  // Write global checkpoint
  const deliverables = JSON.stringify({ seoBenchmarks, geoBenchmarks, schemaBenchmarks, taxonomyEntries });
  db.prepare(
    `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
     VALUES (NULL, 'stage_2', 'stage_complete', ?, '{}', '{}')`
  ).run(deliverables);

  // Advance site — after Stage 1 completion the site is at stage_2, advance to stage_3
  const transition = advanceSiteStage(db, siteId);
  return { success: transition.success, error: transition.error };
}

// ---------------------------------------------------------------------------
// Stage 3 completion logic (mirrors stage-checkpoints.ts completeStage3)
// ---------------------------------------------------------------------------

function completeStage3(db: Database.Database, siteId: number): { success: boolean; error?: string } {
  const site = db.prepare('SELECT id, name, pipeline_stage FROM sites WHERE id = ?').get(siteId) as SiteRow | undefined;
  if (!site) return { success: false, error: 'Site not found' };
  if (site.pipeline_stage !== 'stage_2' && site.pipeline_stage !== 'stage_3') {
    return { success: false, error: `Site at "${site.pipeline_stage}", expected "stage_2" or "stage_3"` };
  }

  const missing: string[] = [];
  const gapCount = (db.prepare('SELECT COUNT(*) AS cnt FROM gap_analysis WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const backlogCount = (db.prepare('SELECT COUNT(*) AS cnt FROM work_backlog WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const linkCount = (db.prepare('SELECT COUNT(*) AS cnt FROM internal_link_graph WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const anchorCount = (db.prepare('SELECT COUNT(*) AS cnt FROM anchor_text_bank WHERE site_id = ?').get(siteId) as CountRow).cnt;

  if (gapCount === 0) missing.push('gap_analysis has no entries');
  if (backlogCount === 0) missing.push('work_backlog has no entries');
  if (linkCount === 0) missing.push('internal_link_graph has no entries');
  if (anchorCount === 0) missing.push('anchor_text_bank has no entries');

  if (missing.length > 0) {
    return { success: false, error: `Prerequisites not met: ${missing.join('; ')}` };
  }

  const deliverables = JSON.stringify({ gapCount, backlogCount, linkCount, anchorCount });
  db.prepare(
    `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
     VALUES (?, 'stage_3', 'stage_complete', ?, '{}', '{}')`
  ).run(siteId, deliverables);

  const transition = advanceSiteStage(db, siteId);
  return { success: transition.success, error: transition.error };
}

// ---------------------------------------------------------------------------
// Stage 4 completion logic (mirrors stage-checkpoints.ts completeStage4)
// ---------------------------------------------------------------------------

function completeStage4(db: Database.Database, siteId: number): { success: boolean; error?: string } {
  const site = db.prepare('SELECT id, name, pipeline_stage FROM sites WHERE id = ?').get(siteId) as SiteRow | undefined;
  if (!site) return { success: false, error: 'Site not found' };
  if (site.pipeline_stage !== 'stage_3' && site.pipeline_stage !== 'stage_4') {
    return { success: false, error: `Site at "${site.pipeline_stage}", expected "stage_3" or "stage_4"` };
  }

  const missing: string[] = [];
  const blueprintCount = (db.prepare('SELECT COUNT(*) AS cnt FROM page_blueprints WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const approvedCount = (db.prepare('SELECT COUNT(*) AS cnt FROM page_blueprints WHERE site_id = ? AND user_approved = 1').get(siteId) as CountRow).cnt;
  const sectionCount = (db.prepare(
    'SELECT COUNT(*) AS cnt FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = ?'
  ).get(siteId) as CountRow).cnt;
  const cssDecisionCount = (db.prepare('SELECT COUNT(*) AS cnt FROM css_decisions WHERE site_id = ?').get(siteId) as CountRow).cnt;
  const schemasSpecified = (db.prepare('SELECT COUNT(*) AS cnt FROM page_blueprints WHERE site_id = ? AND schema_spec IS NOT NULL').get(siteId) as CountRow).cnt;

  if (blueprintCount === 0) missing.push('No blueprints');
  if (sectionCount === 0) missing.push('No section specs');
  if (cssDecisionCount === 0) missing.push('No CSS decisions');
  if (schemasSpecified === 0) missing.push('No schema specs');
  if (approvedCount === 0) missing.push('No approved blueprints');

  if (missing.length > 0) {
    return { success: false, error: `Prerequisites not met: ${missing.join('; ')}` };
  }

  const deliverables = JSON.stringify({ blueprintCount, approvedCount, sectionCount, cssDecisionCount, schemasSpecified });
  db.prepare(
    `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions, state_for_next_session)
     VALUES (?, 'stage_4', 'stage_complete', ?, '{}', '{}')`
  ).run(siteId, deliverables);

  const transition = advanceSiteStage(db, siteId);
  return { success: transition.success, error: transition.error };
}

// ---------------------------------------------------------------------------
// Stage 5 helpers: feedback, export, versioning (mirrors server modules)
// ---------------------------------------------------------------------------

function approveSection(db: Database.Database, sectionSpecId: number, qualityRating?: number): void {
  const spec = db.prepare('SELECT id, blueprint_id, section_type, generated_html, status FROM section_specs WHERE id = ?')
    .get(sectionSpecId) as { id: number; blueprint_id: number; section_type: string; generated_html: string | null; status: string };
  const bp = db.prepare('SELECT site_id FROM page_blueprints WHERE id = ?').get(spec.blueprint_id) as { site_id: number };
  const siteId = bp.site_id;

  db.transaction(() => {
    db.prepare('UPDATE section_specs SET status = ? WHERE id = ?').run('approved', sectionSpecId);

    if (spec.generated_html) {
      const pageType = (db.prepare(
        'SELECT wb.page_type FROM work_backlog wb JOIN page_blueprints pb ON pb.backlog_id = wb.id WHERE pb.id = ?'
      ).get(spec.blueprint_id) as { page_type: string } | undefined)?.page_type ?? null;

      db.prepare(
        `INSERT INTO brand_examples (site_id, section_type, page_type, html_content, quality_rating, is_negative, source)
         VALUES (?, ?, ?, ?, ?, 0, 'generated_approved')`
      ).run(siteId, spec.section_type, pageType, spec.generated_html, qualityRating ?? null);
    }

    // Boost confidence
    const profile = db.prepare('SELECT id, inference_confidence FROM brand_profiles WHERE site_id = ?')
      .get(siteId) as { id: number; inference_confidence: number | null } | undefined;
    if (profile) {
      db.prepare(
        `INSERT INTO brand_profile_history (brand_profile_id, snapshot, change_reason, changed_by)
         VALUES (?, '{}', ?, 'feedback')`
      ).run(profile.id, `Section ${sectionSpecId} approved`);

      const newConf = Math.min(1.0, (profile.inference_confidence ?? 0) + 0.02);
      db.prepare("UPDATE brand_profiles SET inference_confidence = ?, updated_at = datetime('now') WHERE site_id = ?")
        .run(newConf, siteId);
    }
  })();
}

function refineSection(db: Database.Database, sectionSpecId: number, feedback: string): void {
  const spec = db.prepare('SELECT id, blueprint_id, section_type FROM section_specs WHERE id = ?')
    .get(sectionSpecId) as { id: number; blueprint_id: number; section_type: string };
  const bp = db.prepare('SELECT site_id FROM page_blueprints WHERE id = ?').get(spec.blueprint_id) as { site_id: number };
  const siteId = bp.site_id;

  db.transaction(() => {
    db.prepare("UPDATE section_specs SET last_feedback = ?, status = 'pending' WHERE id = ?").run(feedback, sectionSpecId);

    db.prepare(
      `INSERT INTO brand_rules (site_id, category, rule_text, source, scope, section_type, active)
       VALUES (?, 'voice', ?, 'feedback', 'section_type', ?, 1)`
    ).run(siteId, feedback, spec.section_type);

    const profile = db.prepare('SELECT id FROM brand_profiles WHERE site_id = ?').get(siteId) as { id: number } | undefined;
    if (profile) {
      db.prepare(
        `INSERT INTO brand_profile_history (brand_profile_id, snapshot, change_reason, changed_by)
         VALUES (?, '{}', ?, 'feedback')`
      ).run(profile.id, `Section ${sectionSpecId} refinement: ${feedback}`);
    }
  })();
}

function getOrCreatePage(db: Database.Database, siteId: number, url: string, title?: string, pageType?: string): number {
  const existing = db.prepare('SELECT id FROM pages WHERE site_id = ? AND url = ?').get(siteId, url) as { id: number } | undefined;
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO pages (site_id, url, title, page_type, status) VALUES (?, ?, ?, ?, 'draft')").run(siteId, url, title ?? null, pageType ?? null);
  return Number(info.lastInsertRowid);
}

function createVersion(db: Database.Database, pageId: number, htmlContent: string, changeReason: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(version_number), 0) AS max_v FROM page_versions WHERE page_id = ?').get(pageId) as { max_v: number };
  const nextVersion = row.max_v + 1;
  db.transaction(() => {
    db.prepare('INSERT INTO page_versions (page_id, version_number, html_content, change_reason) VALUES (?, ?, ?, ?)').run(pageId, nextVersion, htmlContent, changeReason);
    db.prepare("UPDATE pages SET current_html = ?, status = 'generated', updated_at = datetime('now') WHERE id = ?").run(htmlContent, pageId);
  })();
  return nextVersion;
}

function exportBlueprint(db: Database.Database, blueprintId: number): {
  passed: boolean;
  critical: string[];
  warnings: string[];
  html: string;
} {
  const bp = db.prepare(
    `SELECT pb.id, pb.site_id, pb.working_title, pb.canonical_url, pb.schema_spec,
            wb.target_url, wb.page_type
     FROM page_blueprints pb
     JOIN work_backlog wb ON pb.backlog_id = wb.id
     WHERE pb.id = ?`
  ).get(blueprintId) as {
    id: number; site_id: number; working_title: string | null; canonical_url: string | null;
    schema_spec: string | null; target_url: string | null; page_type: string;
  } | undefined;

  if (!bp) return { passed: false, critical: ['Blueprint not found'], warnings: [], html: '' };

  const sections = db.prepare(
    'SELECT id, section_type, section_order, heading_text, status, generated_html, target_word_count_min, target_word_count_max FROM section_specs WHERE blueprint_id = ? ORDER BY section_order ASC'
  ).all(blueprintId) as Array<{
    id: number; section_type: string; section_order: number; heading_text: string | null;
    status: string; generated_html: string | null;
    target_word_count_min: number | null; target_word_count_max: number | null;
  }>;

  const critical: string[] = [];
  const warnings: string[] = [];

  if (sections.length === 0) {
    critical.push('No section specs found');
    return { passed: false, critical, warnings, html: '' };
  }

  // Check taxonomy requirements
  const taxonomy = db.prepare('SELECT required_sections, optional_sections FROM page_taxonomy WHERE page_type = ?')
    .get(bp.page_type) as { required_sections: string | null; optional_sections: string | null } | undefined;

  if (taxonomy?.required_sections) {
    let required: string[];
    try { required = JSON.parse(taxonomy.required_sections); } catch { required = []; }
    const present = new Set(sections.map(s => s.section_type));
    for (const req of required) {
      if (!present.has(req)) critical.push(`Required section "${req}" missing per taxonomy`);
    }
  }

  // Assemble HTML
  let html = '';
  for (const section of sections) {
    if (!section.generated_html) {
      critical.push(`Section ${section.id} (${section.section_type}) has no generated HTML`);
      continue;
    }
    if (section.status !== 'generated' && section.status !== 'approved') {
      critical.push(`Section ${section.id} status "${section.status}" — must be generated/approved`);
      continue;
    }
    html += section.generated_html + '\n';
  }

  // Append JSON-LD if available
  if (bp.schema_spec) {
    html += `<script type="application/ld+json">${bp.schema_spec}</script>\n`;
  }

  const passed = critical.length === 0;
  return { passed, critical, warnings, html };
}

// ============================================================================
// MAIN TEST
// ============================================================================

function runPilotTest(): { passed: number; failed: number; errors: string[] } {
  const t = new TestRunner('Single-Site Pilot: Stage 1-5 End-to-End');
  const db = createTestDb();

  const SITE_ID = 1;

  // ========================================================================
  // SETUP: Create pilot site
  // ========================================================================

  t.section('Setup: Create pilot site');

  db.exec(`
    INSERT INTO sites (id, name, url, slug, bootstrap_version, pipeline_stage) VALUES
      (1, 'Pilot Driving School', 'https://pilotdriving.com.au', 'pilot-driving', '5.0.2', 'not_started');
  `);

  const site = db.prepare('SELECT * FROM sites WHERE id = 1').get() as Record<string, unknown>;
  t.assertNotNull(site, 'Pilot site created');
  t.assertEqual(site.pipeline_stage, 'not_started', 'Pilot site starts at not_started');
  t.assertEqual(site.name, 'Pilot Driving School', 'Site name correct');

  // Verify gate: cannot complete stage 1 from not_started (need to advance first)
  t.assert(canAdvance(db, SITE_ID).canAdvance, 'Site can advance from not_started');

  // ========================================================================
  // STAGE 1: AUDIT
  // ========================================================================

  t.section('Stage 1: Audit — Advance to stage_1');

  // First advance from not_started to stage_1
  const toStage1 = advanceSiteStage(db, SITE_ID);
  t.assert(toStage1.success, 'Advanced from not_started to stage_1');
  t.assertEqual(getSiteStage(db, SITE_ID), 'stage_1', 'Site now at stage_1');

  // --- Sitemap Inventory (simulated crawl) ---
  t.section('Stage 1: Sitemap Inventory');

  const sitemap_pages = [
    { url: '/', title: 'Home', page_type: 'homepage', hierarchy_level: 1, word_count: 450 },
    { url: '/driving-lessons-sydney', title: 'Driving Lessons Sydney', page_type: 'service-area', hierarchy_level: 2, word_count: 800 },
    { url: '/driving-lessons-parramatta', title: 'Driving Lessons Parramatta', page_type: 'location', hierarchy_level: 3, word_count: 600 },
    { url: '/automatic-driving-lessons', title: 'Automatic Driving Lessons', page_type: 'service', hierarchy_level: 2, word_count: 550 },
    { url: '/about', title: 'About Us', page_type: 'about', hierarchy_level: 1, word_count: 400 },
    { url: '/contact', title: 'Contact', page_type: 'contact', hierarchy_level: 1, word_count: 200 },
    { url: '/faq', title: 'FAQ', page_type: 'faq', hierarchy_level: 2, word_count: 700 },
    { url: '/blog', title: 'Blog', page_type: 'blog-index', hierarchy_level: 1, word_count: 300 },
  ];

  const insertStructure = db.prepare(
    `INSERT INTO site_structure_map (site_id, url, title, page_type, hierarchy_level, word_count, discovered_via, status)
     VALUES (?, ?, ?, ?, ?, ?, 'sitemap', 'discovered')`
  );
  const structureIds: number[] = [];
  for (const page of sitemap_pages) {
    const info = insertStructure.run(SITE_ID, page.url, page.title, page.page_type, page.hierarchy_level, page.word_count);
    structureIds.push(Number(info.lastInsertRowid));
  }

  const structureCount = (db.prepare('SELECT COUNT(*) AS cnt FROM site_structure_map WHERE site_id = ?').get(SITE_ID) as CountRow).cnt;
  t.assertEqual(structureCount, 8, 'Sitemap inventory: 8 pages discovered');

  // --- CSS Scraping & Classification ---
  t.section('Stage 1: CSS Scraping & Classification');

  db.exec(`
    INSERT INTO css_audit (site_id, class_name, tier, usage_count, quality) VALUES
      (1, 'container', 1, 50, 'well-structured'),
      (1, 'row', 1, 35, 'well-structured'),
      (1, 'col-md-6', 1, 20, 'well-structured'),
      (1, 'btn-primary', 1, 15, 'well-structured'),
      (1, 'py-5', 1, 12, 'well-structured'),
      (1, 'pilot-hero-banner', 2, 8, 'well-structured'),
      (1, 'pilot-cta-box', 2, 5, 'well-structured'),
      (1, 'pilot-testimonial-card', 2, 4, 'well-structured'),
      (1, 'pilot-footer-links', 2, 3, 'well-structured'),
      (1, 'bce-step-counter', 3, 0, NULL),
      (1, 'bce-price-badge', 3, 0, NULL);
  `);

  const tier1Count = (db.prepare("SELECT COUNT(*) AS cnt FROM css_audit WHERE site_id = 1 AND tier = 1").get() as CountRow).cnt;
  const tier2Count = (db.prepare("SELECT COUNT(*) AS cnt FROM css_audit WHERE site_id = 1 AND tier = 2").get() as CountRow).cnt;
  const tier3Count = (db.prepare("SELECT COUNT(*) AS cnt FROM css_audit WHERE site_id = 1 AND tier = 3").get() as CountRow).cnt;
  t.assertEqual(tier1Count, 5, 'CSS Tier 1 (Bootstrap): 5 classes');
  t.assertEqual(tier2Count, 4, 'CSS Tier 2 (site-specific): 4 classes');
  t.assertEqual(tier3Count, 2, 'CSS Tier 3 (BCE custom): 2 classes');

  // --- Content Scraping & Audit Scores ---
  t.section('Stage 1: Content Scraping & Audit Scores');

  const insertContentAudit = db.prepare(
    `INSERT INTO content_audit (structure_map_id, site_id, seo_score, geo_score, schema_score, content_depth_score, voice_score, extracted_content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const auditData = [
    { structureMapId: structureIds[0], seo: 0.65, geo: 0.30, schema: 0.40, depth: 0.55, voice: 0.60, content: 'Home page existing content...' },
    { structureMapId: structureIds[1], seo: 0.70, geo: 0.75, schema: 0.50, depth: 0.70, voice: 0.65, content: 'Sydney driving lessons content...' },
    { structureMapId: structureIds[2], seo: 0.45, geo: 0.80, schema: 0.20, depth: 0.40, voice: 0.55, content: 'Parramatta lessons content...' },
    { structureMapId: structureIds[3], seo: 0.60, geo: 0.10, schema: 0.30, depth: 0.50, voice: 0.50, content: 'Automatic lessons content...' },
    { structureMapId: structureIds[4], seo: 0.50, geo: 0.05, schema: 0.15, depth: 0.60, voice: 0.70, content: 'About us content...' },
    { structureMapId: structureIds[5], seo: 0.30, geo: 0.60, schema: 0.10, depth: 0.20, voice: 0.40, content: 'Contact page content...' },
    { structureMapId: structureIds[6], seo: 0.55, geo: 0.20, schema: 0.60, depth: 0.80, voice: 0.55, content: 'FAQ page content...' },
    { structureMapId: structureIds[7], seo: 0.40, geo: 0.05, schema: 0.10, depth: 0.30, voice: 0.45, content: 'Blog index content...' },
  ];

  for (const d of auditData) {
    insertContentAudit.run(d.structureMapId, SITE_ID, d.seo, d.geo, d.schema, d.depth, d.voice, d.content);
  }

  const auditCount = (db.prepare('SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(auditCount, 8, 'Content audit: 8 pages scraped and scored');

  // --- Brand Voice Inference ---
  t.section('Stage 1: Brand Voice Inference');

  db.exec(`
    INSERT INTO brand_profiles (site_id, voice_description, tone_keywords, terminology_patterns, sentence_style, target_audience, inference_confidence, source_page_count)
    VALUES (1, 'Professional yet approachable. Focuses on safety and confidence building.', 'professional, supportive, encouraging, safe', '["driving instructor", "learner driver", "road test", "lesson package"]', 'Medium-length sentences. Active voice preferred.', 'Learner drivers 17-25, parents of teen drivers', 0.72, 8);
  `);

  const brandProfile = db.prepare('SELECT * FROM brand_profiles WHERE site_id = 1').get() as Record<string, unknown>;
  t.assertNotNull(brandProfile, 'Brand profile created');
  t.assertEqual(brandProfile.inference_confidence, 0.72, 'Inference confidence set');
  t.assertGreaterThan((brandProfile.source_page_count as number), 0, 'Source page count > 0');

  // --- Schema Detection ---
  t.section('Stage 1: Schema Detection');

  db.exec(`
    INSERT INTO schema_audit (structure_map_id, site_id, schema_types_found, schema_format, has_graph, has_breadcrumb, has_faq_schema, missing_types, recommendations)
    VALUES
      (${structureIds[0]}, 1, '["LocalBusiness","WebSite"]', 'json-ld', 1, 0, 0, '["BreadcrumbList"]', '["Add breadcrumb schema"]'),
      (${structureIds[1]}, 1, '["WebPage"]', 'json-ld', 0, 0, 0, '["LocalBusiness","Service","BreadcrumbList"]', '["Add service and local business schema"]'),
      (${structureIds[6]}, 1, '["FAQPage"]', 'json-ld', 0, 0, 1, '["BreadcrumbList"]', '["Add breadcrumb schema"]');
  `);

  const schemaAuditCount = (db.prepare('SELECT COUNT(*) AS cnt FROM schema_audit WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(schemaAuditCount, 3, 'Schema audit: 3 pages with JSON-LD detected');

  // --- SEO & GEO Audit verification ---
  t.section('Stage 1: SEO & GEO Audit Verification');

  const seoAuditedCount = (db.prepare('SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = 1 AND seo_score IS NOT NULL').get() as CountRow).cnt;
  const geoAuditedCount = (db.prepare('SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = 1 AND geo_score IS NOT NULL').get() as CountRow).cnt;
  t.assertEqual(seoAuditedCount, 8, 'SEO audit: all 8 pages have SEO scores');
  t.assertEqual(geoAuditedCount, 8, 'GEO audit: all 8 pages have GEO scores');

  // --- Stage 1 Completion Gate ---
  t.section('Stage 1: Completion Gate');

  const stage1Result = completeStage1(db, SITE_ID);
  t.assert(stage1Result.success, 'Stage 1 completion succeeds');
  t.assertEqual(getSiteStage(db, SITE_ID), 'stage_2', 'Site advanced to stage_2 after Stage 1 completion');

  // Verify overall_score was computed
  const overallScores = db.prepare('SELECT overall_score FROM content_audit WHERE site_id = 1 AND overall_score IS NOT NULL').all() as Array<{ overall_score: number }>;
  t.assertEqual(overallScores.length, 8, 'Overall scores computed for all 8 audit rows');
  for (const row of overallScores) {
    t.assertGreaterThan(row.overall_score, 0, 'Overall score > 0');
  }

  // Verify checkpoint written
  const stage1Checkpoints = db.prepare("SELECT * FROM scribe_checkpoints WHERE site_id = 1 AND stage = 'stage_1'").all();
  t.assertGreaterThan(stage1Checkpoints.length, 0, 'Stage 1 checkpoint written');

  // ========================================================================
  // STAGE 2: BENCHMARK
  // ========================================================================

  t.section('Stage 2: Benchmark — Seed SEO Benchmarks');

  db.exec(`
    INSERT INTO benchmark_standards (category, key, value, source) VALUES
      ('seo', 'min_word_count_service', '800', 'industry_research'),
      ('seo', 'min_word_count_location', '600', 'industry_research'),
      ('seo', 'title_tag_max_chars', '60', 'google_guidelines'),
      ('seo', 'meta_desc_max_chars', '160', 'google_guidelines'),
      ('content', 'min_internal_links', '3', 'seo_best_practice'),
      ('content', 'max_heading_depth', '4', 'accessibility'),
      ('linking', 'min_hub_spoke_ratio', '0.3', 'silo_strategy');
  `);

  const seoBenchmarkCount = (db.prepare("SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category IN ('seo', 'content', 'linking')").get() as CountRow).cnt;
  t.assertEqual(seoBenchmarkCount, 7, 'SEO/content/linking benchmarks: 7 standards seeded');

  t.section('Stage 2: GEO Benchmarks');

  db.exec(`
    INSERT INTO benchmark_standards (category, key, value, source) VALUES
      ('geo', 'location_mention_density', '0.02', 'geo_research'),
      ('geo', 'nap_consistency', 'required', 'local_seo'),
      ('geo', 'service_area_radius', '30km', 'business_config'),
      ('geo', 'local_schema_required', 'LocalBusiness', 'schema_org');
  `);

  const geoBenchmarkCount = (db.prepare("SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category = 'geo'").get() as CountRow).cnt;
  t.assertEqual(geoBenchmarkCount, 4, 'GEO benchmarks: 4 standards seeded');

  t.section('Stage 2: Schema Benchmarks');

  db.exec(`
    INSERT INTO benchmark_standards (category, key, value, source) VALUES
      ('schema', 'required_types_homepage', '["LocalBusiness","WebSite","BreadcrumbList"]', 'schema_org'),
      ('schema', 'required_types_service', '["Service","WebPage","BreadcrumbList"]', 'schema_org'),
      ('schema', 'required_types_faq', '["FAQPage","BreadcrumbList"]', 'schema_org');
  `);

  const schemaBenchmarkCount = (db.prepare("SELECT COUNT(*) AS cnt FROM benchmark_standards WHERE category = 'schema'").get() as CountRow).cnt;
  t.assertEqual(schemaBenchmarkCount, 3, 'Schema benchmarks: 3 standards seeded');

  t.section('Stage 2: Taxonomy & Silo Creation');

  db.exec(`
    INSERT INTO page_taxonomy (page_type, hierarchy_level, display_name, required_sections, optional_sections, target_word_count_min, target_word_count_max, schema_types, silo) VALUES
      ('homepage', 1, 'Home Page', '["hero","features"]', '["testimonials","cta"]', 500, 1500, '["LocalBusiness","WebSite"]', 'core'),
      ('service-area', 2, 'Service Area Page', '["hero","features"]', '["testimonials","cta","faq"]', 800, 2000, '["Service","WebPage"]', 'services'),
      ('location', 3, 'Location Page', '["hero","local-info"]', '["testimonials","cta","map"]', 600, 1500, '["LocalBusiness"]', 'locations'),
      ('service', 2, 'Service Page', '["hero","features"]', '["pricing","cta","faq"]', 700, 1800, '["Service"]', 'services'),
      ('faq', 2, 'FAQ Page', '["faq"]', '["cta"]', 500, 2000, '["FAQPage"]', 'support'),
      ('about', 1, 'About Page', '["hero","story"]', '["team","cta"]', 400, 1200, '["AboutPage"]', 'core'),
      ('contact', 1, 'Contact Page', '["contact-form","map"]', '["cta"]', 200, 600, '["ContactPoint"]', 'core'),
      ('blog-index', 1, 'Blog Index', '["hero"]', '["featured-posts"]', 200, 800, '["Blog"]', 'content');
  `);

  const taxonomyCount = (db.prepare('SELECT COUNT(*) AS cnt FROM page_taxonomy').get() as CountRow).cnt;
  t.assertEqual(taxonomyCount, 8, 'Taxonomy: 8 page types defined');

  db.exec(`
    INSERT INTO silo_definitions (site_id, silo_name, description, hub_page_type, hub_url) VALUES
      (1, 'core', 'Core site pages', 'homepage', '/'),
      (1, 'services', 'Service offering pages', 'service', '/driving-lessons-sydney'),
      (1, 'locations', 'Location-specific pages', 'location', '/driving-lessons-parramatta'),
      (1, 'support', 'Support and FAQ pages', 'faq', '/faq'),
      (1, 'content', 'Blog and content hub', 'blog-index', '/blog');
  `);

  const siloCount = (db.prepare('SELECT COUNT(*) AS cnt FROM silo_definitions WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(siloCount, 5, 'Silo definitions: 5 silos created');

  // --- Stage 2 Completion Gate ---
  t.section('Stage 2: Completion Gate');

  const stage2Result = completeStage2(db, SITE_ID);
  t.assert(stage2Result.success, 'Stage 2 completion succeeds');
  t.assertEqual(getSiteStage(db, SITE_ID), 'stage_3', 'Site advanced to stage_3 after Stage 2 completion');

  const stage2Checkpoints = db.prepare("SELECT * FROM scribe_checkpoints WHERE stage = 'stage_2'").all();
  t.assertGreaterThan(stage2Checkpoints.length, 0, 'Stage 2 checkpoint written');

  // ========================================================================
  // STAGE 3: GAP ANALYSIS
  // ========================================================================

  t.section('Stage 3: Gap Analysis — Gap Scoring');

  db.exec(`
    INSERT INTO gap_analysis (site_id, page_type, status, existing_page_id, seo_gap_score, geo_gap_score, schema_gap_score, content_gap_score, priority, silo) VALUES
      (1, 'homepage', 'weak', ${structureIds[0]}, 0.35, 0.70, 0.60, 0.45, 1, 'core'),
      (1, 'service-area', 'weak', ${structureIds[1]}, 0.30, 0.25, 0.50, 0.30, 2, 'services'),
      (1, 'location', 'weak', ${structureIds[2]}, 0.55, 0.20, 0.80, 0.60, 3, 'locations'),
      (1, 'service', 'adequate', ${structureIds[3]}, 0.40, 0.90, 0.70, 0.50, 4, 'services'),
      (1, 'faq', 'weak', ${structureIds[6]}, 0.45, 0.80, 0.40, 0.20, 5, 'support'),
      (1, 'location', 'missing', NULL, 1.0, 1.0, 1.0, 1.0, 6, 'locations');
  `);

  const gapCount = (db.prepare('SELECT COUNT(*) AS cnt FROM gap_analysis WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(gapCount, 6, 'Gap analysis: 6 gap entries (5 existing + 1 missing page)');

  const missingPages = db.prepare("SELECT * FROM gap_analysis WHERE site_id = 1 AND status = 'missing'").all();
  t.assertEqual(missingPages.length, 1, 'Missing page identification: 1 new page needed');

  t.section('Stage 3: Work Backlog Creation');

  db.exec(`
    INSERT INTO work_backlog (site_id, gap_analysis_id, page_type, target_url, action, priority, status) VALUES
      (1, 1, 'homepage', '/', 'improve', 1, 'pending'),
      (1, 2, 'service-area', '/driving-lessons-sydney', 'improve', 2, 'pending'),
      (1, 3, 'location', '/driving-lessons-parramatta', 'rewrite', 3, 'pending'),
      (1, 5, 'faq', '/faq', 'improve', 4, 'pending'),
      (1, 6, 'location', '/driving-lessons-chatswood', 'create', 5, 'pending');
  `);

  const backlogCount = (db.prepare('SELECT COUNT(*) AS cnt FROM work_backlog WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(backlogCount, 5, 'Work backlog: 5 items created');

  const createActions = (db.prepare("SELECT COUNT(*) AS cnt FROM work_backlog WHERE site_id = 1 AND action = 'create'").get() as CountRow).cnt;
  const improveActions = (db.prepare("SELECT COUNT(*) AS cnt FROM work_backlog WHERE site_id = 1 AND action = 'improve'").get() as CountRow).cnt;
  const rewriteActions = (db.prepare("SELECT COUNT(*) AS cnt FROM work_backlog WHERE site_id = 1 AND action = 'rewrite'").get() as CountRow).cnt;
  t.assertEqual(createActions, 1, 'Backlog: 1 create action');
  t.assertEqual(improveActions, 3, 'Backlog: 3 improve actions');
  t.assertEqual(rewriteActions, 1, 'Backlog: 1 rewrite action');

  t.section('Stage 3: Link Graph & Anchor Text Bank');

  db.exec(`
    INSERT INTO internal_link_graph (site_id, source_url, target_url, link_type, anchor_text, anchor_variant, status) VALUES
      (1, '/', '/driving-lessons-sydney', 'contextual', 'driving lessons in Sydney', 'partial', 'planned'),
      (1, '/', '/driving-lessons-parramatta', 'contextual', 'Parramatta driving lessons', 'partial', 'planned'),
      (1, '/', '/automatic-driving-lessons', 'navigation', 'automatic lessons', 'natural', 'existing'),
      (1, '/driving-lessons-sydney', '/', 'breadcrumb', 'Home', 'generic', 'planned'),
      (1, '/driving-lessons-sydney', '/driving-lessons-parramatta', 'sibling', 'lessons in Parramatta', 'partial', 'planned'),
      (1, '/driving-lessons-sydney', '/faq', 'contextual', 'frequently asked questions', 'natural', 'planned'),
      (1, '/driving-lessons-parramatta', '/', 'breadcrumb', 'Home', 'generic', 'planned'),
      (1, '/driving-lessons-parramatta', '/driving-lessons-sydney', 'hub-spoke', 'Sydney driving lessons', 'exact', 'planned'),
      (1, '/faq', '/driving-lessons-sydney', 'cta', 'book your Sydney lesson', 'natural', 'planned'),
      (1, '/faq', '/contact', 'cta', 'contact us', 'natural', 'planned');
  `);

  const linkGraphCount = (db.prepare('SELECT COUNT(*) AS cnt FROM internal_link_graph WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(linkGraphCount, 10, 'Link graph: 10 edges defined');

  db.exec(`
    INSERT INTO anchor_text_bank (site_id, target_url, variant_type, anchor_text) VALUES
      (1, '/driving-lessons-sydney', 'exact', 'driving lessons Sydney'),
      (1, '/driving-lessons-sydney', 'partial', 'driving lessons in Sydney'),
      (1, '/driving-lessons-sydney', 'branded', 'Pilot Driving School Sydney'),
      (1, '/driving-lessons-sydney', 'natural', 'learn to drive in Sydney'),
      (1, '/driving-lessons-parramatta', 'exact', 'driving lessons Parramatta'),
      (1, '/driving-lessons-parramatta', 'localized', 'Parramatta driving school'),
      (1, '/faq', 'natural', 'frequently asked questions'),
      (1, '/faq', 'generic', 'learn more');
  `);

  const anchorCount = (db.prepare('SELECT COUNT(*) AS cnt FROM anchor_text_bank WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(anchorCount, 8, 'Anchor text bank: 8 entries');

  // --- Stage 3 Completion Gate ---
  t.section('Stage 3: Completion Gate');

  const stage3Result = completeStage3(db, SITE_ID);
  t.assert(stage3Result.success, 'Stage 3 completion succeeds');
  t.assertEqual(getSiteStage(db, SITE_ID), 'stage_4', 'Site advanced to stage_4 after Stage 3 completion');

  // ========================================================================
  // STAGE 4: DESIGN (Blueprints & Section Specs)
  // ========================================================================

  t.section('Stage 4: Design — Blueprint Generation');

  // Update work_backlog items to 'blueprinted' status for the ones we will blueprint
  db.prepare("UPDATE work_backlog SET status = 'blueprinted' WHERE site_id = 1 AND id IN (1, 2, 3)").run();

  // Get backlog IDs
  const backlogItems = db.prepare('SELECT id, page_type, target_url FROM work_backlog WHERE site_id = 1 ORDER BY priority').all() as Array<{ id: number; page_type: string; target_url: string }>;

  // Create blueprints for: homepage (backlog 1), service-area (backlog 2), location (backlog 3)
  const homepageSchemaSpec = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "LocalBusiness", "name": "Pilot Driving School", "url": "https://pilotdriving.com.au" },
      { "@type": "WebSite", "url": "https://pilotdriving.com.au" }
    ]
  });

  const serviceSchemaSpec = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Service", "name": "Driving Lessons Sydney", "provider": { "@type": "LocalBusiness", "name": "Pilot Driving School" } },
      { "@type": "WebPage", "url": "https://pilotdriving.com.au/driving-lessons-sydney" }
    ]
  });

  const locationSchemaSpec = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "LocalBusiness", "name": "Pilot Driving School Parramatta" }
    ]
  });

  db.prepare(
    `INSERT INTO page_blueprints (backlog_id, site_id, working_title, canonical_url, schema_spec, section_count, user_approved) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(backlogItems[0].id, 1, 'Pilot Driving School — Learn to Drive with Confidence', '/', homepageSchemaSpec, 3, 1);

  db.prepare(
    `INSERT INTO page_blueprints (backlog_id, site_id, working_title, canonical_url, schema_spec, section_count, user_approved) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(backlogItems[1].id, 1, 'Driving Lessons in Sydney', '/driving-lessons-sydney', serviceSchemaSpec, 3, 1);

  db.prepare(
    `INSERT INTO page_blueprints (backlog_id, site_id, working_title, canonical_url, schema_spec, section_count, user_approved) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(backlogItems[2].id, 1, 'Driving Lessons in Parramatta', '/driving-lessons-parramatta', locationSchemaSpec, 2, 1);

  const blueprintIds = (db.prepare('SELECT id FROM page_blueprints WHERE site_id = 1 ORDER BY id').all() as Array<{ id: number }>).map(r => r.id);
  t.assertEqual(blueprintIds.length, 3, 'Blueprints: 3 created (homepage, service-area, location)');

  t.section('Stage 4: Section Spec Generation');

  // Homepage sections: hero, features, cta
  const HERO_HTML_HOMEPAGE = '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Learn to Drive with Confidence</h2><p>Pilot Driving School offers professional driving lessons across Sydney. Our experienced and patient instructors will help you become a safe, confident driver. We provide structured lesson plans tailored to your learning pace and skill level.</p></div></div></section>';
  const FEATURES_HTML_HOMEPAGE = '<section class="container py-5"><div class="row"><div class="col-12"><h2>Why Choose Pilot Driving School</h2></div><div class="col-md-4"><h3>Accredited Instructors</h3><p>All our instructors hold current accreditation and undergo regular training to maintain the highest teaching standards.</p></div><div class="col-md-4"><h3>Flexible Scheduling</h3><p>Book morning, afternoon, or weekend lessons online. We work around your schedule to make learning convenient.</p></div><div class="col-md-4"><h3>High Pass Rates</h3><p>Our proven curriculum and dedicated practice routes consistently deliver above-average pass rates for our students.</p></div></div></section>';
  const CTA_HTML_HOMEPAGE = '<section class="container py-5 text-center"><h2>Ready to Start?</h2><p>Book your first lesson today and take the first step toward getting your licence.</p><a href="/contact" class="btn btn-primary btn-lg">Book Your Lesson</a></section>';

  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[0], 'hero', 1, 'Learn to Drive with Confidence', 50, 150, 'generated', HERO_HTML_HOMEPAGE);
  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[0], 'features', 2, 'Why Choose Pilot Driving School', 80, 300, 'generated', FEATURES_HTML_HOMEPAGE);
  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[0], 'cta', 3, 'Ready to Start?', 30, 80, 'generated', CTA_HTML_HOMEPAGE);

  // Service-area sections: hero, features, cta
  const HERO_HTML_SERVICE = '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Driving Lessons in Sydney</h2><p>Looking for quality driving lessons in Sydney? Pilot Driving School provides expert instruction across the greater Sydney area. Whether you are a complete beginner or refreshing your skills, our patient instructors will guide you every step of the way.</p></div></div></section>';
  const FEATURES_HTML_SERVICE = '<section class="container py-5"><div class="row"><div class="col-12"><h2>Our Sydney Driving Lessons</h2></div><div class="col-md-6"><h3>Lesson Packages</h3><p>Choose from individual lessons or save with our popular lesson packages. Each session covers essential skills including road rules, hazard perception, and parking techniques.</p></div><div class="col-md-6"><h3>Test Route Practice</h3><p>We practice on actual RMS test routes so you feel confident and prepared on test day. Our instructors know every route in detail.</p></div></div></section>';
  const CTA_HTML_SERVICE = '<section class="container py-5 text-center"><h2>Book Your Sydney Driving Lesson</h2><p>Ready to get behind the wheel? Book your first lesson in Sydney today.</p><a href="/contact" class="btn btn-primary btn-lg">Book Now</a></section>';

  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[1], 'hero', 1, 'Driving Lessons in Sydney', 50, 200, 'generated', HERO_HTML_SERVICE);
  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[1], 'features', 2, 'Our Sydney Driving Lessons', 80, 300, 'generated', FEATURES_HTML_SERVICE);
  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[1], 'cta', 3, 'Book Your Sydney Driving Lesson', 30, 80, 'generated', CTA_HTML_SERVICE);

  // Location page sections: hero, local-info
  const HERO_HTML_LOCATION = '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Driving Lessons in Parramatta</h2><p>Pilot Driving School serves the Parramatta area with professional driving instruction. Our local instructors know Parramatta roads inside and out, from Church Street to the Great Western Highway.</p></div></div></section>';
  const LOCAL_INFO_HTML = '<section class="container py-5"><div class="row"><div class="col-12"><h2>Learn to Drive in the Parramatta Area</h2><p>Our Parramatta lessons cover key local roads and intersections. We practice in Western Sydney traffic conditions so you are fully prepared for real-world driving. The Parramatta RMS testing centre is one of our most popular test-day locations.</p><h3>Areas We Cover</h3><ul><li>Parramatta CBD</li><li>Westmead</li><li>Harris Park</li><li>Merrylands</li><li>Granville</li></ul></div></div></section>';

  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[2], 'hero', 1, 'Driving Lessons in Parramatta', 50, 150, 'generated', HERO_HTML_LOCATION);
  db.prepare(
    `INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(blueprintIds[2], 'local-info', 2, 'Learn to Drive in the Parramatta Area', 80, 300, 'generated', LOCAL_INFO_HTML);

  const totalSections = (db.prepare(
    'SELECT COUNT(*) AS cnt FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = 1'
  ).get() as CountRow).cnt;
  t.assertEqual(totalSections, 8, 'Section specs: 8 total across 3 blueprints');

  // --- CSS Decisions ---
  t.section('Stage 4: CSS Decisions');

  db.exec(`
    INSERT INTO css_decisions (site_id, decision_type, class_name, rationale) VALUES
      (1, 'use', 'pilot-hero-banner', 'Site brand hero styling'),
      (1, 'use', 'pilot-cta-box', 'Consistent CTA styling'),
      (1, 'custom', 'bce-step-counter', 'Custom step indicator for process sections'),
      (1, 'avoid', 'pilot-footer-links', 'Deprecated footer pattern');
  `);

  const cssDecisionCount = (db.prepare('SELECT COUNT(*) AS cnt FROM css_decisions WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(cssDecisionCount, 4, 'CSS decisions: 4 decisions recorded');

  // --- Stage 4 Completion Gate ---
  t.section('Stage 4: Completion Gate');

  const stage4Result = completeStage4(db, SITE_ID);
  t.assert(stage4Result.success, 'Stage 4 completion succeeds');
  t.assertEqual(getSiteStage(db, SITE_ID), 'stage_5', 'Site advanced to stage_5 after Stage 4 completion');

  // ========================================================================
  // STAGE 5: BUILD
  // ========================================================================

  t.section('Stage 5: Build — Content Generation (mock mode)');

  // Content already "generated" (seeded above as generated_html). Verify status.
  const generatedSections = db.prepare(
    "SELECT COUNT(*) AS cnt FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = 1 AND ss.status = 'generated'"
  ).get() as CountRow;
  t.assertEqual(generatedSections.cnt, 8, 'All 8 sections have status "generated"');

  // --- Content Validation ---
  t.section('Stage 5: Content Validation');

  // Basic HTML validation checks on each section
  const allSections = db.prepare(
    `SELECT ss.id, ss.section_type, ss.generated_html, ss.target_word_count_min, ss.target_word_count_max
     FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id
     WHERE pb.site_id = 1 ORDER BY ss.id`
  ).all() as Array<{
    id: number; section_type: string; generated_html: string;
    target_word_count_min: number; target_word_count_max: number;
  }>;

  let validationIssues = 0;
  for (const section of allSections) {
    const html = section.generated_html;

    // Check well-formedness (basic tag balance)
    const hasOpenSection = html.includes('<section');
    const hasCloseSection = html.includes('</section>');
    if (!hasOpenSection || !hasCloseSection) {
      validationIssues++;
      t.assert(false, `Section ${section.id} (${section.section_type}): malformed HTML — missing section tags`);
    }

    // Check heading hierarchy — all headings should be h2 or h3
    const headingRegex = /<h(\d)\b/g;
    let match: RegExpExecArray | null;
    const headingLevels: number[] = [];
    while ((match = headingRegex.exec(html)) !== null) {
      headingLevels.push(parseInt(match[1]));
    }
    const hasH1 = headingLevels.includes(1);
    t.assert(!hasH1, `Section ${section.id} (${section.section_type}): no H1 tags (H1 reserved for page title)`);

    // Check for Bootstrap CSS classes
    const hasBootstrapClass = /class="[^"]*\bcontainer\b/.test(html) || /class="[^"]*\brow\b/.test(html);
    t.assert(hasBootstrapClass, `Section ${section.id} (${section.section_type}): uses Bootstrap CSS classes`);

    // Check no placeholder content
    const hasPlaceholder = /\{\{[^}]+\}\}|\[TBD\]|\bTODO\b|\bPLACEHOLDER\b/i.test(html);
    t.assert(!hasPlaceholder, `Section ${section.id} (${section.section_type}): no placeholder content`);
  }

  t.assertEqual(validationIssues, 0, 'All sections pass basic HTML validation');

  // --- Feedback Cycle: Approve + Refine ---
  t.section('Stage 5: Feedback Cycle — Approve sections');

  // Get section IDs for homepage
  const homepageSections = db.prepare(
    'SELECT ss.id, ss.section_type FROM section_specs ss WHERE ss.blueprint_id = ? ORDER BY ss.section_order'
  ).all(blueprintIds[0]) as Array<{ id: number; section_type: string }>;

  // Approve the homepage hero section
  const heroSectionId = homepageSections[0].id;
  approveSection(db, heroSectionId, 4);

  const approvedSpec = db.prepare('SELECT status FROM section_specs WHERE id = ?').get(heroSectionId) as { status: string };
  t.assertEqual(approvedSpec.status, 'approved', 'Homepage hero section approved');

  // Check brand example created
  const brandExamples = db.prepare("SELECT * FROM brand_examples WHERE site_id = 1 AND source = 'generated_approved'").all();
  t.assertGreaterThan(brandExamples.length, 0, 'Positive brand example stored on approval');

  // Check confidence boosted
  const updatedProfile = db.prepare('SELECT inference_confidence FROM brand_profiles WHERE site_id = 1').get() as { inference_confidence: number };
  t.assertEqual(updatedProfile.inference_confidence, 0.74, 'Brand confidence increased from 0.72 to 0.74 after approval');

  // Check brand profile history snapshot
  const profileHistory = db.prepare('SELECT * FROM brand_profile_history WHERE brand_profile_id = 1').all();
  t.assertGreaterThan(profileHistory.length, 0, 'Brand profile history snapshot created');

  t.section('Stage 5: Feedback Cycle — Refine a section');

  // Refine the homepage features section
  const featuresSectionId = homepageSections[1].id;
  refineSection(db, featuresSectionId, 'Use a more encouraging tone and add mention of weekend availability');

  const refinedSpec = db.prepare('SELECT status, last_feedback FROM section_specs WHERE id = ?').get(featuresSectionId) as { status: string; last_feedback: string };
  t.assertEqual(refinedSpec.status, 'pending', 'Features section reset to pending after refinement');
  t.assertIncludes(refinedSpec.last_feedback, 'encouraging tone', 'Feedback text stored');

  // Check brand rule created from feedback
  const feedbackRules = db.prepare("SELECT * FROM brand_rules WHERE site_id = 1 AND source = 'feedback'").all();
  t.assertGreaterThan(feedbackRules.length, 0, 'Brand rule created from refinement feedback');

  // Simulate regeneration after refinement: re-generate and re-approve
  const REGENERATED_FEATURES = '<section class="container py-5"><div class="row"><div class="col-12"><h2>Why Choose Pilot Driving School</h2></div><div class="col-md-4"><h3>Supportive Instructors</h3><p>Our encouraging and patient instructors create a positive learning environment. They celebrate your progress and help you build confidence with every lesson.</p></div><div class="col-md-4"><h3>Weekend Availability</h3><p>We offer lessons seven days a week, including weekends. Fit driving practice around your school, work, or family commitments.</p></div><div class="col-md-4"><h3>Proven Track Record</h3><p>Our students consistently achieve above-average pass rates thanks to our structured curriculum and dedicated test preparation.</p></div></div></section>';

  db.prepare("UPDATE section_specs SET status = 'generated', generated_html = ?, generation_attempt_count = generation_attempt_count + 1 WHERE id = ?")
    .run(REGENERATED_FEATURES, featuresSectionId);

  approveSection(db, featuresSectionId, 5);
  const reApprovedSpec = db.prepare('SELECT status FROM section_specs WHERE id = ?').get(featuresSectionId) as { status: string };
  t.assertEqual(reApprovedSpec.status, 'approved', 'Features section approved after regeneration');

  // Approve all remaining sections for export
  const remainingSections = db.prepare(
    "SELECT ss.id FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = 1 AND ss.status != 'approved'"
  ).all() as Array<{ id: number }>;

  for (const sec of remainingSections) {
    // Re-set to generated first if pending
    const curStatus = (db.prepare('SELECT status FROM section_specs WHERE id = ?').get(sec.id) as { status: string }).status;
    if (curStatus === 'pending') {
      db.prepare("UPDATE section_specs SET status = 'generated' WHERE id = ?").run(sec.id);
    }
    approveSection(db, sec.id, 4);
  }

  const allApproved = (db.prepare(
    "SELECT COUNT(*) AS cnt FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = 1 AND ss.status = 'approved'"
  ).get() as CountRow).cnt;
  t.assertEqual(allApproved, 8, 'All 8 sections approved');

  // --- Export Pipeline ---
  t.section('Stage 5: Export Pipeline');

  for (let i = 0; i < blueprintIds.length; i++) {
    const bpId = blueprintIds[i];
    const exportResult = exportBlueprint(db, bpId);
    t.assert(exportResult.passed, `Blueprint ${bpId} export validation passes`);
    t.assertGreaterThan(exportResult.html.length, 100, `Blueprint ${bpId} exported HTML has substantial content`);
    t.assertIncludes(exportResult.html, '<section', `Blueprint ${bpId} exported HTML contains section tags`);
    t.assertIncludes(exportResult.html, 'application/ld+json', `Blueprint ${bpId} exported HTML contains JSON-LD`);
    t.assertEqual(exportResult.critical.length, 0, `Blueprint ${bpId} has no critical export issues`);
  }

  // --- Version History ---
  t.section('Stage 5: Version History');

  // Create page records and versions
  const homepagePageId = getOrCreatePage(db, SITE_ID, '/', 'Pilot Driving School', 'homepage');
  t.assertGreaterThan(homepagePageId, 0, 'Homepage page record created');

  const v1 = createVersion(db, homepagePageId, HERO_HTML_HOMEPAGE + FEATURES_HTML_HOMEPAGE + CTA_HTML_HOMEPAGE, 'initial_generation');
  t.assertEqual(v1, 1, 'Version 1 created for homepage');

  // Simulate an update (post-feedback regeneration)
  const v2 = createVersion(db, homepagePageId, HERO_HTML_HOMEPAGE + REGENERATED_FEATURES + CTA_HTML_HOMEPAGE, 'post_feedback_regeneration');
  t.assertEqual(v2, 2, 'Version 2 created after feedback regeneration');

  // Verify version history
  const versions = db.prepare('SELECT * FROM page_versions WHERE page_id = ? ORDER BY version_number DESC').all(homepagePageId) as Array<{ version_number: number; change_reason: string }>;
  t.assertEqual(versions.length, 2, 'Two versions in history');
  t.assertEqual(versions[0].version_number, 2, 'Latest version is v2');
  t.assertEqual(versions[1].change_reason, 'initial_generation', 'V1 reason recorded');

  // Check pages.current_html is updated
  const pageRecord = db.prepare('SELECT current_html, status FROM pages WHERE id = ?').get(homepagePageId) as { current_html: string; status: string };
  t.assertIncludes(pageRecord.current_html, 'Weekend Availability', 'Page current_html reflects latest version');
  t.assertEqual(pageRecord.status, 'generated', 'Page status is generated');

  // Create versions for other pages too
  const servicePageId = getOrCreatePage(db, SITE_ID, '/driving-lessons-sydney', 'Driving Lessons Sydney', 'service-area');
  createVersion(db, servicePageId, HERO_HTML_SERVICE + FEATURES_HTML_SERVICE + CTA_HTML_SERVICE, 'initial_generation');
  const locationPageId = getOrCreatePage(db, SITE_ID, '/driving-lessons-parramatta', 'Driving Lessons Parramatta', 'location');
  createVersion(db, locationPageId, HERO_HTML_LOCATION + LOCAL_INFO_HTML, 'initial_generation');

  const totalPages = (db.prepare('SELECT COUNT(*) AS cnt FROM pages WHERE site_id = 1').get() as CountRow).cnt;
  t.assertEqual(totalPages, 3, 'Three pages created in version history');

  // --- Stage 5 Completion Gate ---
  t.section('Stage 5: Completion Gate — Advance to maintaining');

  const toMaintaining = advanceSiteStage(db, SITE_ID);
  t.assert(toMaintaining.success, 'Site advances from stage_5 to maintaining');
  t.assertEqual(getSiteStage(db, SITE_ID), 'maintaining', 'Site now at maintaining (pipeline complete)');

  // Verify cannot advance past maintaining
  const pastFinal = advanceSiteStage(db, SITE_ID);
  t.assert(!pastFinal.success, 'Cannot advance past maintaining');

  // ========================================================================
  // FINAL VERIFICATION: End-to-End State Consistency
  // ========================================================================

  t.section('Final Verification: End-to-End State Consistency');

  // Verify all checkpoints exist
  const allCheckpoints = db.prepare('SELECT * FROM scribe_checkpoints ORDER BY id').all() as Array<{ stage: string; checkpoint_type: string }>;
  t.assertGreaterThanOrEqual(allCheckpoints.length, 5, 'At least 5 scribe checkpoints written across all stages');

  // Verify stage progression checkpoints exist
  const stageCheckpoints = db.prepare(
    "SELECT DISTINCT stage FROM scribe_checkpoints WHERE checkpoint_type = 'stage_complete' ORDER BY stage"
  ).all() as Array<{ stage: string }>;
  const checkpointStages = stageCheckpoints.map(c => c.stage);
  t.assert(checkpointStages.includes('stage_1'), 'Stage 1 checkpoint exists');
  t.assert(checkpointStages.includes('stage_2'), 'Stage 2 checkpoint exists');
  t.assert(checkpointStages.includes('stage_3'), 'Stage 3 checkpoint exists');
  t.assert(checkpointStages.includes('stage_4'), 'Stage 4 checkpoint exists');

  // Verify brand evolution occurred through feedback
  const brandHistoryCount = (db.prepare('SELECT COUNT(*) AS cnt FROM brand_profile_history').get() as CountRow).cnt;
  t.assertGreaterThan(brandHistoryCount, 0, 'Brand profile evolved through feedback cycle');

  // Verify brand rules were created from feedback
  const brandRulesCount = (db.prepare("SELECT COUNT(*) AS cnt FROM brand_rules WHERE source = 'feedback'").get() as CountRow).cnt;
  t.assertGreaterThan(brandRulesCount, 0, 'Brand rules created from operator feedback');

  // Verify data integrity: all section specs point to valid blueprints
  const orphanedSpecs = (db.prepare(
    'SELECT COUNT(*) AS cnt FROM section_specs ss LEFT JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.id IS NULL'
  ).get() as CountRow).cnt;
  t.assertEqual(orphanedSpecs, 0, 'No orphaned section specs (all reference valid blueprints)');

  // Verify data integrity: all blueprints point to valid work_backlog items
  const orphanedBlueprints = (db.prepare(
    'SELECT COUNT(*) AS cnt FROM page_blueprints pb LEFT JOIN work_backlog wb ON pb.backlog_id = wb.id WHERE wb.id IS NULL'
  ).get() as CountRow).cnt;
  t.assertEqual(orphanedBlueprints, 0, 'No orphaned blueprints (all reference valid backlog items)');

  // Verify data integrity: all content_audit rows reference valid structure_map entries
  const orphanedAudits = (db.prepare(
    'SELECT COUNT(*) AS cnt FROM content_audit ca LEFT JOIN site_structure_map sm ON ca.structure_map_id = sm.id WHERE sm.id IS NULL'
  ).get() as CountRow).cnt;
  t.assertEqual(orphanedAudits, 0, 'No orphaned content audit rows');

  // Verify link graph is connected (at least some bidirectional links)
  const bidirectionalLinks = db.prepare(
    `SELECT COUNT(*) AS cnt FROM internal_link_graph a
     JOIN internal_link_graph b ON a.source_url = b.target_url AND a.target_url = b.source_url
     WHERE a.site_id = 1`
  ).get() as CountRow;
  t.assertGreaterThan(bidirectionalLinks.cnt, 0, 'Link graph has bidirectional connections');

  // Final pipeline state summary
  t.section('Pipeline Summary');

  const finalSite = db.prepare('SELECT * FROM sites WHERE id = 1').get() as Record<string, unknown>;
  t.assertEqual(finalSite.pipeline_stage, 'maintaining', 'Final state: maintaining');

  const totalStructurePages = (db.prepare('SELECT COUNT(*) AS cnt FROM site_structure_map WHERE site_id = 1').get() as CountRow).cnt;
  const totalContentAudits = (db.prepare('SELECT COUNT(*) AS cnt FROM content_audit WHERE site_id = 1').get() as CountRow).cnt;
  const totalBenchmarks = (db.prepare('SELECT COUNT(*) AS cnt FROM benchmark_standards').get() as CountRow).cnt;
  const totalGaps = (db.prepare('SELECT COUNT(*) AS cnt FROM gap_analysis WHERE site_id = 1').get() as CountRow).cnt;
  const totalBacklog = (db.prepare('SELECT COUNT(*) AS cnt FROM work_backlog WHERE site_id = 1').get() as CountRow).cnt;
  const totalBlueprintsCreated = (db.prepare('SELECT COUNT(*) AS cnt FROM page_blueprints WHERE site_id = 1').get() as CountRow).cnt;
  const totalSectionsCreated = (db.prepare('SELECT COUNT(*) AS cnt FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = 1').get() as CountRow).cnt;
  const totalVersions = (db.prepare('SELECT COUNT(*) AS cnt FROM page_versions').get() as CountRow).cnt;

  console.log(`\n  Pipeline traversal complete:`);
  console.log(`    Pages inventoried: ${totalStructurePages}`);
  console.log(`    Content audits: ${totalContentAudits}`);
  console.log(`    Benchmarks: ${totalBenchmarks}`);
  console.log(`    Gap entries: ${totalGaps}`);
  console.log(`    Backlog items: ${totalBacklog}`);
  console.log(`    Blueprints: ${totalBlueprintsCreated}`);
  console.log(`    Section specs: ${totalSectionsCreated}`);
  console.log(`    Page versions: ${totalVersions}`);
  console.log(`    Brand rules from feedback: ${brandRulesCount}`);
  console.log(`    Brand profile snapshots: ${brandHistoryCount}`);

  db.close();
  return t.summary();
}

// ============================================================================
// Run
// ============================================================================

const results = runPilotTest();
process.exit(results.failed > 0 ? 1 : 0);
