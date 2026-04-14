/**
 * Sitemap-Based Page Inventory (WRK-BCE2-009)
 *
 * Fetches and parses XML sitemaps for a target BookingTimes site,
 * records every URL in the site_structure_map table, detects URL patterns,
 * and classifies pages by type.
 *
 * Does NOT scrape page content — that is WRK-011.
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveredPage {
  url: string;
  title?: string;
  pageType: string;       // 'homepage' | 'service' | 'location' | 'about' | 'faq' | 'contact' | 'other'
  hierarchyLevel: number; // 0=home, 1=core, 2=secondary, 3=location, 4=long-tail
  urlPattern?: string;    // Detected pattern category
  discoveredVia: 'sitemap' | 'crawl' | 'manual';
}

export interface InventoryResult {
  siteId: number;
  siteUrl: string;
  totalPages: number;
  pagesByType: Record<string, number>;
  pages: DiscoveredPage[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REQUEST_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract all <loc> values from an XML string.
 * Works for both <sitemap> entries (sitemap index) and <url> entries.
 */
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const loc = match[1].trim();
    if (loc) locs.push(loc);
  }
  return locs;
}

/**
 * Determine whether an XML string is a sitemap index (contains <sitemapindex>).
 */
function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Normalise a URL: ensure absolute, strip trailing slash (except root).
 */
function normaliseUrl(raw: string, baseUrl: string): string {
  let url: string;
  try {
    url = new URL(raw, baseUrl).href;
  } catch {
    url = raw;
  }
  // Strip trailing slash unless it IS the root
  if (url.endsWith('/') && new URL(url).pathname !== '/') {
    url = url.replace(/\/+$/, '');
  }
  return url;
}

// ---------------------------------------------------------------------------
// Page Classification
// ---------------------------------------------------------------------------

function classifyPage(url: string, siteUrl: string): Pick<DiscoveredPage, 'pageType' | 'hierarchyLevel' | 'urlPattern'> {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';

  // Homepage
  if (pathname === '/' || pathname === '') {
    return { pageType: 'homepage', hierarchyLevel: 0, urlPattern: '/' };
  }

  const lower = pathname.toLowerCase();

  // Service pages
  if (lower.includes('/services/') || lower.includes('/service/')) {
    return { pageType: 'service', hierarchyLevel: 1, urlPattern: '/services/[service]' };
  }
  // Standalone /services listing
  if (lower === '/services' || lower === '/service') {
    return { pageType: 'service', hierarchyLevel: 1, urlPattern: '/services' };
  }

  // Location / suburb pages
  if (lower.includes('/areas/') || lower.includes('/area/')) {
    return { pageType: 'location', hierarchyLevel: 3, urlPattern: '/areas/[suburb]' };
  }
  if (lower.includes('/locations/') || lower.includes('/location/')) {
    return { pageType: 'location', hierarchyLevel: 3, urlPattern: '/locations/[suburb]' };
  }
  if (lower === '/areas' || lower === '/locations') {
    return { pageType: 'location', hierarchyLevel: 2, urlPattern: lower };
  }

  // About
  if (lower.includes('/about')) {
    return { pageType: 'about', hierarchyLevel: 1, urlPattern: '/about' };
  }

  // FAQ
  if (lower.includes('/faq')) {
    return { pageType: 'faq', hierarchyLevel: 2, urlPattern: '/faq' };
  }

  // Contact
  if (lower.includes('/contact')) {
    return { pageType: 'contact', hierarchyLevel: 2, urlPattern: '/contact' };
  }

  // Depth-based hierarchy for 'other'
  const depth = pathname.split('/').filter(Boolean).length;
  const hierarchyLevel = depth >= 3 ? 4 : depth >= 2 ? 3 : 1;

  return { pageType: 'other', hierarchyLevel, urlPattern: undefined };
}

// ---------------------------------------------------------------------------
// Sitemap Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a single URL with error handling. Returns the body text or null.
 */
async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BCE-SitemapCrawler/1.0 (+bookingtimes-content-emulator)',
        'Accept': 'application/xml, text/xml, text/html, */*',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Collect all page URLs from the sitemap(s) for a given site URL.
 * Handles sitemap index files and follows nested sitemaps.
 */
async function collectSitemapUrls(
  siteUrl: string,
  errors: string[]
): Promise<string[]> {
  const sitemapUrl = `${siteUrl.replace(/\/+$/, '')}/sitemap.xml`;
  const body = await fetchText(sitemapUrl);

  if (!body) {
    errors.push(`Failed to fetch sitemap at ${sitemapUrl}`);
    return [];
  }

  // If it's a sitemap index, follow each nested sitemap
  if (isSitemapIndex(body)) {
    const nestedUrls = extractLocs(body);
    const allPageUrls: string[] = [];

    for (const nested of nestedUrls) {
      await sleep(REQUEST_DELAY_MS);
      const nestedBody = await fetchText(nested);
      if (!nestedBody) {
        errors.push(`Failed to fetch nested sitemap: ${nested}`);
        continue;
      }
      const locs = extractLocs(nestedBody);
      allPageUrls.push(...locs);
    }

    return allPageUrls;
  }

  // Plain sitemap
  return extractLocs(body);
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

const insertPageStmt = db.prepare(`
  INSERT OR IGNORE INTO site_structure_map
    (site_id, url, page_type, hierarchy_level, url_pattern, discovered_via, status)
  VALUES
    (@siteId, @url, @pageType, @hierarchyLevel, @urlPattern, @discoveredVia, 'discovered')
`);

const getSiteStmt = db.prepare('SELECT id, url FROM sites WHERE id = ?');

const getExistingUrlsStmt = db.prepare(
  'SELECT url FROM site_structure_map WHERE site_id = ?'
);

const getInventoryStmt = db.prepare(
  'SELECT url, title, page_type, hierarchy_level, url_pattern, discovered_via FROM site_structure_map WHERE site_id = ?'
);

// ---------------------------------------------------------------------------
// Main Inventory Function
// ---------------------------------------------------------------------------

/**
 * Inventory a site: fetch sitemaps, classify pages, store in database.
 */
export async function inventorySite(siteId: number): Promise<InventoryResult> {
  const errors: string[] = [];

  // Look up the site
  const site = getSiteStmt.get(siteId) as { id: number; url: string } | undefined;
  if (!site) {
    return {
      siteId,
      siteUrl: '',
      totalPages: 0,
      pagesByType: {},
      pages: [],
      errors: [`Site with id ${siteId} not found`],
    };
  }

  const siteUrl = site.url;

  // Collect URLs from sitemap
  const rawUrls = await collectSitemapUrls(siteUrl, errors);

  // Normalise and dedupe
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of rawUrls) {
    const normalised = normaliseUrl(raw, siteUrl);
    if (!seen.has(normalised)) {
      seen.add(normalised);
      urls.push(normalised);
    }
  }

  // Ensure homepage is always included
  const homeUrl = normaliseUrl('/', siteUrl);
  if (!seen.has(homeUrl)) {
    urls.unshift(homeUrl);
    seen.add(homeUrl);
  }

  // Classify pages
  const pages: DiscoveredPage[] = urls.map((url) => {
    const classification = classifyPage(url, siteUrl);
    return {
      url,
      pageType: classification.pageType,
      hierarchyLevel: classification.hierarchyLevel,
      urlPattern: classification.urlPattern,
      discoveredVia: 'sitemap' as const,
    };
  });

  // Check existing URLs to understand what's new (for INSERT OR IGNORE)
  // We need a unique constraint for INSERT OR IGNORE to work.
  // Since the schema lacks UNIQUE(site_id, url), we filter in code.
  const existingRows = getExistingUrlsStmt.all(siteId) as Array<{ url: string }>;
  const existingUrls = new Set(existingRows.map((r) => r.url));

  // Insert into database (transactionally)
  const insertAll = db.transaction((pagesToInsert: DiscoveredPage[]) => {
    for (const page of pagesToInsert) {
      if (existingUrls.has(page.url)) continue; // skip duplicates manually
      insertPageStmt.run({
        siteId,
        url: page.url,
        pageType: page.pageType,
        hierarchyLevel: page.hierarchyLevel,
        urlPattern: page.urlPattern ?? null,
        discoveredVia: page.discoveredVia,
      });
    }
  });

  insertAll(pages);

  // Build summary
  const pagesByType: Record<string, number> = {};
  for (const page of pages) {
    pagesByType[page.pageType] = (pagesByType[page.pageType] || 0) + 1;
  }

  return {
    siteId,
    siteUrl,
    totalPages: pages.length,
    pagesByType,
    pages,
    errors,
  };
}

/**
 * Get the current inventory for a site from the database (no fetching).
 */
export function getInventory(siteId: number): InventoryResult {
  const site = getSiteStmt.get(siteId) as { id: number; url: string } | undefined;
  if (!site) {
    return {
      siteId,
      siteUrl: '',
      totalPages: 0,
      pagesByType: {},
      pages: [],
      errors: [`Site with id ${siteId} not found`],
    };
  }

  const rows = getInventoryStmt.all(siteId) as Array<{
    url: string;
    title: string | null;
    page_type: string | null;
    hierarchy_level: number | null;
    url_pattern: string | null;
    discovered_via: string;
  }>;

  const pages: DiscoveredPage[] = rows.map((r) => ({
    url: r.url,
    title: r.title ?? undefined,
    pageType: r.page_type ?? 'other',
    hierarchyLevel: r.hierarchy_level ?? 4,
    urlPattern: r.url_pattern ?? undefined,
    discoveredVia: r.discovered_via as DiscoveredPage['discoveredVia'],
  }));

  const pagesByType: Record<string, number> = {};
  for (const page of pages) {
    pagesByType[page.pageType] = (pagesByType[page.pageType] || 0) + 1;
  }

  return {
    siteId,
    siteUrl: site.url,
    totalPages: pages.length,
    pagesByType,
    pages,
    errors: [],
  };
}
