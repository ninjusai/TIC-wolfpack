/**
 * Edit Distance Tracking Validation — WRK-BCE2-055
 *
 * Validates the edit distance tracking mechanism for the BCE V2.1 pilot.
 * After 3+ pages with feedback cycles, the system should:
 *   1. Compute edit distance between generated and approved HTML
 *   2. Store the metric per page version
 *   3. Track the trend (distance should decrease as the system learns)
 *   4. Aggregate per site for dashboard display
 *
 * Eval trace: REQ-BCE2-040 (System learns from feedback), EVAL-BCE2-021
 *
 * Run: npx tsx tests/pilot/edit-distance-tracking.test.ts
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Test infrastructure (reuses patterns from pilot/single-site-e2e.test.ts)
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(__dirname, '../../app');
const MIGRATIONS_DIR = path.join(APP_ROOT, 'src/lib/db/migrations');

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Run schema migrations (skip seed data)
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (file.includes('seed')) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
  }

  // Add edit_distance column to page_versions if not present.
  // This migration is expected to exist in production; we apply it here
  // so the test can validate storage and retrieval.
  db.exec(`
    ALTER TABLE page_versions ADD COLUMN edit_distance INTEGER DEFAULT NULL;
  `);

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

  assertLessThan(actual: number, threshold: number, description: string): void {
    this.assert(
      actual < threshold,
      description,
      actual < threshold ? undefined : `${actual} is not less than ${threshold}`
    );
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
// Edit distance implementation (Levenshtein)
//
// This is the reference implementation the production code should use.
// The current export page uses Math.abs(a.length - b.length) which is
// only a rough proxy. True Levenshtein counts insertions, deletions,
// and substitutions.
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit distance between two strings.
 * Uses the iterative two-row algorithm for O(min(m,n)) space.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space efficiency
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);

  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,     // deletion
        curr[i - 1] + 1, // insertion
        prev[i - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

/**
 * Compute a normalized edit distance ratio (0 = identical, 1 = completely different).
 */
function normalizedEditDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshteinDistance(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// Database helpers (simulating production functions)
// ---------------------------------------------------------------------------

interface VersionRow {
  id: number;
  page_id: number;
  version_number: number;
  html_content: string;
  change_reason: string;
  edit_distance: number | null;
  created_at: string;
}

/**
 * Create a page version and compute edit distance against the previous version.
 * This is the function production code should implement.
 */
function createVersionWithEditDistance(
  db: Database.Database,
  pageId: number,
  htmlContent: string,
  changeReason: string,
  approvedHtml?: string
): VersionRow {
  const row = db
    .prepare('SELECT COALESCE(MAX(version_number), 0) AS max_v FROM page_versions WHERE page_id = ?')
    .get(pageId) as { max_v: number };
  const nextVersion = row.max_v + 1;

  // Compute edit distance: if approved HTML is provided, compare against it.
  // Otherwise compare against the previous version's HTML.
  let editDist: number | null = null;
  if (approvedHtml) {
    editDist = levenshteinDistance(htmlContent, approvedHtml);
  } else if (nextVersion > 1) {
    const prev = db
      .prepare('SELECT html_content FROM page_versions WHERE page_id = ? AND version_number = ?')
      .get(pageId, nextVersion - 1) as { html_content: string } | undefined;
    if (prev) {
      editDist = levenshteinDistance(htmlContent, prev.html_content);
    }
  }

  db.prepare(
    `INSERT INTO page_versions (page_id, version_number, html_content, change_reason, edit_distance)
     VALUES (?, ?, ?, ?, ?)`
  ).run(pageId, nextVersion, htmlContent, changeReason, editDist);

  db.prepare(
    `UPDATE pages SET current_html = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(htmlContent, changeReason === 'manual_edit' ? 'draft' : 'generated', pageId);

  return db
    .prepare('SELECT * FROM page_versions WHERE page_id = ? AND version_number = ?')
    .get(pageId, nextVersion) as VersionRow;
}

/**
 * Get edit distance trend for a page — ordered chronologically.
 */
function getEditDistanceTrend(
  db: Database.Database,
  pageId: number
): Array<{ versionNumber: number; editDistance: number | null; createdAt: string }> {
  const rows = db
    .prepare(
      `SELECT version_number, edit_distance, created_at
       FROM page_versions
       WHERE page_id = ?
       ORDER BY version_number ASC`
    )
    .all(pageId) as Array<{ version_number: number; edit_distance: number | null; created_at: string }>;

  return rows.map((r) => ({
    versionNumber: r.version_number,
    editDistance: r.edit_distance,
    createdAt: r.created_at,
  }));
}

/**
 * Get per-site aggregated edit distance stats.
 */
function getSiteEditDistanceStats(
  db: Database.Database,
  siteId: number
): {
  siteId: number;
  totalVersions: number;
  versionsWithDistance: number;
  avgEditDistance: number | null;
  latestAvgDistance: number | null;
  trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
} {
  // Overall stats
  const stats = db
    .prepare(
      `SELECT
         COUNT(*) AS total_versions,
         COUNT(pv.edit_distance) AS versions_with_distance,
         AVG(pv.edit_distance) AS avg_edit_distance
       FROM page_versions pv
       JOIN pages p ON p.id = pv.page_id
       WHERE p.site_id = ?
         AND pv.edit_distance IS NOT NULL`
    )
    .get(siteId) as {
    total_versions: number;
    versions_with_distance: number;
    avg_edit_distance: number | null;
  };

  // Get the latest 3 versions' avg distance vs the first 3 for trend detection.
  // Uses pv.id for stable ordering (created_at may have identical timestamps in tests).
  const firstThree = db
    .prepare(
      `SELECT AVG(pv.edit_distance) AS avg_d
       FROM (
         SELECT pv.edit_distance
         FROM page_versions pv
         JOIN pages p ON p.id = pv.page_id
         WHERE p.site_id = ? AND pv.edit_distance IS NOT NULL
         ORDER BY pv.id ASC
         LIMIT 3
       ) pv`
    )
    .get(siteId) as { avg_d: number | null };

  const latestThree = db
    .prepare(
      `SELECT AVG(pv.edit_distance) AS avg_d
       FROM (
         SELECT pv.edit_distance
         FROM page_versions pv
         JOIN pages p ON p.id = pv.page_id
         WHERE p.site_id = ? AND pv.edit_distance IS NOT NULL
         ORDER BY pv.id DESC
         LIMIT 3
       ) pv`
    )
    .get(siteId) as { avg_d: number | null };

  let trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data' = 'insufficient_data';

  if (
    firstThree.avg_d !== null &&
    latestThree.avg_d !== null &&
    stats.versions_with_distance >= 6
  ) {
    const diff = firstThree.avg_d - latestThree.avg_d;
    const threshold = firstThree.avg_d * 0.1; // 10% change threshold
    if (diff > threshold) {
      trend = 'improving';
    } else if (diff < -threshold) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }
  }

  return {
    siteId,
    totalVersions: stats.total_versions,
    versionsWithDistance: stats.versions_with_distance,
    avgEditDistance: stats.avg_edit_distance,
    latestAvgDistance: latestThree.avg_d,
    trend,
  };
}

/**
 * Format dashboard data for a site's edit distance metrics.
 */
function getDashboardEditDistanceData(
  db: Database.Database,
  siteId: number
): {
  siteId: number;
  summary: ReturnType<typeof getSiteEditDistanceStats>;
  perPage: Array<{
    pageId: number;
    pageUrl: string;
    latestEditDistance: number | null;
    versionCount: number;
  }>;
} {
  const summary = getSiteEditDistanceStats(db, siteId);

  const perPage = db
    .prepare(
      `SELECT
         p.id AS page_id,
         p.url AS page_url,
         (SELECT pv.edit_distance
          FROM page_versions pv
          WHERE pv.page_id = p.id
          ORDER BY pv.version_number DESC
          LIMIT 1) AS latest_edit_distance,
         (SELECT COUNT(*)
          FROM page_versions pv
          WHERE pv.page_id = p.id) AS version_count
       FROM pages p
       WHERE p.site_id = ?`
    )
    .all(siteId) as Array<{
    page_id: number;
    page_url: string;
    latest_edit_distance: number | null;
    version_count: number;
  }>;

  return {
    siteId,
    summary,
    perPage: perPage.map((r) => ({
      pageId: r.page_id,
      pageUrl: r.page_url,
      latestEditDistance: r.latest_edit_distance,
      versionCount: r.version_count,
    })),
  };
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedSite(db: Database.Database, name: string, slug: string): number {
  const info = db
    .prepare(
      `INSERT INTO sites (name, url, slug, pipeline_stage) VALUES (?, ?, ?, 'stage_5')`
    )
    .run(name, `https://${slug}.example.com`, slug);
  return Number(info.lastInsertRowid);
}

function seedPage(
  db: Database.Database,
  siteId: number,
  url: string,
  title: string,
  pageType: string
): number {
  const info = db
    .prepare(
      `INSERT INTO pages (site_id, url, title, page_type, status) VALUES (?, ?, ?, ?, 'draft')`
    )
    .run(siteId, url, title, pageType);
  return Number(info.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Test execution
// ---------------------------------------------------------------------------

function main(): void {
  const t = new TestRunner('Edit Distance Tracking Validation (WRK-BCE2-055)');
  const db = createTestDb();

  // =========================================================================
  // 1. Edit distance computation
  // =========================================================================
  t.section('1. Edit Distance Computation');

  // Identical strings
  t.assertEqual(
    levenshteinDistance('hello', 'hello'),
    0,
    'Identical strings have edit distance 0'
  );

  // Empty vs non-empty
  t.assertEqual(
    levenshteinDistance('', 'abc'),
    3,
    'Empty string vs "abc" has distance 3'
  );

  t.assertEqual(
    levenshteinDistance('abc', ''),
    3,
    '"abc" vs empty string has distance 3'
  );

  // Single character change (substitution)
  t.assertEqual(
    levenshteinDistance('cat', 'bat'),
    1,
    'Single substitution: "cat" -> "bat" = 1'
  );

  // Insertion
  t.assertEqual(
    levenshteinDistance('cat', 'cart'),
    1,
    'Single insertion: "cat" -> "cart" = 1'
  );

  // Deletion
  t.assertEqual(
    levenshteinDistance('cart', 'cat'),
    1,
    'Single deletion: "cart" -> "cat" = 1'
  );

  // Multiple operations
  t.assertEqual(
    levenshteinDistance('kitten', 'sitting'),
    3,
    'Classic example: "kitten" -> "sitting" = 3'
  );

  // HTML-like content
  const htmlA = '<div class="hero"><h1>Welcome</h1></div>';
  const htmlB = '<div class="hero"><h1>Welcome to Our Site</h1></div>';
  const distHtml = levenshteinDistance(htmlA, htmlB);
  t.assertGreaterThan(distHtml, 0, 'HTML strings with different content have positive distance');
  t.assertEqual(
    distHtml,
    12, // " to Our Site" is 12 chars inserted
    'HTML edit distance correctly counts inserted characters'
  );

  // Normalized edit distance
  t.assertEqual(
    normalizedEditDistance('hello', 'hello'),
    0,
    'Normalized distance for identical strings is 0'
  );

  const normDist = normalizedEditDistance('cat', 'bat');
  t.assert(
    normDist > 0 && normDist < 1,
    'Normalized distance for similar strings is between 0 and 1',
    `Got: ${normDist}`
  );

  t.assertEqual(
    normalizedEditDistance('', ''),
    0,
    'Normalized distance for two empty strings is 0'
  );

  // =========================================================================
  // 2. Storage — edit distance persists in the database
  // =========================================================================
  t.section('2. Storage — Edit Distance in Database');

  const siteId = seedSite(db, 'Test Plumber', 'test-plumber');
  const pageId = seedPage(db, siteId, '/services', 'Services', 'service_area');

  // First version (no previous — edit_distance should be null)
  const v1 = createVersionWithEditDistance(
    db,
    pageId,
    '<div>Initial generated content</div>',
    'ai_generation'
  );
  t.assertEqual(v1.edit_distance, null, 'First version has null edit distance (no prior version)');
  t.assertEqual(v1.version_number, 1, 'First version number is 1');

  // Second version — edit distance computed against v1
  const v2 = createVersionWithEditDistance(
    db,
    pageId,
    '<div>Improved generated content with changes</div>',
    'ai_generation'
  );
  t.assertNotNull(v2.edit_distance, 'Second version has non-null edit distance');
  t.assertGreaterThan(v2.edit_distance!, 0, 'Second version has positive edit distance');
  t.assertEqual(v2.version_number, 2, 'Second version number is 2');

  // Third version with explicit approved HTML comparison
  const generatedV3 = '<div>Third generation attempt</div>';
  const approvedV3 = '<div>Third generation attempt with operator edits applied</div>';
  const v3 = createVersionWithEditDistance(
    db,
    pageId,
    generatedV3,
    'approval',
    approvedV3
  );
  t.assertNotNull(v3.edit_distance, 'Version with approved HTML has computed edit distance');
  t.assertEqual(
    v3.edit_distance,
    levenshteinDistance(generatedV3, approvedV3),
    'Stored edit distance matches computed Levenshtein distance'
  );

  // Verify data is actually in the database (not just returned)
  const stored = db
    .prepare('SELECT edit_distance FROM page_versions WHERE page_id = ? AND version_number = 3')
    .get(pageId) as { edit_distance: number | null };
  t.assertEqual(
    stored.edit_distance,
    v3.edit_distance,
    'Edit distance persisted in database matches returned value'
  );

  // =========================================================================
  // 3. Trend tracking — edit distance decreases over feedback cycles
  // =========================================================================
  t.section('3. Trend Tracking — Simulated Feedback Cycles');

  const trendSiteId = seedSite(db, 'Trend Test Site', 'trend-test');
  const trendPageId = seedPage(db, trendSiteId, '/about', 'About Us', 'about');

  // Simulate a learning progression: each cycle the AI generates HTML closer
  // to what the human approves, so edit distance should decrease.
  const approvedTemplate = '<section class="about"><h2>About Our Company</h2><p>We are experts in plumbing services with 20 years of experience.</p></section>';

  // Cycle 1: Big difference — AI is still learning
  const gen1 = '<section><h2>About</h2><p>We do plumbing.</p></section>';
  createVersionWithEditDistance(db, trendPageId, gen1, 'ai_generation', approvedTemplate);

  // Cycle 2: Closer — AI picked up some patterns
  const gen2 = '<section class="about"><h2>About Our Company</h2><p>We are plumbing experts.</p></section>';
  createVersionWithEditDistance(db, trendPageId, gen2, 'ai_generation', approvedTemplate);

  // Cycle 3: Very close — AI has learned the pattern well
  const gen3 = '<section class="about"><h2>About Our Company</h2><p>We are experts in plumbing services with 20 years experience.</p></section>';
  createVersionWithEditDistance(db, trendPageId, gen3, 'ai_generation', approvedTemplate);

  // Cycle 4: Nearly identical
  const gen4 = '<section class="about"><h2>About Our Company</h2><p>We are experts in plumbing services with 20 years of experience.</p></section>';
  createVersionWithEditDistance(db, trendPageId, gen4, 'ai_generation', approvedTemplate);

  const trend = getEditDistanceTrend(db, trendPageId);

  t.assertEqual(trend.length, 4, 'Trend data has 4 entries for 4 cycles');

  // All distances should be non-null
  for (let i = 0; i < trend.length; i++) {
    t.assertNotNull(
      trend[i].editDistance,
      `Cycle ${i + 1} edit distance is recorded`
    );
  }

  // Distance should generally decrease (each cycle closer to approved)
  const distances = trend.map((e) => e.editDistance!);
  t.assertGreaterThan(
    distances[0],
    distances[1],
    'Cycle 2 distance is less than Cycle 1 (learning progress)'
  );
  t.assertGreaterThan(
    distances[1],
    distances[2],
    'Cycle 3 distance is less than Cycle 2 (continued learning)'
  );
  t.assertGreaterThanOrEqual(
    distances[2],
    distances[3],
    'Cycle 4 distance is <= Cycle 3 (convergence)'
  );

  // Final distance should be small
  t.assertLessThan(
    distances[3],
    10,
    `Final edit distance is small (${distances[3]}), showing system learned`
  );

  // First distance should be significantly larger
  t.assertGreaterThan(
    distances[0],
    distances[3] * 3,
    'Initial distance is at least 3x the final distance'
  );

  console.log(`    Distances: [${distances.join(', ')}]`);

  // =========================================================================
  // 4. Per-site aggregation
  // =========================================================================
  t.section('4. Per-Site Aggregation');

  // Add a second page to trendSiteId to test aggregation.
  // This page also shows a learning progression (high -> low edit distance).
  const trendPage2Id = seedPage(db, trendSiteId, '/services', 'Our Services', 'service_area');

  const serviceApproved = '<div class="services"><h2>Our Services</h2><ul><li>Plumbing</li><li>Heating</li></ul></div>';
  const serviceGen1 = '<div><h2>Services</h2><p>We offer services.</p></div>';
  const serviceGen2 = '<div class="services"><h2>Our Services</h2><ul><li>Plumbing</li></ul></div>';
  const serviceGen3 = '<div class="services"><h2>Our Services</h2><ul><li>Plumbing</li><li>Heating</li></ul></div>';

  createVersionWithEditDistance(db, trendPage2Id, serviceGen1, 'ai_generation', serviceApproved);
  createVersionWithEditDistance(db, trendPage2Id, serviceGen2, 'ai_generation', serviceApproved);
  createVersionWithEditDistance(db, trendPage2Id, serviceGen3, 'ai_generation', serviceApproved);

  const siteStats = getSiteEditDistanceStats(db, trendSiteId);

  t.assertEqual(siteStats.siteId, trendSiteId, 'Aggregation returns correct site ID');
  t.assertGreaterThan(
    siteStats.versionsWithDistance,
    0,
    `Site has ${siteStats.versionsWithDistance} versions with distance data`
  );
  t.assertNotNull(
    siteStats.avgEditDistance,
    'Average edit distance is computed for the site'
  );
  t.assertGreaterThan(
    siteStats.avgEditDistance!,
    0,
    'Average edit distance is positive'
  );

  // With 7 tracked versions (4 from about + 3 from services), trend should be determinable
  t.assertGreaterThanOrEqual(
    siteStats.versionsWithDistance,
    6,
    `Sufficient data for trend detection (${siteStats.versionsWithDistance} versions)`
  );

  // The latest versions should have lower distance, so trend should be improving
  t.assertEqual(
    siteStats.trend,
    'improving',
    'Site trend is "improving" when later cycles have lower edit distance'
  );

  t.assertNotNull(
    siteStats.latestAvgDistance,
    'Latest average distance is computed'
  );

  console.log(`    Site stats: avg=${siteStats.avgEditDistance?.toFixed(1)}, latest_avg=${siteStats.latestAvgDistance?.toFixed(1)}, trend=${siteStats.trend}`);

  // Test site with no edit distance data
  const emptySiteId = seedSite(db, 'Empty Site', 'empty-site');
  const emptyStats = getSiteEditDistanceStats(db, emptySiteId);
  t.assertEqual(
    emptyStats.trend,
    'insufficient_data',
    'Site with no data reports "insufficient_data" trend'
  );

  // =========================================================================
  // 5. Dashboard data — API response shape
  // =========================================================================
  t.section('5. Dashboard Data Shape');

  const dashData = getDashboardEditDistanceData(db, trendSiteId);

  t.assertEqual(dashData.siteId, trendSiteId, 'Dashboard data includes site ID');

  // Summary section
  t.assertNotNull(dashData.summary, 'Dashboard data includes summary');
  t.assertNotNull(dashData.summary.avgEditDistance, 'Summary includes average edit distance');
  t.assert(
    ['improving', 'stable', 'degrading', 'insufficient_data'].includes(dashData.summary.trend),
    'Summary trend is a valid enum value'
  );

  // Per-page breakdown
  t.assertGreaterThanOrEqual(
    dashData.perPage.length,
    2,
    `Dashboard has per-page data for ${dashData.perPage.length} pages`
  );

  for (const page of dashData.perPage) {
    t.assertNotNull(page.pageId, `Page ${page.pageUrl} has an ID`);
    t.assertNotNull(page.pageUrl, `Page ID ${page.pageId} has a URL`);
    t.assertGreaterThan(
      page.versionCount,
      0,
      `Page ${page.pageUrl} has ${page.versionCount} versions`
    );
  }

  // Verify per-page data includes at least one page with edit distance
  const pagesWithDistance = dashData.perPage.filter((p) => p.latestEditDistance !== null);
  t.assertGreaterThan(
    pagesWithDistance.length,
    0,
    'At least one page has edit distance data in dashboard'
  );

  console.log(`    Dashboard pages: ${dashData.perPage.map((p) => `${p.pageUrl}(v${p.versionCount}, d=${p.latestEditDistance})`).join(', ')}`);

  // =========================================================================
  // 6. Edge cases
  // =========================================================================
  t.section('6. Edge Cases');

  // Identical generated and approved HTML
  const identicalPageId = seedPage(db, siteId, '/identical-test', 'Identical', 'test');
  const identicalHtml = '<div>Perfectly generated</div>';
  const vIdentical = createVersionWithEditDistance(
    db,
    identicalPageId,
    identicalHtml,
    'ai_generation',
    identicalHtml // same as generated
  );
  t.assertEqual(
    vIdentical.edit_distance,
    0,
    'Identical generated and approved HTML produces edit distance 0'
  );

  // Very long HTML strings (performance sanity check)
  const longPageId = seedPage(db, siteId, '/long-test', 'Long Page', 'test');
  const longA = '<div>' + 'x'.repeat(5000) + '</div>';
  const longB = '<div>' + 'x'.repeat(4990) + 'y'.repeat(10) + '</div>';
  const startTime = Date.now();
  const vLong = createVersionWithEditDistance(db, longPageId, longA, 'ai_generation', longB);
  const elapsed = Date.now() - startTime;
  t.assertNotNull(vLong.edit_distance, 'Edit distance computed for long strings');
  t.assertLessThan(elapsed, 5000, `Long string computation took ${elapsed}ms (under 5s threshold)`);

  // Empty HTML edge case
  const emptyPageId = seedPage(db, siteId, '/empty-test', 'Empty', 'test');
  const vEmpty = createVersionWithEditDistance(db, emptyPageId, '', 'ai_generation', '<div>Content</div>');
  t.assertNotNull(vEmpty.edit_distance, 'Edit distance computed when generated HTML is empty');
  t.assertEqual(
    vEmpty.edit_distance,
    '<div>Content</div>'.length,
    'Distance from empty to content equals content length'
  );

  // =========================================================================
  // Findings summary
  // =========================================================================
  t.section('Implementation Gap Analysis');

  console.log('  [NOTE] Current export page uses Math.abs(a.length - b.length)');
  console.log('         which is NOT true edit distance. Production code should');
  console.log('         use Levenshtein or similar algorithm.');
  console.log('');
  console.log('  [NOTE] page_versions table does not yet have an edit_distance column.');
  console.log('         A migration (004_edit_distance.sql) is needed.');
  console.log('');
  console.log('  [NOTE] No per-site aggregation API exists yet.');
  console.log('         A route like /api/metrics/edit-distance/[siteId] is needed.');
  console.log('');
  console.log('  [NOTE] Dashboard currently shows simple character diff.');
  console.log('         Should integrate with proper trend tracking.');

  // =========================================================================
  // Summary
  // =========================================================================
  const results = t.summary();

  // Close the in-memory database
  db.close();

  if (results.failed > 0) {
    process.exit(1);
  }
}

main();
