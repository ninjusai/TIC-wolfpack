/**
 * Anchor Text Bank Generation (WRK-BCE2-026)
 *
 * Generates anchor text variants per target page with proper distribution:
 * - Exact match: 10-20%
 * - Partial match: 30-40%
 * - Branded: 10-15%
 * - Natural/contextual: 30-40%
 * - Generic: <5%
 *
 * Hard constraint: No exact anchor text used more than 3 times site-wide per target URL.
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AnchorTextEntry {
  siteId: number;
  targetUrl: string;
  variantType: 'exact' | 'partial' | 'branded' | 'natural' | 'generic' | 'localized';
  anchorText: string;
  usageCount: number;
}

export interface AnchorBankResult {
  siteId: number;
  totalEntries: number;
  byVariantType: Record<string, number>;
  targets: number;
}

// Internal DB row types

interface SiteRow {
  id: number;
  name: string;
  url: string;
}

interface StructureMapRow {
  url: string;
  page_type: string | null;
}

interface BacklogRow {
  page_type: string;
  target_url: string | null;
  id: number;
}

interface AnchorBankRow {
  id: number;
  site_id: number;
  target_url: string;
  variant_type: string;
  anchor_text: string;
  usage_count: number;
  created_at: string;
}

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getSite: db.prepare<[number]>(
    `SELECT id, name, url FROM sites WHERE id = ?`
  ),

  getStructureMap: db.prepare<[number]>(
    `SELECT url, page_type FROM site_structure_map WHERE site_id = ?`
  ),

  getBacklogCreates: db.prepare<[number]>(
    `SELECT id, page_type, target_url
     FROM work_backlog
     WHERE site_id = ? AND action = 'create' AND status != 'skipped'`
  ),

  clearAnchorBank: db.prepare<[number]>(
    `DELETE FROM anchor_text_bank WHERE site_id = ?`
  ),

  insertAnchor: db.prepare(
    `INSERT OR REPLACE INTO anchor_text_bank (site_id, target_url, variant_type, anchor_text, usage_count)
     VALUES (?, ?, ?, ?, 0)`
  ),

  getAnchorBank: db.prepare<[number]>(
    `SELECT id, site_id, target_url, variant_type, anchor_text, usage_count, created_at
     FROM anchor_text_bank
     WHERE site_id = ?
     ORDER BY target_url, variant_type`
  ),
};

// ── Main Functions ──────────────────────────────────────────────────────────

/**
 * Generate anchor text bank for all pages of a site.
 * Clears existing bank and rebuilds from scratch.
 */
export function generateAnchorBank(siteId: number): AnchorBankResult {
  // 1. Load site info
  const site = stmts.getSite.get(siteId) as SiteRow | undefined;
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  const brandName = site.name;
  const siteBaseUrl = site.url.replace(/\/$/, '');

  // 2. Load all pages
  const pages = loadAllPages(siteId, siteBaseUrl);

  // 3. Generate variants for each page
  const allEntries: Array<{
    targetUrl: string;
    variantType: string;
    anchorText: string;
  }> = [];

  for (const page of pages) {
    const variants = generateVariantsForPage(page, brandName, siteBaseUrl);
    allEntries.push(...variants);
  }

  // 4. Enforce hard constraint: no exact anchor text used more than 3 times site-wide per target
  const anchorUsageByTarget = new Map<string, Map<string, number>>();
  const filteredEntries = allEntries.filter((entry) => {
    const key = entry.targetUrl;
    if (!anchorUsageByTarget.has(key)) {
      anchorUsageByTarget.set(key, new Map());
    }
    const targetMap = anchorUsageByTarget.get(key)!;
    const count = targetMap.get(entry.anchorText) || 0;
    if (count >= 3) return false;
    targetMap.set(entry.anchorText, count + 1);
    return true;
  });

  // 5. Store in DB (transaction)
  const persist = db.transaction(() => {
    stmts.clearAnchorBank.run(siteId);
    for (const entry of filteredEntries) {
      stmts.insertAnchor.run(
        siteId,
        entry.targetUrl,
        entry.variantType,
        entry.anchorText
      );
    }
  });
  persist();

  // 6. Build result summary
  const byVariantType: Record<string, number> = {};
  const targetUrls = new Set<string>();
  for (const entry of filteredEntries) {
    byVariantType[entry.variantType] = (byVariantType[entry.variantType] || 0) + 1;
    targetUrls.add(entry.targetUrl);
  }

  return {
    siteId,
    totalEntries: filteredEntries.length,
    byVariantType,
    targets: targetUrls.size,
  };
}

/**
 * Retrieve the current anchor bank for a site.
 */
export function getAnchorBank(siteId: number): AnchorTextEntry[] {
  const rows = stmts.getAnchorBank.all(siteId) as AnchorBankRow[];
  return rows.map((row) => ({
    siteId: row.site_id,
    targetUrl: row.target_url,
    variantType: row.variant_type as AnchorTextEntry['variantType'],
    anchorText: row.anchor_text,
    usageCount: row.usage_count,
  }));
}

// ── Page Loading ────────────────────────────────────────────────────────────

interface PageInfo {
  url: string;
  pageType: string;
  keywords: string[];
  locationName: string | null;
  serviceName: string | null;
}

function loadAllPages(siteId: number, siteBaseUrl: string): PageInfo[] {
  const pages: PageInfo[] = [];
  const seenUrls = new Set<string>();

  // Existing pages from site_structure_map
  const existingPages = stmts.getStructureMap.all(siteId) as StructureMapRow[];
  for (const page of existingPages) {
    if (!page.url || seenUrls.has(page.url)) continue;
    seenUrls.add(page.url);
    pages.push(parsePageInfo(page.url, page.page_type || 'unknown'));
  }

  // Planned pages from work_backlog
  const backlogItems = stmts.getBacklogCreates.all(siteId) as BacklogRow[];
  for (const item of backlogItems) {
    const url = item.target_url || `${siteBaseUrl}/${item.page_type}-${item.id}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    pages.push(parsePageInfo(url, item.page_type));
  }

  return pages;
}

/**
 * Extract page type, keywords, location name, and service name from URL patterns.
 */
function parsePageInfo(url: string, pageType: string): PageInfo {
  const urlPath = url.replace(/^https?:\/\/[^/]+/, '');
  const segments = urlPath.split('/').filter(Boolean);

  let locationName: string | null = null;
  let serviceName: string | null = null;
  const keywords: string[] = [];

  // Extract from URL patterns
  if (pageType === 'location' || segments.includes('areas') || segments.includes('locations')) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      locationName = slugToTitle(lastSegment);
      keywords.push(locationName);
    }
  }

  if (pageType === 'service' || segments.includes('services')) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      serviceName = slugToWords(lastSegment);
      keywords.push(serviceName);
    }
  }

  // For other page types, extract keywords from URL segments
  if (!locationName && !serviceName && segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      keywords.push(slugToWords(lastSegment));
    }
  }

  return { url, pageType, keywords, locationName, serviceName };
}

/**
 * Convert a URL slug to title case (for location names).
 * e.g., "acacia-ridge" -> "Acacia Ridge"
 */
function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Convert a URL slug to lowercase words.
 * e.g., "automatic-lessons" -> "automatic lessons"
 */
function slugToWords(slug: string): string {
  return slug.split('-').join(' ');
}

// ── Variant Generation ──────────────────────────────────────────────────────

interface AnchorVariant {
  targetUrl: string;
  variantType: string;
  anchorText: string;
}

function generateVariantsForPage(
  page: PageInfo,
  brandName: string,
  siteBaseUrl: string
): AnchorVariant[] {
  const variants: AnchorVariant[] = [];
  const brandShort = brandName.split(' ')[0]; // First word of brand

  // Extract location from site URL for localized variants
  const siteLocation = extractSiteLocation(siteBaseUrl, brandName);

  switch (page.pageType) {
    case 'homepage':
      addHomepageVariants(variants, page, brandName, brandShort, siteLocation);
      break;
    case 'service':
      addServiceVariants(variants, page, brandName, brandShort, siteLocation);
      break;
    case 'location':
      addLocationVariants(variants, page, brandName, brandShort);
      break;
    case 'about':
      addTrustPageVariants(variants, page, brandName, brandShort, 'about us');
      break;
    case 'faq':
      addTrustPageVariants(variants, page, brandName, brandShort, 'FAQs');
      break;
    case 'contact':
      addTrustPageVariants(variants, page, brandName, brandShort, 'contact us');
      break;
    default:
      addGenericPageVariants(variants, page, brandName, brandShort);
      break;
  }

  return variants;
}

function addHomepageVariants(
  variants: AnchorVariant[],
  page: PageInfo,
  brandName: string,
  brandShort: string,
  siteLocation: string | null
): void {
  const target = page.url;

  // Exact (1-2)
  addVariant(variants, target, 'exact', brandName);

  // Partial (2-3)
  addVariant(variants, target, 'partial', `${brandShort} driving lessons`);
  if (siteLocation) {
    addVariant(variants, target, 'partial', `driving school in ${siteLocation}`);
  }

  // Branded (1)
  addVariant(variants, target, 'branded', brandShort);

  // Natural (2-3)
  addVariant(variants, target, 'natural', 'our driving school');
  addVariant(variants, target, 'natural', 'learn to drive');

  // Generic (0-1)
  addVariant(variants, target, 'generic', 'learn more');

  // Localized (1)
  if (siteLocation) {
    addVariant(variants, target, 'localized', `${siteLocation} driving school`);
  }
}

function addServiceVariants(
  variants: AnchorVariant[],
  page: PageInfo,
  brandName: string,
  brandShort: string,
  siteLocation: string | null
): void {
  const target = page.url;
  const service = page.serviceName || page.keywords[0] || 'our services';

  // Exact (1-2)
  addVariant(variants, target, 'exact', service);

  // Partial (2-3)
  addVariant(variants, target, 'partial', `learn ${service}`);
  addVariant(variants, target, 'partial', `${service} packages`);

  // Branded (1)
  addVariant(variants, target, 'branded', `${brandShort} ${service}`);

  // Natural (2)
  addVariant(variants, target, 'natural', `our ${service}`);
  addVariant(variants, target, 'natural', `explore ${service}`);

  // Generic (0-1)
  addVariant(variants, target, 'generic', 'find out more');

  // Localized (1)
  if (siteLocation) {
    addVariant(variants, target, 'localized', `${service} in ${siteLocation}`);
  }
}

function addLocationVariants(
  variants: AnchorVariant[],
  page: PageInfo,
  brandName: string,
  brandShort: string
): void {
  const target = page.url;
  const location = page.locationName || page.keywords[0] || 'our area';

  // Exact (1)
  addVariant(variants, target, 'exact', `driving lessons ${location}`);

  // Partial (2-3)
  addVariant(variants, target, 'partial', `${location} driving school`);
  addVariant(variants, target, 'partial', `lessons in ${location}`);

  // Branded (1)
  addVariant(variants, target, 'branded', `${brandShort} ${location}`);

  // Natural (2)
  addVariant(variants, target, 'natural', `driving near ${location}`);
  addVariant(variants, target, 'natural', `our ${location} area`);

  // Generic (0-1) — skip to keep generic < 5%

  // Localized (1)
  addVariant(variants, target, 'localized', location);
}

function addTrustPageVariants(
  variants: AnchorVariant[],
  page: PageInfo,
  brandName: string,
  brandShort: string,
  pageName: string
): void {
  const target = page.url;

  // Exact (1)
  addVariant(variants, target, 'exact', pageName);

  // Partial (2)
  addVariant(variants, target, 'partial', `${brandShort} ${pageName}`);
  addVariant(variants, target, 'partial', `our ${pageName} page`);

  // Branded (1)
  addVariant(variants, target, 'branded', `${brandShort} info`);

  // Natural (2)
  addVariant(variants, target, 'natural', `learn about us`);
  addVariant(variants, target, 'natural', `get in touch`);

  // Generic (0-1)
  addVariant(variants, target, 'generic', 'click here');
}

function addGenericPageVariants(
  variants: AnchorVariant[],
  page: PageInfo,
  brandName: string,
  brandShort: string
): void {
  const target = page.url;
  const pageName = page.keywords[0] || 'this page';

  // Exact (1)
  addVariant(variants, target, 'exact', pageName);

  // Partial (2)
  addVariant(variants, target, 'partial', `${brandShort} ${pageName}`);
  addVariant(variants, target, 'partial', `our ${pageName}`);

  // Branded (1)
  addVariant(variants, target, 'branded', brandShort);

  // Natural (2)
  addVariant(variants, target, 'natural', `view ${pageName}`);
  addVariant(variants, target, 'natural', `explore ${pageName}`);

  // Generic (0-1)
  addVariant(variants, target, 'generic', 'learn more');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function addVariant(
  variants: AnchorVariant[],
  targetUrl: string,
  variantType: string,
  anchorText: string
): void {
  // Enforce 2-5 word constraint
  const wordCount = anchorText.trim().split(/\s+/).length;
  if (wordCount < 2) {
    // Pad single-word anchors to minimum 2 words only if possible
    // Allow branded single words as-is since they are common
    if (variantType !== 'branded' && variantType !== 'localized') {
      return;
    }
  }
  if (wordCount > 5) {
    // Truncate to 5 words
    anchorText = anchorText.trim().split(/\s+/).slice(0, 5).join(' ');
  }

  variants.push({ targetUrl, variantType, anchorText: anchorText.trim() });
}

/**
 * Try to extract a city/location from the brand name or site URL.
 * Common patterns: "Metro Driving School Brisbane" or site URL contains city.
 */
function extractSiteLocation(siteBaseUrl: string, brandName: string): string | null {
  // Common Australian cities to check in brand name
  const cities = [
    'Brisbane', 'Sydney', 'Melbourne', 'Perth', 'Adelaide',
    'Gold Coast', 'Sunshine Coast', 'Canberra', 'Hobart', 'Darwin',
  ];

  for (const city of cities) {
    if (brandName.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
    if (siteBaseUrl.toLowerCase().includes(city.toLowerCase().replace(/\s+/g, ''))) {
      return city;
    }
  }

  // Fallback: check URL for common city-like subdomains
  const urlMatch = siteBaseUrl.match(/(?:www\.)?([a-z]+)(?:driving|school|lessons)/i);
  if (urlMatch) {
    const candidate = urlMatch[1];
    if (candidate && candidate.length > 3) {
      return slugToTitle(candidate);
    }
  }

  return null;
}
