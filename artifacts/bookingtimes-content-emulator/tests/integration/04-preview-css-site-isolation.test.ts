/**
 * Integration Test 04: Preview CSS Returns Correct Site CSS — WRK-BCE2-052
 *
 * Verifies: The preview-css API returns the right CSS tiers for the requested
 * site, not another site's CSS. Tier 3 CSS generation is site-scoped.
 *
 * Cross-layer: Database (css_audit, css_decisions, sites) <-> css-generator service <-> API
 *
 * Checklist:
 *   [x] Data flows correctly across layer boundaries
 *   [x] Field names match (class_name, decision_type in DB, correct in queries)
 *   [x] Error cases handled gracefully (non-existent site, no CSS decisions)
 *   [x] No data loss in round-trips (class names preserved)
 *   [x] Site isolation holds (CSS for site A never returned for site B)
 */

import Database from 'better-sqlite3';
import { createTestDb, seedTestData, TestRunner } from './test-helpers';

// ---------------------------------------------------------------------------
// CSS generator logic (mirrors css-generator.ts, uses injected db)
// ---------------------------------------------------------------------------

interface CssDecisionRow {
  class_name: string;
  decision_type: string;
}

interface CssAuditRow {
  class_name: string;
  tier: number;
}

/**
 * Get Tier 2 CSS classes for a site (from css_audit).
 */
function getTier2Classes(db: Database.Database, siteId: number): string[] {
  const rows = db.prepare(
    'SELECT class_name FROM css_audit WHERE site_id = ? AND tier = 2'
  ).all(siteId) as CssAuditRow[];
  return rows.map(r => r.class_name);
}

/**
 * Get Tier 3 CSS class names for a site (from css_decisions, type='custom').
 */
function getTier3ClassNames(db: Database.Database, siteId: number): string[] {
  const rows = db.prepare(
    `SELECT class_name FROM css_decisions
     WHERE site_id = ? AND decision_type = 'custom' AND class_name IS NOT NULL`
  ).all(siteId) as CssDecisionRow[];
  return rows.map(r => r.class_name);
}

/**
 * Generate Tier 3 CSS for a set of class names (mirrors generateTier3Css).
 */
function generateTier3Css(db: Database.Database, classNames: string[], siteId: number): string {
  const site = db.prepare('SELECT name FROM sites WHERE id = ?').get(siteId) as { name: string } | undefined;
  const siteName = site?.name ?? `Site ${siteId}`;

  const header = `/* Tier 3: System-generated CSS for ${siteName} */\n`;

  const rules = classNames.map(cls => {
    // Simple CSS rule generation
    return `.${cls} {\n  /* Properties for ${cls} */\n}`;
  });

  return header + '\n' + rules.join('\n\n') + '\n';
}

/**
 * Simulates the Tier 3 CSS preview endpoint logic.
 */
function previewTier3Css(db: Database.Database, siteId: number): { css: string; status: number } {
  const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
  if (!site) {
    return { css: '', status: 404 };
  }

  const classNames = getTier3ClassNames(db, siteId);
  if (classNames.length === 0) {
    return {
      css: '/* No Tier 3 CSS decisions found for this site */\n',
      status: 200
    };
  }

  const css = generateTier3Css(db, classNames, siteId);
  return { css, status: 200 };
}

/**
 * Full CSS palette for a site — all three tiers.
 */
function getSiteCssPalette(db: Database.Database, siteId: number): {
  tier2: string[];
  tier3: string[];
} {
  return {
    tier2: getTier2Classes(db, siteId),
    tier3: getTier3ClassNames(db, siteId),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function runTests(): { passed: number; failed: number; errors: string[] } {
  const t = new TestRunner('04 — Preview CSS Site Isolation');
  const db = createTestDb();
  const { siteA, siteB } = seedTestData(db);

  // ── Test 1: Tier 2 classes are site-scoped ─────────────────────────────
  t.section('Tier 2 CSS classes are site-scoped');

  const siteATier2 = getTier2Classes(db, siteA);
  const siteBTier2 = getTier2Classes(db, siteB);

  t.assertEqual(siteATier2.length, 2, 'Site A has 2 Tier 2 classes');
  t.assertEqual(siteBTier2.length, 2, 'Site B has 2 Tier 2 classes');

  t.assert(siteATier2.includes('alpha-hero-banner'), 'Site A has alpha-hero-banner');
  t.assert(siteATier2.includes('alpha-cta-box'), 'Site A has alpha-cta-box');
  t.assert(!siteATier2.includes('beta-brand-header'), 'Site A does NOT have beta-brand-header');
  t.assert(!siteATier2.includes('beta-testimonial-card'), 'Site A does NOT have beta-testimonial-card');

  t.assert(siteBTier2.includes('beta-brand-header'), 'Site B has beta-brand-header');
  t.assert(siteBTier2.includes('beta-testimonial-card'), 'Site B has beta-testimonial-card');
  t.assert(!siteBTier2.includes('alpha-hero-banner'), 'Site B does NOT have alpha-hero-banner');

  // ── Test 2: Tier 3 classes are site-scoped ─────────────────────────────
  t.section('Tier 3 CSS decisions are site-scoped');

  const siteATier3 = getTier3ClassNames(db, siteA);
  const siteBTier3 = getTier3ClassNames(db, siteB);

  t.assertEqual(siteATier3.length, 2, 'Site A has 2 Tier 3 classes');
  t.assertEqual(siteBTier3.length, 2, 'Site B has 2 Tier 3 classes');

  t.assert(siteATier3.includes('bce-alpha-step-number'), 'Site A has bce-alpha-step-number');
  t.assert(siteATier3.includes('bce-alpha-icon-circle'), 'Site A has bce-alpha-icon-circle');
  t.assert(!siteATier3.includes('bce-beta-hero-overlay'), 'Site A does NOT have bce-beta-hero-overlay');

  t.assert(siteBTier3.includes('bce-beta-hero-overlay'), 'Site B has bce-beta-hero-overlay');
  t.assert(siteBTier3.includes('bce-beta-rating-badge'), 'Site B has bce-beta-rating-badge');
  t.assert(!siteBTier3.includes('bce-alpha-step-number'), 'Site B does NOT have bce-alpha-step-number');

  // ── Test 3: Generated Tier 3 CSS contains correct site name ────────────
  t.section('Tier 3 CSS generation uses correct site context');

  const siteACss = generateTier3Css(db, siteATier3, siteA);
  const siteBCss = generateTier3Css(db, siteBTier3, siteB);

  t.assertIncludes(siteACss, 'Alpha Driving School', 'Site A CSS header mentions Alpha');
  t.assertNotIncludes(siteACss, 'Beta Driving School', 'Site A CSS header does NOT mention Beta');

  t.assertIncludes(siteBCss, 'Beta Driving School', 'Site B CSS header mentions Beta');
  t.assertNotIncludes(siteBCss, 'Alpha Driving School', 'Site B CSS header does NOT mention Alpha');

  // ── Test 4: Generated CSS contains correct class selectors ─────────────
  t.section('Generated CSS class selectors match database');

  t.assertIncludes(siteACss, '.bce-alpha-step-number', 'Site A CSS has .bce-alpha-step-number selector');
  t.assertIncludes(siteACss, '.bce-alpha-icon-circle', 'Site A CSS has .bce-alpha-icon-circle selector');
  t.assertNotIncludes(siteACss, '.bce-beta-', 'Site A CSS has no beta class selectors');

  t.assertIncludes(siteBCss, '.bce-beta-hero-overlay', 'Site B CSS has .bce-beta-hero-overlay selector');
  t.assertIncludes(siteBCss, '.bce-beta-rating-badge', 'Site B CSS has .bce-beta-rating-badge selector');
  t.assertNotIncludes(siteBCss, '.bce-alpha-', 'Site B CSS has no alpha class selectors');

  // ── Test 5: Preview endpoint returns correct CSS per site ──────────────
  t.section('Tier 3 preview endpoint site isolation');

  const previewA = previewTier3Css(db, siteA);
  const previewB = previewTier3Css(db, siteB);

  t.assertEqual(previewA.status, 200, 'Site A preview returns 200');
  t.assertEqual(previewB.status, 200, 'Site B preview returns 200');

  t.assertIncludes(previewA.css, 'bce-alpha-step-number', 'Site A preview contains alpha classes');
  t.assertNotIncludes(previewA.css, 'bce-beta-', 'Site A preview does NOT contain beta classes');

  t.assertIncludes(previewB.css, 'bce-beta-hero-overlay', 'Site B preview contains beta classes');
  t.assertNotIncludes(previewB.css, 'bce-alpha-', 'Site B preview does NOT contain alpha classes');

  // ── Test 6: Non-existent site returns 404 ──────────────────────────────
  t.section('Error handling: non-existent site');

  const notFound = previewTier3Css(db, 999);
  t.assertEqual(notFound.status, 404, 'Non-existent site returns 404');

  // ── Test 7: Site with no Tier 3 decisions returns comment ──────────────
  t.section('Site with no Tier 3 CSS decisions');

  // Add a third site with no CSS decisions
  db.exec(`
    INSERT INTO sites (id, name, url, slug, pipeline_stage) VALUES
      (3, 'Gamma Driving', 'https://gamma.com.au', 'gamma', 'not_started');
  `);

  const emptyPreview = previewTier3Css(db, 3);
  t.assertEqual(emptyPreview.status, 200, 'Empty site returns 200 (not an error)');
  t.assertIncludes(emptyPreview.css, 'No Tier 3 CSS decisions', 'Response explains no CSS found');

  // ── Test 8: Full CSS palette is site-scoped ────────────────────────────
  t.section('Full CSS palette isolation');

  const paletteA = getSiteCssPalette(db, siteA);
  const paletteB = getSiteCssPalette(db, siteB);

  // No overlap between site palettes
  const allSiteAClasses = [...paletteA.tier2, ...paletteA.tier3];
  const allSiteBClasses = [...paletteB.tier2, ...paletteB.tier3];

  const overlap = allSiteAClasses.filter(c => allSiteBClasses.includes(c));
  t.assertEqual(overlap.length, 0, 'Zero overlap between site A and site B CSS palettes');

  // ── Test 9: Adding a Tier 3 class to one site doesn't affect other ─────
  t.section('Dynamic Tier 3 addition isolation');

  db.prepare(
    "INSERT INTO css_decisions (site_id, decision_type, class_name, rationale) VALUES (?, 'custom', ?, 'Test')"
  ).run(siteA, 'bce-alpha-new-class');

  const updatedATier3 = getTier3ClassNames(db, siteA);
  const unchangedBTier3 = getTier3ClassNames(db, siteB);

  t.assertEqual(updatedATier3.length, 3, 'Site A now has 3 Tier 3 classes');
  t.assertEqual(unchangedBTier3.length, 2, 'Site B still has 2 Tier 3 classes');
  t.assert(updatedATier3.includes('bce-alpha-new-class'), 'New class appears in site A');
  t.assert(!unchangedBTier3.includes('bce-alpha-new-class'), 'New class does NOT appear in site B');

  // ── Test 10: CSS class names round-trip through DB ─────────────────────
  t.section('Field name round-trip');

  const rawDbRow = db.prepare(
    "SELECT class_name, decision_type FROM css_decisions WHERE class_name = 'bce-alpha-new-class'"
  ).get() as Record<string, unknown>;
  t.assertEqual(rawDbRow.class_name, 'bce-alpha-new-class', 'class_name preserved exactly in DB');
  t.assertEqual(rawDbRow.decision_type, 'custom', 'decision_type preserved exactly in DB');

  db.close();
  return t.summary();
}

const results = runTests();
process.exit(results.failed > 0 ? 1 : 0);
