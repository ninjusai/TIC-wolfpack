/**
 * SEO Audit Per Page (WRK-BCE2-014)
 *
 * Assesses SEO quality per page using data already in the database
 * (site_structure_map + content_audit). No HTTP requests needed.
 * Stores seo_score (0.0-1.0) and seo_deficiencies (JSON) in content_audit.
 *
 * Downstream consumers:
 *   - WRK-016+: Gap analysis, work backlog prioritisation
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeoAuditResult {
  structureMapId: number;
  siteId: number;
  seoScore: number;           // 0.0-1.0
  deficiencies: string[];     // Specific SEO issues found
  details: {
    titleScore: number;
    metaDescriptionScore: number;
    headingScore: number;
    canonicalScore: number;
    contentScore: number;
    linkingScore: number;
    imageScore: number;
  };
}

interface StructureMapRow {
  id: number;
  site_id: number;
  url: string;
  title: string | null;
  meta_description: string | null;
  page_type: string | null;
  word_count: number | null;
  heading_structure: string | null;
  has_canonical: number;
  canonical_url: string | null;
}

interface ContentAuditRow {
  id: number;
  structure_map_id: number;
  site_id: number;
  extracted_content: string | null;
  sections: string | null;
  ctas: string | null;
  has_faq_content: number;
  seo_score: number | null;
  seo_deficiencies: string | null;
}

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  title: 0.15,
  metaDescription: 0.10,
  heading: 0.15,
  canonical: 0.10,
  content: 0.25,
  linking: 0.15,
  image: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Word count thresholds by page type
// ---------------------------------------------------------------------------

const WORD_COUNT_THRESHOLDS: Record<string, number> = {
  homepage: 500,
  service: 800,
  location: 600,
  about: 400,
  contact: 200,
  faq: 400,
};
const DEFAULT_WORD_COUNT_THRESHOLD = 500;

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const getStructureMapByIdStmt = db.prepare(`
  SELECT id, site_id, url, title, meta_description, page_type, word_count,
         heading_structure, has_canonical, canonical_url
  FROM site_structure_map WHERE id = ? AND site_id = ?
`);

const getStructureMapBySiteStmt = db.prepare(`
  SELECT sm.id, sm.site_id, sm.url, sm.title, sm.meta_description, sm.page_type,
         sm.word_count, sm.heading_structure, sm.has_canonical, sm.canonical_url
  FROM site_structure_map sm
  INNER JOIN content_audit ca ON ca.structure_map_id = sm.id AND ca.site_id = sm.site_id
  WHERE sm.site_id = ?
`);

const getContentAuditStmt = db.prepare(`
  SELECT id, structure_map_id, site_id, extracted_content, sections, ctas,
         has_faq_content, seo_score, seo_deficiencies
  FROM content_audit WHERE structure_map_id = ? AND site_id = ?
`);

const getAllTitlesForSiteStmt = db.prepare(`
  SELECT id, title FROM site_structure_map WHERE site_id = ? AND title IS NOT NULL
`);

const getAllMetaDescForSiteStmt = db.prepare(`
  SELECT id, meta_description FROM site_structure_map
  WHERE site_id = ? AND meta_description IS NOT NULL
`);

const updateSeoScoreStmt = db.prepare(`
  UPDATE content_audit
  SET seo_score = @seoScore, seo_deficiencies = @seoDeficiencies
  WHERE structure_map_id = @structureMapId AND site_id = @siteId
`);

const getAuditResultsStmt = db.prepare(`
  SELECT ca.structure_map_id, ca.site_id, ca.seo_score, ca.seo_deficiencies
  FROM content_audit ca
  WHERE ca.site_id = ? AND ca.seo_score IS NOT NULL
`);

// ---------------------------------------------------------------------------
// Internal link detection
// ---------------------------------------------------------------------------

const getInternalLinksStmt = db.prepare(`
  SELECT id FROM internal_link_graph
  WHERE site_id = ? AND source_url = ? AND link_type = 'contextual'
`);

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function scoreTitle(
  title: string | null,
  structureMapId: number,
  siteId: number,
  deficiencies: string[]
): number {
  if (!title || title.trim().length === 0) {
    deficiencies.push('Title tag is missing');
    return 0;
  }

  let score = 1.0;
  const len = title.trim().length;

  if (len > 60) {
    deficiencies.push(`Title tag is ${len} characters (recommended max: 60)`);
    score -= 0.3;
  } else if (len < 20) {
    deficiencies.push(`Title tag is only ${len} characters (recommended min: 20)`);
    score -= 0.2;
  }

  // Check uniqueness across site
  const allTitles = getAllTitlesForSiteStmt.all(siteId) as Array<{ id: number; title: string }>;
  const duplicates = allTitles.filter(
    (t) => t.id !== structureMapId && t.title.trim().toLowerCase() === title.trim().toLowerCase()
  );
  if (duplicates.length > 0) {
    deficiencies.push(`Title tag is duplicated across ${duplicates.length + 1} pages`);
    score -= 0.3;
  }

  return Math.max(0, score);
}

function scoreMetaDescription(
  metaDesc: string | null,
  structureMapId: number,
  siteId: number,
  deficiencies: string[]
): number {
  if (!metaDesc || metaDesc.trim().length === 0) {
    deficiencies.push('Meta description is missing');
    return 0;
  }

  let score = 1.0;
  const len = metaDesc.trim().length;

  if (len < 120) {
    deficiencies.push(`Meta description is ${len} characters (recommended min: 120)`);
    score -= 0.25;
  } else if (len > 160) {
    deficiencies.push(`Meta description is ${len} characters (recommended max: 160)`);
    score -= 0.2;
  }

  // Check for CTA / action language
  const ctaPatterns = /\b(book|call|get|schedule|contact|learn|discover|find|request|try|start)\b/i;
  if (!ctaPatterns.test(metaDesc)) {
    deficiencies.push('Meta description lacks a call-to-action or action-oriented language');
    score -= 0.2;
  }

  // Check uniqueness
  const allDescs = getAllMetaDescForSiteStmt.all(siteId) as Array<{
    id: number;
    meta_description: string;
  }>;
  const duplicates = allDescs.filter(
    (d) =>
      d.id !== structureMapId &&
      d.meta_description.trim().toLowerCase() === metaDesc.trim().toLowerCase()
  );
  if (duplicates.length > 0) {
    deficiencies.push(`Meta description is duplicated across ${duplicates.length + 1} pages`);
    score -= 0.3;
  }

  return Math.max(0, score);
}

function scoreHeadings(
  headingStructureJson: string | null,
  deficiencies: string[]
): number {
  if (!headingStructureJson) {
    deficiencies.push('No heading structure data available');
    return 0;
  }

  let headings: Array<{ level: number; text: string }>;
  try {
    headings = JSON.parse(headingStructureJson);
  } catch {
    deficiencies.push('Heading structure data is malformed');
    return 0;
  }

  if (!Array.isArray(headings) || headings.length === 0) {
    deficiencies.push('Page has no headings');
    return 0;
  }

  let score = 1.0;

  // Check H1 count
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    deficiencies.push('Page is missing an H1 tag');
    score -= 0.4;
  } else if (h1s.length > 1) {
    deficiencies.push(`Page has ${h1s.length} H1 tags (should have exactly 1)`);
    score -= 0.3;
  }

  // Check for skipped heading levels
  const levels = headings.map((h) => h.level);
  for (let i = 1; i < levels.length; i++) {
    const jump = levels[i] - levels[i - 1];
    if (jump > 1) {
      deficiencies.push(
        `Heading level skipped: H${levels[i - 1]} jumps to H${levels[i]} (missing H${levels[i - 1] + 1})`
      );
      score -= 0.2;
      break; // Only report once
    }
  }

  // Check heading count — need at least 2 headings for structure
  if (headings.length < 2) {
    deficiencies.push('Page has only 1 heading — lacks content structure');
    score -= 0.15;
  }

  return Math.max(0, score);
}

function scoreCanonical(
  hasCanonical: number,
  canonicalUrl: string | null,
  pageUrl: string,
  deficiencies: string[]
): number {
  if (!hasCanonical) {
    deficiencies.push('Page is missing a canonical tag');
    return 0;
  }

  let score = 1.0;

  if (!canonicalUrl) {
    deficiencies.push('Canonical tag is present but has no URL');
    return 0.2;
  }

  // Check self-referencing
  try {
    const canonicalNorm = new URL(canonicalUrl).pathname.replace(/\/$/, '');
    const pageNorm = new URL(pageUrl).pathname.replace(/\/$/, '');
    if (canonicalNorm !== pageNorm) {
      deficiencies.push(
        `Canonical URL (${canonicalUrl}) does not self-reference the page URL (${pageUrl})`
      );
      score -= 0.3;
    }
  } catch {
    // If URLs can't be parsed, just check string match
    if (canonicalUrl !== pageUrl) {
      deficiencies.push(
        `Canonical URL (${canonicalUrl}) differs from page URL (${pageUrl}) — may not be self-referencing`
      );
      score -= 0.3;
    }
  }

  return Math.max(0, score);
}

function scoreContent(
  extractedContentJson: string | null,
  sectionsJson: string | null,
  hasFaqContent: number,
  ctasJson: string | null,
  pageType: string | null,
  deficiencies: string[]
): number {
  let score = 1.0;

  // Parse extracted content for word count
  let wordCount = 0;
  if (extractedContentJson) {
    try {
      const ec = JSON.parse(extractedContentJson);
      wordCount = ec.wordCount || 0;
    } catch {
      // ignore parse errors
    }
  }

  // Word count check by page type
  const normalizedType = (pageType || '').toLowerCase();
  const threshold = WORD_COUNT_THRESHOLDS[normalizedType] || DEFAULT_WORD_COUNT_THRESHOLD;

  if (wordCount === 0) {
    deficiencies.push('Page has no extractable content');
    return 0;
  }

  if (wordCount < threshold) {
    deficiencies.push(
      `Content is ${wordCount} words (minimum for ${normalizedType || 'this'} page type: ${threshold})`
    );
    // Scale deduction based on how far below threshold
    const ratio = wordCount / threshold;
    score -= (1 - ratio) * 0.4;
  }

  // Content depth — check section count
  let sections: Array<{ type: string; heading?: string; wordCount: number }> = [];
  if (sectionsJson) {
    try {
      sections = JSON.parse(sectionsJson);
    } catch {
      // ignore
    }
  }

  if (sections.length < 3) {
    deficiencies.push(
      `Page has only ${sections.length} content section(s) — lacks content depth (recommend 3+)`
    );
    score -= 0.2;
  }

  // FAQ content check
  if (!hasFaqContent) {
    deficiencies.push('Page lacks FAQ content (helpful for featured snippets and user queries)');
    score -= 0.1;
  }

  // CTA check
  let ctas: Array<{ text: string }> = [];
  if (ctasJson) {
    try {
      ctas = JSON.parse(ctasJson);
    } catch {
      // ignore
    }
  }

  if (ctas.length === 0) {
    deficiencies.push('Page has no calls-to-action (CTAs)');
    score -= 0.15;
  }

  return Math.max(0, score);
}

function scoreLinking(
  siteId: number,
  pageUrl: string,
  extractedContentJson: string | null,
  deficiencies: string[]
): number {
  // Check internal_link_graph for contextual links from this page
  const contextualLinks = getInternalLinksStmt.all(siteId, pageUrl) as Array<{ id: number }>;

  if (contextualLinks.length === 0) {
    // Fallback: check if extracted content mentions internal links
    let hasInlineLinks = false;
    if (extractedContentJson) {
      try {
        const ec = JSON.parse(extractedContentJson);
        const html = ec.mainContentHtml || '';
        // Count anchor tags in main content
        const linkMatches = html.match(/<a\b[^>]*href\s*=\s*["'][^"']*["'][^>]*>/gi);
        if (linkMatches && linkMatches.length > 0) {
          hasInlineLinks = true;
        }
      } catch {
        // ignore
      }
    }

    if (!hasInlineLinks) {
      deficiencies.push('Page has no contextual internal links in the main content');
      return 0;
    }

    // Has inline links but none tracked in link graph — partial credit
    return 0.5;
  }

  let score = 1.0;

  if (contextualLinks.length < 2) {
    deficiencies.push(
      `Page has only ${contextualLinks.length} contextual internal link(s) (recommend 2+)`
    );
    score -= 0.3;
  }

  return Math.max(0, score);
}

function scoreImages(
  extractedContentJson: string | null,
  deficiencies: string[]
): number {
  if (!extractedContentJson) {
    // No content data — can't assess images
    return 0.5; // Neutral
  }

  let images: Array<{ src: string; alt: string; inMainContent: boolean }> = [];
  try {
    const ec = JSON.parse(extractedContentJson);
    images = ec.images || [];
  } catch {
    return 0.5;
  }

  // Filter to main content images only
  const mainImages = images.filter((img) => img.inMainContent);

  if (mainImages.length === 0) {
    deficiencies.push('Page has no images in the main content area');
    return 0.3; // Not zero — some pages legitimately have no images
  }

  let score = 1.0;

  const missingAlt = mainImages.filter((img) => !img.alt || img.alt.trim().length === 0);
  if (missingAlt.length > 0) {
    deficiencies.push(
      `${missingAlt.length} of ${mainImages.length} main content image(s) missing alt text`
    );
    score -= (missingAlt.length / mainImages.length) * 0.5;
  }

  // Check for non-descriptive alt text (just a filename pattern)
  const filenameAlt = mainImages.filter((img) => {
    if (!img.alt) return false;
    const alt = img.alt.trim();
    // Looks like a filename: contains extension or is all-lowercase-with-dashes
    return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(alt) || /^[a-z0-9_-]+$/i.test(alt);
  });
  if (filenameAlt.length > 0) {
    deficiencies.push(
      `${filenameAlt.length} image(s) have non-descriptive alt text (appears to be a filename)`
    );
    score -= (filenameAlt.length / mainImages.length) * 0.3;
  }

  return Math.max(0, score);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Audit SEO quality for a single page. Reads all data from the database.
 * Updates content_audit with the computed seo_score and seo_deficiencies.
 */
export function auditPageSeo(structureMapId: number, siteId: number): SeoAuditResult {
  const sm = getStructureMapByIdStmt.get(structureMapId, siteId) as StructureMapRow | undefined;
  if (!sm) {
    return {
      structureMapId,
      siteId,
      seoScore: 0,
      deficiencies: [`No site_structure_map entry found for id=${structureMapId}, siteId=${siteId}`],
      details: {
        titleScore: 0,
        metaDescriptionScore: 0,
        headingScore: 0,
        canonicalScore: 0,
        contentScore: 0,
        linkingScore: 0,
        imageScore: 0,
      },
    };
  }

  const ca = getContentAuditStmt.get(structureMapId, siteId) as ContentAuditRow | undefined;

  const deficiencies: string[] = [];

  // Score each dimension
  const titleScore = scoreTitle(sm.title, structureMapId, siteId, deficiencies);
  const metaDescriptionScore = scoreMetaDescription(sm.meta_description, structureMapId, siteId, deficiencies);
  const headingScore = scoreHeadings(sm.heading_structure, deficiencies);
  const canonicalScore = scoreCanonical(sm.has_canonical, sm.canonical_url, sm.url, deficiencies);

  const contentScore = scoreContent(
    ca?.extracted_content ?? null,
    ca?.sections ?? null,
    ca?.has_faq_content ?? 0,
    ca?.ctas ?? null,
    sm.page_type,
    deficiencies
  );

  const linkingScore = scoreLinking(siteId, sm.url, ca?.extracted_content ?? null, deficiencies);
  const imageScore = scoreImages(ca?.extracted_content ?? null, deficiencies);

  // Weighted aggregate
  const seoScore = parseFloat(
    (
      titleScore * WEIGHTS.title +
      metaDescriptionScore * WEIGHTS.metaDescription +
      headingScore * WEIGHTS.heading +
      canonicalScore * WEIGHTS.canonical +
      contentScore * WEIGHTS.content +
      linkingScore * WEIGHTS.linking +
      imageScore * WEIGHTS.image
    ).toFixed(3)
  );

  const result: SeoAuditResult = {
    structureMapId,
    siteId,
    seoScore,
    deficiencies,
    details: {
      titleScore,
      metaDescriptionScore,
      headingScore,
      canonicalScore,
      contentScore,
      linkingScore,
      imageScore,
    },
  };

  // Persist to database
  if (ca) {
    updateSeoScoreStmt.run({
      seoScore,
      seoDeficiencies: JSON.stringify(deficiencies),
      structureMapId,
      siteId,
    });
  }

  return result;
}

/**
 * Audit SEO quality for all content-scraped pages of a site.
 * Only audits pages that have a content_audit row (i.e., already scraped).
 */
export function auditSiteSeo(siteId: number): SeoAuditResult[] {
  const pages = getStructureMapBySiteStmt.all(siteId) as StructureMapRow[];
  const results: SeoAuditResult[] = [];

  for (const page of pages) {
    const result = auditPageSeo(page.id, siteId);
    results.push(result);
  }

  return results;
}

/**
 * Get existing SEO audit results for a site (without re-running the audit).
 */
export function getSeoAuditResults(siteId: number): SeoAuditResult[] {
  const rows = getAuditResultsStmt.all(siteId) as Array<{
    structure_map_id: number;
    site_id: number;
    seo_score: number;
    seo_deficiencies: string | null;
  }>;

  return rows.map((row) => {
    let deficiencies: string[] = [];
    if (row.seo_deficiencies) {
      try {
        deficiencies = JSON.parse(row.seo_deficiencies);
      } catch {
        deficiencies = [];
      }
    }

    return {
      structureMapId: row.structure_map_id,
      siteId: row.site_id,
      seoScore: row.seo_score,
      deficiencies,
      details: {
        titleScore: 0,
        metaDescriptionScore: 0,
        headingScore: 0,
        canonicalScore: 0,
        contentScore: 0,
        linkingScore: 0,
        imageScore: 0,
      },
    };
  });
}
