/**
 * Gap Comparison Engine (WRK-BCE2-022)
 *
 * For each page type in the taxonomy, scores existing site pages across all
 * dimensions against Stage 2 benchmarks. Classifies pages as
 * Missing / Weak / Adequate / Strong.
 *
 * Stores results in the `gap_analysis` table for downstream consumers
 * (work backlog, blueprint generation, priority scheduling).
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GapResult {
  siteId: number;
  pageType: string;
  status: 'missing' | 'weak' | 'adequate' | 'strong';
  existingPageId: number | null;  // site_structure_map.id if page exists
  seoGapScore: number;            // 0.0-1.0 (1.0 = large gap)
  geoGapScore: number;
  schemaGapScore: number;
  designGapScore: number;
  contentGapScore: number;
  deficiencies: string[];
  priority: number;               // Computed priority
  silo: string | null;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface TaxonomyRow {
  id: number;
  page_type: string;
  hierarchy_level: number;
  display_name: string;
  target_word_count_min: number;
  target_word_count_max: number;
  silo: string | null;
}

interface StructureMapRow {
  id: number;
  site_id: number;
  url: string;
  page_type: string | null;
  word_count: number | null;
}

interface ContentAuditRow {
  id: number;
  structure_map_id: number;
  site_id: number;
  seo_score: number | null;
  geo_score: number | null;
  schema_score: number | null;
  design_score: number | null;
  overall_score: number | null;
  seo_deficiencies: string | null;
  geo_deficiencies: string | null;
  schema_deficiencies: string | null;
}

interface SchemaAuditRow {
  id: number;
  structure_map_id: number;
  site_id: number;
  missing_types: string | null;
  missing_properties: string | null;
  validation_errors: string | null;
}

interface BenchmarkRow {
  id: number;
  category: string;
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const getTaxonomyStmt = db.prepare(`
  SELECT id, page_type, hierarchy_level, display_name,
         target_word_count_min, target_word_count_max, silo
  FROM page_taxonomy
  ORDER BY hierarchy_level, page_type
`);

const getStructureMapForSiteStmt = db.prepare(`
  SELECT id, site_id, url, page_type, word_count
  FROM site_structure_map
  WHERE site_id = ?
`);

const getContentAuditForPageStmt = db.prepare(`
  SELECT id, structure_map_id, site_id, seo_score, geo_score, schema_score,
         design_score, overall_score, seo_deficiencies, geo_deficiencies, schema_deficiencies
  FROM content_audit
  WHERE structure_map_id = ? AND site_id = ?
`);

const getSchemaAuditForPageStmt = db.prepare(`
  SELECT id, structure_map_id, site_id, missing_types, missing_properties, validation_errors
  FROM schema_audit
  WHERE structure_map_id = ? AND site_id = ?
`);

const getWordCountBenchmarkStmt = db.prepare(`
  SELECT id, category, key, value
  FROM benchmark_standards
  WHERE category = 'content' AND key = 'word_count_targets'
`);

const clearGapAnalysisStmt = db.prepare(`
  DELETE FROM gap_analysis WHERE site_id = ?
`);

const insertGapAnalysisStmt = db.prepare(`
  INSERT INTO gap_analysis (site_id, page_type, status, existing_page_id,
    seo_gap_score, geo_gap_score, schema_gap_score, design_gap_score, content_gap_score,
    deficiencies, priority, silo)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getGapAnalysisStmt = db.prepare(`
  SELECT id, site_id, page_type, status, existing_page_id,
         seo_gap_score, geo_gap_score, schema_gap_score, design_gap_score, content_gap_score,
         deficiencies, priority, silo, created_at
  FROM gap_analysis
  WHERE site_id = ?
  ORDER BY priority ASC
`);

// ---------------------------------------------------------------------------
// Priority mapping (DEC-031: Homepage always first)
// ---------------------------------------------------------------------------

const PAGE_TYPE_PRIORITY_LEVEL: Record<string, number> = {
  homepage: 1,
  service: 2,
  about: 3,
  faq: 3,
  contact: 3,
  location: 4,
};
const DEFAULT_PRIORITY_LEVEL = 5;

const STATUS_PRIORITY_OFFSET: Record<string, number> = {
  missing: 0,
  weak: 100,
  adequate: 200,
  strong: 300,
};

/**
 * Compute a numeric priority. Lower = higher priority.
 * Combines page type level with status to ensure:
 * - Homepage always first
 * - Missing > Weak > Adequate > Strong within a level
 */
function computePriority(pageType: string, status: 'missing' | 'weak' | 'adequate' | 'strong'): number {
  const level = PAGE_TYPE_PRIORITY_LEVEL[pageType] ?? DEFAULT_PRIORITY_LEVEL;
  const offset = STATUS_PRIORITY_OFFSET[status];
  return level * 1000 + offset;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classifyStatus(avgGapScore: number): 'weak' | 'adequate' | 'strong' {
  if (avgGapScore > 0.7) return 'weak';
  if (avgGapScore >= 0.4) return 'adequate';
  return 'strong';
}

// ---------------------------------------------------------------------------
// Word count benchmark loading
// ---------------------------------------------------------------------------

function loadWordCountTargets(): Record<string, { min: number; max: number; target: number }> {
  const row = getWordCountBenchmarkStmt.get() as BenchmarkRow | undefined;
  if (!row) {
    // Fallback defaults matching seo-benchmarks.ts
    return {
      homepage: { min: 500, max: 1500, target: 800 },
      service: { min: 800, max: 2000, target: 1200 },
      location: { min: 600, max: 1500, target: 900 },
      about: { min: 400, max: 1000, target: 600 },
      faq: { min: 500, max: 2000, target: 1000 },
    };
  }
  return JSON.parse(row.value);
}

// ---------------------------------------------------------------------------
// Content gap scoring
// ---------------------------------------------------------------------------

function computeContentGapScore(
  wordCount: number | null,
  pageType: string,
  wordCountTargets: Record<string, { min: number; max: number; target: number }>
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];
  const targets = wordCountTargets[pageType];

  if (!targets) {
    // Unknown page type — can't assess content gap, assume moderate gap
    return { score: 0.5, deficiencies: ['No word count benchmark for this page type'] };
  }

  if (!wordCount || wordCount === 0) {
    deficiencies.push(`No content found (target: ${targets.target} words)`);
    return { score: 1.0, deficiencies };
  }

  // Gap = how far below the target
  if (wordCount >= targets.target) {
    return { score: 0.0, deficiencies };
  }

  if (wordCount >= targets.min) {
    const ratio = (targets.target - wordCount) / targets.target;
    deficiencies.push(
      `Word count ${wordCount} is below target ${targets.target} (minimum: ${targets.min})`
    );
    return { score: parseFloat(ratio.toFixed(3)), deficiencies };
  }

  // Below minimum
  const ratio = Math.min(1.0, (targets.target - wordCount) / targets.target);
  deficiencies.push(
    `Word count ${wordCount} is below minimum ${targets.min} (target: ${targets.target})`
  );
  return { score: parseFloat(ratio.toFixed(3)), deficiencies };
}

// ---------------------------------------------------------------------------
// Schema gap scoring
// ---------------------------------------------------------------------------

function computeSchemaGapScore(
  schemaAudit: SchemaAuditRow | null
): { score: number; deficiencies: string[] } {
  if (!schemaAudit) {
    return { score: 1.0, deficiencies: ['No schema audit data — maximum gap assumed'] };
  }

  const deficiencies: string[] = [];
  let issues = 0;
  let maxIssues = 0;

  // Missing types
  const missingTypes: string[] = schemaAudit.missing_types
    ? JSON.parse(schemaAudit.missing_types)
    : [];
  if (missingTypes.length > 0) {
    issues += missingTypes.length;
    deficiencies.push(`Missing schema types: ${missingTypes.join(', ')}`);
  }
  maxIssues += 3; // typical expected types count

  // Missing properties
  const missingProps: string[] = schemaAudit.missing_properties
    ? JSON.parse(schemaAudit.missing_properties)
    : [];
  if (missingProps.length > 0) {
    issues += missingProps.length;
    deficiencies.push(`Missing schema properties: ${missingProps.join(', ')}`);
  }
  maxIssues += 5; // typical required properties count

  // Validation errors
  const validationErrors: string[] = schemaAudit.validation_errors
    ? JSON.parse(schemaAudit.validation_errors)
    : [];
  if (validationErrors.length > 0) {
    issues += validationErrors.length;
    deficiencies.push(`${validationErrors.length} schema validation error(s)`);
  }
  maxIssues += 2;

  if (maxIssues === 0) return { score: 0.0, deficiencies };

  const score = Math.min(1.0, issues / maxIssues);
  return { score: parseFloat(score.toFixed(3)), deficiencies };
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Analyze gaps for all page types in the taxonomy against the site's existing pages.
 * Clears previous gap_analysis data for the site (idempotent re-runs).
 * Returns sorted array of GapResult by priority.
 */
export function analyzeGaps(siteId: number): GapResult[] {
  const taxonomy = getTaxonomyStmt.all() as TaxonomyRow[];
  const structureMapPages = getStructureMapForSiteStmt.all(siteId) as StructureMapRow[];
  const wordCountTargets = loadWordCountTargets();

  // Group existing pages by page_type
  const pagesByType = new Map<string, StructureMapRow[]>();
  for (const page of structureMapPages) {
    const type = (page.page_type || 'unknown').toLowerCase();
    if (!pagesByType.has(type)) {
      pagesByType.set(type, []);
    }
    pagesByType.get(type)!.push(page);
  }

  const results: GapResult[] = [];

  for (const taxEntry of taxonomy) {
    const pageType = taxEntry.page_type;
    const existingPages = pagesByType.get(pageType) || [];

    if (existingPages.length === 0) {
      // No pages of this type exist — status = 'missing', all gap scores = 1.0
      const deficiencies = [`No ${taxEntry.display_name} page exists for this site`];
      const status: 'missing' = 'missing';
      const priority = computePriority(pageType, status);

      results.push({
        siteId,
        pageType,
        status,
        existingPageId: null,
        seoGapScore: 1.0,
        geoGapScore: 1.0,
        schemaGapScore: 1.0,
        designGapScore: 1.0,
        contentGapScore: 1.0,
        deficiencies,
        priority,
        silo: taxEntry.silo,
      });
      continue;
    }

    // For location pages: create one entry per existing page, plus one "missing" entry
    // for undetected locations
    if (pageType === 'location') {
      for (const page of existingPages) {
        const gapResult = analyzeExistingPage(page, pageType, taxEntry, siteId, wordCountTargets);
        results.push(gapResult);
      }

      // Add one "missing" entry representing the gap for undetected locations
      results.push({
        siteId,
        pageType: 'location',
        status: 'missing',
        existingPageId: null,
        seoGapScore: 1.0,
        geoGapScore: 1.0,
        schemaGapScore: 1.0,
        designGapScore: 1.0,
        contentGapScore: 1.0,
        deficiencies: ['Additional location pages needed — gap for undetected service areas'],
        priority: computePriority('location', 'missing'),
        silo: taxEntry.silo,
      });
      continue;
    }

    // For non-location page types: analyze each existing page
    for (const page of existingPages) {
      const gapResult = analyzeExistingPage(page, pageType, taxEntry, siteId, wordCountTargets);
      results.push(gapResult);
    }
  }

  // Sort by priority (ascending = highest priority first)
  results.sort((a, b) => a.priority - b.priority);

  // Persist to database in a transaction
  const persist = db.transaction(() => {
    clearGapAnalysisStmt.run(siteId);
    for (const result of results) {
      insertGapAnalysisStmt.run(
        result.siteId,
        result.pageType,
        result.status,
        result.existingPageId,
        result.seoGapScore,
        result.geoGapScore,
        result.schemaGapScore,
        result.designGapScore,
        result.contentGapScore,
        JSON.stringify(result.deficiencies),
        result.priority,
        result.silo
      );
    }
  });

  persist();

  return results;
}

/**
 * Analyze gap scores for a single existing page against benchmarks.
 */
function analyzeExistingPage(
  page: StructureMapRow,
  pageType: string,
  taxEntry: TaxonomyRow,
  siteId: number,
  wordCountTargets: Record<string, { min: number; max: number; target: number }>
): GapResult {
  const deficiencies: string[] = [];

  // Load audit data
  const contentAudit = getContentAuditForPageStmt.get(page.id, siteId) as ContentAuditRow | undefined;
  const schemaAudit = getSchemaAuditForPageStmt.get(page.id, siteId) as SchemaAuditRow | undefined;

  // SEO gap score
  let seoGapScore = 1.0;
  if (contentAudit?.seo_score != null) {
    seoGapScore = parseFloat((1.0 - contentAudit.seo_score).toFixed(3));
    if (seoGapScore > 0.3) {
      const seoDeficiencies: string[] = contentAudit.seo_deficiencies
        ? JSON.parse(contentAudit.seo_deficiencies)
        : [];
      deficiencies.push(...seoDeficiencies.slice(0, 3)); // Top 3 SEO issues
    }
  } else {
    deficiencies.push('No SEO audit data — run SEO audit first');
  }

  // GEO gap score
  let geoGapScore = 1.0;
  if (contentAudit?.geo_score != null) {
    geoGapScore = parseFloat((1.0 - contentAudit.geo_score).toFixed(3));
    if (geoGapScore > 0.3) {
      const geoDeficiencies: string[] = contentAudit.geo_deficiencies
        ? JSON.parse(contentAudit.geo_deficiencies)
        : [];
      deficiencies.push(...geoDeficiencies.slice(0, 3)); // Top 3 GEO issues
    }
  } else {
    deficiencies.push('No GEO audit data — run GEO audit first');
  }

  // Schema gap score
  const schemaGap = computeSchemaGapScore(schemaAudit ?? null);
  const schemaGapScore = schemaGap.score;
  deficiencies.push(...schemaGap.deficiencies);

  // Design gap score — placeholder (no design audit yet)
  const designGapScore = 0.5;

  // Content gap score — based on word count vs benchmark target
  const contentGap = computeContentGapScore(page.word_count, pageType, wordCountTargets);
  const contentGapScore = contentGap.score;
  deficiencies.push(...contentGap.deficiencies);

  // Classify based on average gap score
  const avgGapScore = (seoGapScore + geoGapScore + schemaGapScore + designGapScore + contentGapScore) / 5;
  const status = classifyStatus(avgGapScore);
  const priority = computePriority(pageType, status);

  return {
    siteId,
    pageType,
    status,
    existingPageId: page.id,
    seoGapScore,
    geoGapScore,
    schemaGapScore,
    designGapScore,
    contentGapScore,
    deficiencies,
    priority,
    silo: taxEntry.silo,
  };
}

// ---------------------------------------------------------------------------
// Read API
// ---------------------------------------------------------------------------

/**
 * Retrieve existing gap analysis results for a site from the database.
 * Does NOT re-run the analysis — returns what was previously stored.
 */
export function getGapAnalysis(siteId: number): GapResult[] {
  const rows = getGapAnalysisStmt.all(siteId) as Array<{
    id: number;
    site_id: number;
    page_type: string;
    status: string;
    existing_page_id: number | null;
    seo_gap_score: number | null;
    geo_gap_score: number | null;
    schema_gap_score: number | null;
    design_gap_score: number | null;
    content_gap_score: number | null;
    deficiencies: string | null;
    priority: number | null;
    silo: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    siteId: row.site_id,
    pageType: row.page_type,
    status: row.status as GapResult['status'],
    existingPageId: row.existing_page_id,
    seoGapScore: row.seo_gap_score ?? 1.0,
    geoGapScore: row.geo_gap_score ?? 1.0,
    schemaGapScore: row.schema_gap_score ?? 1.0,
    designGapScore: row.design_gap_score ?? 1.0,
    contentGapScore: row.content_gap_score ?? 1.0,
    deficiencies: row.deficiencies ? JSON.parse(row.deficiencies) : [],
    priority: row.priority ?? 9999,
    silo: row.silo,
  }));
}
