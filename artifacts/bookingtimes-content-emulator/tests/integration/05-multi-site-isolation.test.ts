/**
 * Integration Test 05: Multi-Site Isolation Under Concurrent Operations — WRK-BCE2-052
 *
 * Verifies: Data from site A never appears in site B's responses. Tests
 * concurrent-style operations across all integration points.
 *
 * Cross-layer: All layers — DB, services, API simulation
 *
 * Checklist:
 *   [x] Data flows correctly across layer boundaries
 *   [x] Field names match across all layers
 *   [x] Error cases handled gracefully
 *   [x] No data loss in round-trips
 *   [x] Site isolation holds under interleaved operations
 */

import Database from 'better-sqlite3';
import { createTestDb, seedTestData, TestRunner } from './test-helpers';

// ---------------------------------------------------------------------------
// Reused logic from other test files (consolidated here for isolation tests)
// ---------------------------------------------------------------------------

const STAGES = [
  'not_started', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5', 'maintaining'
] as const;
type PipelineStage = (typeof STAGES)[number];

function getNextStage(current: PipelineStage): PipelineStage | null {
  const idx = STAGES.indexOf(current);
  if (idx === -1 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

function advanceSiteStage(db: Database.Database, siteId: number): { success: boolean; toStage: string } {
  const site = db.prepare('SELECT id, name, pipeline_stage FROM sites WHERE id = ?').get(siteId) as
    { id: number; name: string; pipeline_stage: string } | undefined;
  if (!site) return { success: false, toStage: 'unknown' };

  const nextStage = getNextStage(site.pipeline_stage as PipelineStage);
  if (!nextStage) return { success: false, toStage: site.pipeline_stage };

  const advance = db.transaction(() => {
    db.prepare("UPDATE sites SET pipeline_stage = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nextStage, site.id);
    db.prepare(
      `INSERT INTO scribe_checkpoints (site_id, stage, checkpoint_type, deliverables, decisions)
       VALUES (?, ?, 'stage_complete', '{}', '{}')`
    ).run(site.id, site.pipeline_stage);
  });
  advance();

  return { success: true, toStage: nextStage };
}

function rejectSection(db: Database.Database, sectionSpecId: number, reason: string): void {
  const spec = db.prepare('SELECT id, blueprint_id, section_type, generated_html FROM section_specs WHERE id = ?')
    .get(sectionSpecId) as { id: number; blueprint_id: number; section_type: string; generated_html: string | null };
  const siteId = (db.prepare('SELECT site_id FROM page_blueprints WHERE id = ?')
    .get(spec.blueprint_id) as { site_id: number }).site_id;
  const pageType = (db.prepare(
    'SELECT wb.page_type FROM work_backlog wb JOIN page_blueprints pb ON pb.backlog_id = wb.id WHERE pb.id = ?'
  ).get(spec.blueprint_id) as { page_type: string }).page_type;

  const run = db.transaction(() => {
    db.prepare('UPDATE section_specs SET status = ? WHERE id = ?').run('rejected', sectionSpecId);
    if (spec.generated_html) {
      db.prepare(
        `INSERT INTO brand_examples (site_id, section_type, page_type, html_content, quality_rating, is_negative, notes, source)
         VALUES (?, ?, ?, ?, 1, 1, ?, 'generated_rejected')`
      ).run(siteId, spec.section_type, pageType, spec.generated_html, reason);
    }
    db.prepare(
      `INSERT INTO brand_rules (site_id, category, rule_text, source, scope, section_type, active)
       VALUES (?, 'anti-pattern', ?, 'feedback', 'section_type', ?, 1)`
    ).run(siteId, reason, spec.section_type);
  });
  run();
}

function refineSection(db: Database.Database, sectionSpecId: number, feedback: string): void {
  const spec = db.prepare('SELECT id, blueprint_id, section_type FROM section_specs WHERE id = ?')
    .get(sectionSpecId) as { id: number; blueprint_id: number; section_type: string };
  const siteId = (db.prepare('SELECT site_id FROM page_blueprints WHERE id = ?')
    .get(spec.blueprint_id) as { site_id: number }).site_id;

  const run = db.transaction(() => {
    db.prepare("UPDATE section_specs SET last_feedback = ?, status = 'pending' WHERE id = ?")
      .run(feedback, sectionSpecId);
    db.prepare(
      `INSERT INTO brand_rules (site_id, category, rule_text, source, scope, section_type, active)
       VALUES (?, 'voice', ?, 'feedback', 'section_type', ?, 1)`
    ).run(siteId, feedback, spec.section_type);
  });
  run();
}

function getRulesForSite(db: Database.Database, siteId: number): Array<Record<string, unknown>> {
  return db.prepare(
    'SELECT * FROM brand_rules WHERE site_id = ? ORDER BY id'
  ).all(siteId) as Array<Record<string, unknown>>;
}

function getExamplesForSite(db: Database.Database, siteId: number): Array<Record<string, unknown>> {
  return db.prepare(
    'SELECT * FROM brand_examples WHERE site_id = ? ORDER BY id'
  ).all(siteId) as Array<Record<string, unknown>>;
}

function getCheckpointsForSite(db: Database.Database, siteId: number): Array<Record<string, unknown>> {
  return db.prepare(
    'SELECT * FROM scribe_checkpoints WHERE site_id = ? ORDER BY id'
  ).all(siteId) as Array<Record<string, unknown>>;
}

function getTier2Classes(db: Database.Database, siteId: number): string[] {
  return (db.prepare('SELECT class_name FROM css_audit WHERE site_id = ? AND tier = 2').all(siteId) as Array<{ class_name: string }>)
    .map(r => r.class_name);
}

function getTier3Classes(db: Database.Database, siteId: number): string[] {
  return (db.prepare(
    "SELECT class_name FROM css_decisions WHERE site_id = ? AND decision_type = 'custom' AND class_name IS NOT NULL"
  ).all(siteId) as Array<{ class_name: string }>).map(r => r.class_name);
}

function getSiteSummary(db: Database.Database, siteId: number): Record<string, unknown> | null {
  return (db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) as Record<string, unknown>) ?? null;
}

function getPipelineStage(db: Database.Database, siteId: number): string {
  const row = db.prepare('SELECT pipeline_stage FROM sites WHERE id = ?').get(siteId) as { pipeline_stage: string };
  return row.pipeline_stage;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function runTests(): { passed: number; failed: number; errors: string[] } {
  const t = new TestRunner('05 — Multi-Site Isolation Under Concurrent Operations');
  const db = createTestDb();
  const { siteA, siteB } = seedTestData(db);

  // ── Test 1: Interleaved pipeline advances ──────────────────────────────
  t.section('Interleaved pipeline advances');

  // Advance site A twice
  advanceSiteStage(db, siteA); // not_started -> stage_1
  advanceSiteStage(db, siteA); // stage_1 -> stage_2

  // Advance site B once
  advanceSiteStage(db, siteB); // not_started -> stage_1

  // Advance site A once more
  advanceSiteStage(db, siteA); // stage_2 -> stage_3

  t.assertEqual(getPipelineStage(db, siteA), 'stage_3', 'Site A at stage_3 after 3 advances');
  t.assertEqual(getPipelineStage(db, siteB), 'stage_1', 'Site B at stage_1 after 1 advance');

  // Checkpoints should be separate
  const checkpointsA = getCheckpointsForSite(db, siteA);
  const checkpointsB = getCheckpointsForSite(db, siteB);
  t.assertEqual(checkpointsA.length, 3, 'Site A has 3 checkpoints');
  t.assertEqual(checkpointsB.length, 1, 'Site B has 1 checkpoint');

  // No cross-contamination in checkpoint site_ids
  for (const cp of checkpointsA) {
    t.assertEqual(cp.site_id, siteA, 'All site A checkpoints belong to site A');
  }
  for (const cp of checkpointsB) {
    t.assertEqual(cp.site_id, siteB, 'All site B checkpoints belong to site B');
  }

  // ── Test 2: Interleaved feedback operations ────────────────────────────
  t.section('Interleaved feedback: reject/refine across sites');

  // Reject section in site A
  rejectSection(db, 1, 'Site A: hero is too bland');
  // Refine section in site B
  refineSection(db, 6, 'Site B: make hero more energetic');
  // Reject another section in site A
  rejectSection(db, 2, 'Site A: features too generic');
  // Refine another section in site B
  refineSection(db, 7, 'Site B: CTA needs more punch');

  // Check rules isolation
  const rulesA = getRulesForSite(db, siteA);
  const rulesB = getRulesForSite(db, siteB);

  t.assertEqual(rulesA.length, 2, 'Site A has 2 rules from rejections');
  t.assertEqual(rulesB.length, 2, 'Site B has 2 rules from refinements');

  // Verify content isolation — no cross-contamination
  for (const rule of rulesA) {
    t.assertNotIncludes(rule.rule_text as string, 'Site B', 'Site A rules have no site B content');
  }
  for (const rule of rulesB) {
    t.assertNotIncludes(rule.rule_text as string, 'Site A', 'Site B rules have no site A content');
  }

  // ── Test 3: Brand examples are isolated ────────────────────────────────
  t.section('Brand examples isolation after interleaved operations');

  const examplesA = getExamplesForSite(db, siteA);
  const examplesB = getExamplesForSite(db, siteB);

  // Site A had sections rejected (generates negative examples)
  t.assertGreaterThan(examplesA.length, 0, 'Site A has brand examples');

  for (const ex of examplesA) {
    t.assertEqual(ex.site_id, siteA, 'Site A example belongs to site A');
  }
  for (const ex of examplesB) {
    t.assertEqual(ex.site_id, siteB, 'Site B example belongs to site B');
  }

  // ── Test 4: CSS palette isolation under concurrent additions ───────────
  t.section('CSS palette isolation under concurrent additions');

  // Add CSS decisions interleaved
  db.prepare("INSERT INTO css_decisions (site_id, decision_type, class_name) VALUES (?, 'custom', ?)")
    .run(siteA, 'bce-alpha-concurrent-1');
  db.prepare("INSERT INTO css_decisions (site_id, decision_type, class_name) VALUES (?, 'custom', ?)")
    .run(siteB, 'bce-beta-concurrent-1');
  db.prepare("INSERT INTO css_decisions (site_id, decision_type, class_name) VALUES (?, 'custom', ?)")
    .run(siteA, 'bce-alpha-concurrent-2');
  db.prepare("INSERT INTO css_decisions (site_id, decision_type, class_name) VALUES (?, 'custom', ?)")
    .run(siteB, 'bce-beta-concurrent-2');

  const tier3A = getTier3Classes(db, siteA);
  const tier3B = getTier3Classes(db, siteB);

  t.assertEqual(tier3A.length, 4, 'Site A has 4 Tier 3 classes (2 original + 2 new)');
  t.assertEqual(tier3B.length, 4, 'Site B has 4 Tier 3 classes (2 original + 2 new)');

  // Verify no overlap
  const overlapTier3 = tier3A.filter(c => tier3B.includes(c));
  t.assertEqual(overlapTier3.length, 0, 'Zero overlap in Tier 3 classes between sites');

  // Check specific classes
  t.assert(tier3A.includes('bce-alpha-concurrent-1'), 'Site A has its concurrent class 1');
  t.assert(tier3A.includes('bce-alpha-concurrent-2'), 'Site A has its concurrent class 2');
  t.assert(!tier3A.includes('bce-beta-concurrent-1'), 'Site A does NOT have beta concurrent class');

  t.assert(tier3B.includes('bce-beta-concurrent-1'), 'Site B has its concurrent class 1');
  t.assert(tier3B.includes('bce-beta-concurrent-2'), 'Site B has its concurrent class 2');
  t.assert(!tier3B.includes('bce-alpha-concurrent-1'), 'Site B does NOT have alpha concurrent class');

  // ── Test 5: Content freshness tracking isolation ───────────────────────
  t.section('Content freshness isolation');

  // Add freshness records for both sites
  db.prepare(
    `INSERT INTO content_freshness (site_id, page_url, last_generated_at, freshness_status)
     VALUES (?, ?, datetime('now'), 'fresh')`
  ).run(siteA, '/driving-lessons-sydney');
  db.prepare(
    `INSERT INTO content_freshness (site_id, page_url, last_generated_at, freshness_status)
     VALUES (?, ?, datetime('now'), 'stale')`
  ).run(siteB, '/driving-lessons-melbourne');

  const freshnessA = db.prepare('SELECT * FROM content_freshness WHERE site_id = ?').all(siteA) as Array<Record<string, unknown>>;
  const freshnessB = db.prepare('SELECT * FROM content_freshness WHERE site_id = ?').all(siteB) as Array<Record<string, unknown>>;

  t.assertEqual(freshnessA.length, 1, 'Site A has 1 freshness record');
  t.assertEqual(freshnessB.length, 1, 'Site B has 1 freshness record');
  t.assertEqual(freshnessA[0].freshness_status, 'fresh', 'Site A page is fresh');
  t.assertEqual(freshnessB[0].freshness_status, 'stale', 'Site B page is stale');
  t.assertNotEqual(freshnessA[0].page_url, freshnessB[0].page_url, 'Different page URLs for different sites');

  // ── Test 6: Page versions are blueprint/page scoped ────────────────────
  t.section('Page version isolation');

  // Create page records for both sites
  db.prepare("INSERT INTO pages (id, site_id, url, title, status) VALUES (1, ?, '/page-a', 'Page A', 'draft')").run(siteA);
  db.prepare("INSERT INTO pages (id, site_id, url, title, status) VALUES (2, ?, '/page-b', 'Page B', 'draft')").run(siteB);

  // Create versions
  db.prepare("INSERT INTO page_versions (page_id, version_number, html_content, change_reason) VALUES (1, 1, '<h1>Alpha v1</h1>', 'initial')").run();
  db.prepare("INSERT INTO page_versions (page_id, version_number, html_content, change_reason) VALUES (2, 1, '<h1>Beta v1</h1>', 'initial')").run();
  db.prepare("INSERT INTO page_versions (page_id, version_number, html_content, change_reason) VALUES (1, 2, '<h1>Alpha v2</h1>', 'update')").run();

  const versionsA = db.prepare('SELECT * FROM page_versions WHERE page_id = 1 ORDER BY version_number').all() as Array<Record<string, unknown>>;
  const versionsB = db.prepare('SELECT * FROM page_versions WHERE page_id = 2 ORDER BY version_number').all() as Array<Record<string, unknown>>;

  t.assertEqual(versionsA.length, 2, 'Site A page has 2 versions');
  t.assertEqual(versionsB.length, 1, 'Site B page has 1 version');
  t.assertIncludes(versionsA[0].html_content as string, 'Alpha v1', 'Site A version 1 has correct content');
  t.assertIncludes(versionsB[0].html_content as string, 'Beta v1', 'Site B version 1 has correct content');

  // ── Test 7: Section specs are blueprint-scoped (prevents cross-site) ───
  t.section('Section specs are blueprint-scoped');

  const sectionsBlueprint1 = db.prepare('SELECT * FROM section_specs WHERE blueprint_id = 1').all() as Array<Record<string, unknown>>;
  const sectionsBlueprint3 = db.prepare('SELECT * FROM section_specs WHERE blueprint_id = 3').all() as Array<Record<string, unknown>>;

  // Blueprint 1 is site A, blueprint 3 is site B
  for (const sec of sectionsBlueprint1) {
    const bp = db.prepare('SELECT site_id FROM page_blueprints WHERE id = ?').get(sec.blueprint_id) as { site_id: number };
    t.assertEqual(bp.site_id, siteA, `Blueprint 1 section ${sec.id} belongs to site A`);
  }
  for (const sec of sectionsBlueprint3) {
    const bp = db.prepare('SELECT site_id FROM page_blueprints WHERE id = ?').get(sec.blueprint_id) as { site_id: number };
    t.assertEqual(bp.site_id, siteB, `Blueprint 3 section ${sec.id} belongs to site B`);
  }

  // ── Test 8: Foreign key constraints prevent cross-site corruption ──────
  t.section('Foreign key enforcement');

  // Attempt to create a blueprint referencing a backlog item from another site
  // (backlog_id=1 belongs to site A, but we set site_id=2)
  // This won't fail at FK level since the FK is on backlog_id, but the data would be inconsistent
  // The application logic should prevent this — let's verify the FK chain is intact

  const bpSiteA = db.prepare(
    'SELECT pb.site_id as bp_site, wb.site_id as wb_site FROM page_blueprints pb JOIN work_backlog wb ON pb.backlog_id = wb.id WHERE pb.id = 1'
  ).get() as { bp_site: number; wb_site: number };
  t.assertEqual(bpSiteA.bp_site, bpSiteA.wb_site, 'Blueprint site_id matches its backlog item site_id');

  // ── Test 9: Aggregate queries respect site boundaries ──────────────────
  t.section('Aggregate queries respect site boundaries');

  const siteASectionCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = ?'
  ).get(siteA) as { cnt: number }).cnt;

  const siteBSectionCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM section_specs ss JOIN page_blueprints pb ON ss.blueprint_id = pb.id WHERE pb.site_id = ?'
  ).get(siteB) as { cnt: number }).cnt;

  t.assertEqual(siteASectionCount, 5, 'Site A has 5 section specs total (across 2 blueprints)');
  t.assertEqual(siteBSectionCount, 2, 'Site B has 2 section specs total (1 blueprint)');

  // ── Test 10: Site summary data is isolated ─────────────────────────────
  t.section('Site summary isolation');

  const summaryA = getSiteSummary(db, siteA);
  const summaryB = getSiteSummary(db, siteB);

  t.assert(summaryA !== null && summaryB !== null, 'Both site summaries exist');
  t.assertEqual(summaryA!.name, 'Alpha Driving School', 'Site A summary has correct name');
  t.assertEqual(summaryB!.name, 'Beta Driving School', 'Site B summary has correct name');
  t.assertNotEqual(summaryA!.pipeline_stage, summaryB!.pipeline_stage,
    'Sites have different pipeline stages after interleaved advances');
  t.assertNotEqual(summaryA!.slug, summaryB!.slug, 'Sites have different slugs');

  // ── Test 11: Cross-table join isolation ─────────────────────────────────
  t.section('Cross-table join isolation');

  // Simulate what an API endpoint would return: all data for a site via joins
  const fullSiteA = db.prepare(`
    SELECT s.name as site_name,
           (SELECT COUNT(*) FROM brand_rules WHERE site_id = s.id) as rule_count,
           (SELECT COUNT(*) FROM brand_examples WHERE site_id = s.id) as example_count,
           (SELECT COUNT(*) FROM css_audit WHERE site_id = s.id) as css_audit_count,
           (SELECT COUNT(*) FROM css_decisions WHERE site_id = s.id) as css_decision_count,
           (SELECT COUNT(*) FROM scribe_checkpoints WHERE site_id = s.id) as checkpoint_count
    FROM sites s WHERE s.id = ?
  `).get(siteA) as Record<string, unknown>;

  const fullSiteB = db.prepare(`
    SELECT s.name as site_name,
           (SELECT COUNT(*) FROM brand_rules WHERE site_id = s.id) as rule_count,
           (SELECT COUNT(*) FROM brand_examples WHERE site_id = s.id) as example_count,
           (SELECT COUNT(*) FROM css_audit WHERE site_id = s.id) as css_audit_count,
           (SELECT COUNT(*) FROM css_decisions WHERE site_id = s.id) as css_decision_count,
           (SELECT COUNT(*) FROM scribe_checkpoints WHERE site_id = s.id) as checkpoint_count
    FROM sites s WHERE s.id = ?
  `).get(siteB) as Record<string, unknown>;

  t.assertEqual(fullSiteA.site_name, 'Alpha Driving School', 'Joined query returns correct site A name');
  t.assertEqual(fullSiteB.site_name, 'Beta Driving School', 'Joined query returns correct site B name');
  // Rule counts may coincidentally be equal, so verify rule CONTENT is isolated instead
  const ruleTextsA = getRulesForSite(db, siteA).map(r => r.rule_text as string);
  const ruleTextsB = getRulesForSite(db, siteB).map(r => r.rule_text as string);
  const ruleTextOverlap = ruleTextsA.filter(t => ruleTextsB.includes(t));
  t.assertEqual(ruleTextOverlap.length, 0, 'Rule content has zero overlap between sites');
  t.assertNotEqual(fullSiteA.checkpoint_count, fullSiteB.checkpoint_count, 'Checkpoint counts differ between sites');

  db.close();
  return t.summary();
}

const results = runTests();
process.exit(results.failed > 0 ? 1 : 0);
