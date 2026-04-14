/**
 * Missing Page Identification Engine (WRK-BCE2-023)
 *
 * Cross-references page_taxonomy against site_structure_map and gap_analysis
 * to identify page types that should exist but don't, plus weak pages that
 * need improvement. Creates work_backlog entries for downstream processing
 * (blueprint generation, content creation).
 *
 * Priority follows DEC-031: Homepage (1) > Services (2) > About/FAQ (3) > Locations (4)
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissingPageResult {
  siteId: number;
  missingPages: Array<{
    pageType: string;
    reason: string;
    suggestedUrl?: string;
    priority: number;
  }>;
  weakPages: Array<{
    pageType: string;
    existingUrl: string;
    gapStatus: string;
    priority: number;
  }>;
  backlogItemsCreated: number;
}

interface BacklogEntry {
  id: number;
  site_id: number;
  gap_analysis_id: number | null;
  page_type: string;
  target_url: string | null;
  action: string;
  priority: number;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface TaxonomyRow {
  id: number;
  page_type: string;
  hierarchy_level: number;
  display_name: string;
  silo: string | null;
}

interface StructureMapRow {
  id: number;
  site_id: number;
  url: string;
  page_type: string | null;
  status: string | null;
}

interface GapAnalysisRow {
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
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const getTaxonomyStmt = db.prepare(`
  SELECT id, page_type, hierarchy_level, display_name, silo
  FROM page_taxonomy
  ORDER BY hierarchy_level, page_type
`);

const getStructureMapForSiteStmt = db.prepare(`
  SELECT id, site_id, url, page_type, status
  FROM site_structure_map
  WHERE site_id = ?
`);

const getGapAnalysisForSiteStmt = db.prepare(`
  SELECT id, site_id, page_type, status, existing_page_id,
         seo_gap_score, geo_gap_score, schema_gap_score, design_gap_score, content_gap_score,
         deficiencies, priority
  FROM gap_analysis
  WHERE site_id = ?
`);

const clearWorkBacklogStmt = db.prepare(`
  DELETE FROM work_backlog WHERE site_id = ?
`);

const insertWorkBacklogStmt = db.prepare(`
  INSERT INTO work_backlog (site_id, gap_analysis_id, page_type, target_url, action, priority, status)
  VALUES (?, ?, ?, ?, ?, ?, 'pending')
`);

const getWorkBacklogStmt = db.prepare(`
  SELECT id, site_id, gap_analysis_id, page_type, target_url, action, priority, status, created_at
  FROM work_backlog
  WHERE site_id = ?
  ORDER BY priority ASC
`);

// ---------------------------------------------------------------------------
// Priority mapping (DEC-031)
// ---------------------------------------------------------------------------

const PAGE_TYPE_PRIORITY: Record<string, number> = {
  homepage: 1,
  service: 2,
  about: 3,
  faq: 3,
  contact: 3,
  location: 4,
};
const DEFAULT_PRIORITY = 5;

/**
 * Compute priority for backlog items. Missing pages get a lower (higher
 * priority) offset than weak pages.
 */
function computeBacklogPriority(pageType: string, action: 'create' | 'improve' | 'rewrite'): number {
  const level = PAGE_TYPE_PRIORITY[pageType] ?? DEFAULT_PRIORITY;
  const actionOffset: Record<string, number> = {
    create: 0,
    rewrite: 50,
    improve: 100,
  };
  return level * 1000 + (actionOffset[action] ?? 0);
}

// ---------------------------------------------------------------------------
// Action classification
// ---------------------------------------------------------------------------

/**
 * Determine what action to take on a weak page based on its average gap score.
 * High gap score (> 0.7) → rewrite; otherwise → improve.
 */
function classifyWeakAction(gap: GapAnalysisRow): 'improve' | 'rewrite' {
  const scores = [
    gap.seo_gap_score ?? 1.0,
    gap.geo_gap_score ?? 1.0,
    gap.schema_gap_score ?? 1.0,
    gap.design_gap_score ?? 1.0,
    gap.content_gap_score ?? 1.0,
  ];
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return avg > 0.7 ? 'rewrite' : 'improve';
}

// ---------------------------------------------------------------------------
// URL suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest a URL path for a missing page type.
 * These are defaults — the operator may override them.
 */
function suggestUrl(pageType: string): string | undefined {
  const defaults: Record<string, string> = {
    homepage: '/',
    about: '/about',
    faq: '/faq',
    contact: '/contact',
  };
  // Service and location pages don't have predictable URLs
  return defaults[pageType];
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Identify missing and weak pages for a site by cross-referencing taxonomy
 * against site_structure_map and gap_analysis. Creates work_backlog entries.
 *
 * Idempotent — clears existing work_backlog for the site before inserting.
 */
export function identifyMissingPages(siteId: number): MissingPageResult {
  const taxonomy = getTaxonomyStmt.all() as TaxonomyRow[];
  const structurePages = getStructureMapForSiteStmt.all(siteId) as StructureMapRow[];
  const gapRows = getGapAnalysisForSiteStmt.all(siteId) as GapAnalysisRow[];

  // Group existing pages by page_type
  const pagesByType = new Map<string, StructureMapRow[]>();
  for (const page of structurePages) {
    const type = (page.page_type || 'unknown').toLowerCase();
    if (!pagesByType.has(type)) {
      pagesByType.set(type, []);
    }
    pagesByType.get(type)!.push(page);
  }

  // Index gap_analysis by page_type (may have multiple entries per type, e.g. location)
  const gapsByType = new Map<string, GapAnalysisRow[]>();
  for (const gap of gapRows) {
    const type = gap.page_type.toLowerCase();
    if (!gapsByType.has(type)) {
      gapsByType.set(type, []);
    }
    gapsByType.get(type)!.push(gap);
  }

  const missingPages: MissingPageResult['missingPages'] = [];
  const weakPages: MissingPageResult['weakPages'] = [];

  for (const taxEntry of taxonomy) {
    const pageType = taxEntry.page_type;
    const existingPages = pagesByType.get(pageType) || [];
    const gaps = gapsByType.get(pageType) || [];

    if (existingPages.length === 0) {
      // No pages of this type exist at all — completely missing
      const priority = computeBacklogPriority(pageType, 'create');
      missingPages.push({
        pageType,
        reason: `No ${taxEntry.display_name} page exists in site_structure_map`,
        suggestedUrl: suggestUrl(pageType),
        priority,
      });
      continue;
    }

    // Check gap_analysis for weak pages
    for (const gap of gaps) {
      if (gap.status === 'missing' && gap.existing_page_id === null) {
        // Gap analysis flagged this type as missing (e.g. additional location pages needed)
        const priority = computeBacklogPriority(pageType, 'create');
        missingPages.push({
          pageType,
          reason: gap.deficiencies
            ? JSON.parse(gap.deficiencies).join('; ')
            : `Gap analysis flagged missing ${taxEntry.display_name}`,
          suggestedUrl: undefined,
          priority,
        });
      } else if (gap.status === 'weak' && gap.existing_page_id !== null) {
        // Find the URL from structure map
        const matchingPage = existingPages.find((p) => p.id === gap.existing_page_id);
        const existingUrl = matchingPage?.url ?? 'unknown';
        const priority = computeBacklogPriority(pageType, classifyWeakAction(gap));
        weakPages.push({
          pageType,
          existingUrl,
          gapStatus: gap.status,
          priority,
        });
      }
    }

    // Location pages: check if taxonomy expects locations but we have very few
    // This is a placeholder — the operator will manually specify which locations to add later
    if (pageType === 'location') {
      const existingLocationCount = existingPages.length;
      const missingLocationGaps = gaps.filter(
        (g) => g.status === 'missing' && g.existing_page_id === null
      );
      // If gap_analysis already flagged missing locations, we've handled it above.
      // Otherwise, note if the site has suspiciously few location pages.
      if (missingLocationGaps.length === 0 && existingLocationCount < 3) {
        missingPages.push({
          pageType: 'location',
          reason: `Only ${existingLocationCount} location page(s) found — additional suburb pages likely needed. Operator should specify target suburbs.`,
          suggestedUrl: undefined,
          priority: computeBacklogPriority('location', 'create'),
        });
      }
    }
  }

  // ---- Persist to work_backlog (idempotent) ----
  let backlogItemsCreated = 0;

  const persist = db.transaction(() => {
    // Clear existing backlog for this site
    clearWorkBacklogStmt.run(siteId);

    // Insert missing pages → action = 'create'
    for (const mp of missingPages) {
      // Try to find a matching gap_analysis_id
      const matchingGap = (gapsByType.get(mp.pageType) || []).find(
        (g) => g.status === 'missing' && g.existing_page_id === null
      );
      insertWorkBacklogStmt.run(
        siteId,
        matchingGap?.id ?? null,
        mp.pageType,
        mp.suggestedUrl ?? null,
        'create',
        mp.priority
      );
      backlogItemsCreated++;
    }

    // Insert weak pages → action = 'improve' or 'rewrite'
    for (const wp of weakPages) {
      const matchingGap = (gapsByType.get(wp.pageType) || []).find(
        (g) => g.status === 'weak' && g.existing_page_id !== null
      );
      const action = matchingGap ? classifyWeakAction(matchingGap) : 'improve';
      insertWorkBacklogStmt.run(
        siteId,
        matchingGap?.id ?? null,
        wp.pageType,
        wp.existingUrl,
        action,
        wp.priority
      );
      backlogItemsCreated++;
    }
  });

  persist();

  return {
    siteId,
    missingPages,
    weakPages,
    backlogItemsCreated,
  };
}

// ---------------------------------------------------------------------------
// Read API
// ---------------------------------------------------------------------------

/**
 * Retrieve current work_backlog entries for a site, sorted by priority.
 */
export function getWorkBacklog(siteId: number): BacklogEntry[] {
  return getWorkBacklogStmt.all(siteId) as BacklogEntry[];
}
