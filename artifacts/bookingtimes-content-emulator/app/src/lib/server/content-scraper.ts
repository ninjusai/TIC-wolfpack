/**
 * Content Scraping and Extraction (WRK-BCE2-011)
 *
 * Scrapes 5-10 representative pages per site, extracts main content
 * (excluding nav, sidebar, footer), preserves heading hierarchy,
 * captures images/lists/CTAs with markup, and stores results in content_audit.
 *
 * Downstream consumers:
 *   - WRK-012: Brand voice inference
 *   - WRK-013-015: SEO/GEO/Schema audits
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedContent {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  headingStructure: Array<{
    level: number;
    text: string;
  }>;
  mainContent: string;
  mainContentHtml: string;
  sections: Array<{
    type: string;
    heading?: string;
    wordCount: number;
    html: string;
  }>;
  ctas: Array<{
    text: string;
    placement: string;
    linkTarget?: string;
  }>;
  images: Array<{
    src: string;
    alt: string;
    inMainContent: boolean;
  }>;
  wordCount: number;
  hasDirectAnswerBlock: boolean;
  hasFaqContent: boolean;
  statisticsCount: number;
  canonicalUrl?: string;
  jsonLd: string[];
}

export interface ContentScrapeResult {
  siteId: number;
  pagesScraped: number;
  pages: ExtractedContent[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PAGE_FETCH_TIMEOUT = 30_000;
const INTER_PAGE_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch a URL as text with timeout. Returns null on failure. */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Strip HTML tags and decode common entities, returning plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Count words in plain text. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// ---------------------------------------------------------------------------
// HTML Extraction Helpers
// ---------------------------------------------------------------------------

/** Extract the <title> content. */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]) : '';
}

/** Extract <meta name="description" content="...">. */
function extractMetaDescription(html: string): string {
  const m = html.match(/<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i)
    || html.match(/<meta\s+[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i);
  return m ? m[1].trim() : '';
}

/** Extract canonical URL from <link rel="canonical">. */
function extractCanonicalUrl(html: string): string | undefined {
  const m = html.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/i)
    || html.match(/<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["'][^>]*\/?>/i);
  return m ? m[1].trim() : undefined;
}

/** Extract all JSON-LD blocks from the page. */
function extractJsonLd(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const content = m[1].trim();
    if (content) blocks.push(content);
  }
  return blocks;
}

/** Extract all headings with their level from HTML. */
function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    headings.push({
      level: parseInt(m[1], 10),
      text: stripHtml(m[2]),
    });
  }
  return headings;
}

/** Extract all images from HTML. */
function extractImages(html: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = [];
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = tag.match(/src\s*=\s*["']([^"']+)["']/i);
    const altMatch = tag.match(/alt\s*=\s*["']([^"']*)["']/i);
    if (srcMatch) {
      images.push({
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : '',
      });
    }
  }
  return images;
}

// ---------------------------------------------------------------------------
// Main Content Extraction
// ---------------------------------------------------------------------------

/**
 * Remove header, nav, footer, and sidebar elements from HTML.
 * Returns the cleaned body HTML.
 */
function removeChrome(html: string): string {
  // Remove <header>...</header>, <nav>...</nav>, <footer>...</footer>
  let cleaned = html;
  cleaned = cleaned.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '');
  cleaned = cleaned.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '');
  cleaned = cleaned.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Remove common sidebar patterns
  cleaned = cleaned.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '');
  cleaned = cleaned.replace(/<div\b[^>]*class\s*=\s*["'][^"']*sidebar[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove script and style tags
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  return cleaned;
}

/**
 * Extract the main content area from the page HTML.
 * Tries common selectors, falls back to the largest text block.
 */
function extractMainContent(html: string): string {
  // Try common main content selectors via regex
  const selectors = [
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<div\b[^>]*role\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\b[^>]*class\s*=\s*["'][^"']*content-area[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\b[^>]*class\s*=\s*["'][^"']*main-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\b[^>]*id\s*=\s*["']content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  ];

  for (const selector of selectors) {
    const m = html.match(selector);
    if (m && stripHtml(m[1]).length > 100) {
      return m[1];
    }
  }

  // Fallback: extract body content after removing chrome
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  return removeChrome(bodyHtml);
}

// ---------------------------------------------------------------------------
// Section Detection
// ---------------------------------------------------------------------------

/**
 * Split main content HTML into logical sections by heading breaks (H2/H3).
 */
function splitIntoSections(mainHtml: string): Array<{ heading?: string; html: string }> {
  // Split on H2 or H3 tags
  const parts = mainHtml.split(/(?=<h[23]\b)/i);
  const sections: Array<{ heading?: string; html: string }> = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Try to extract the heading from this section
    const headingMatch = trimmed.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i);
    sections.push({
      heading: headingMatch ? stripHtml(headingMatch[1]) : undefined,
      html: trimmed,
    });
  }

  return sections;
}

/** Classify a section by its content. */
function classifySection(
  section: { heading?: string; html: string },
  index: number,
  totalSections: number
): string {
  const lower = section.html.toLowerCase();
  const headingLower = (section.heading || '').toLowerCase();

  // Hero: first section, usually contains H1
  if (index === 0 && (/<h1\b/i.test(section.html) || !section.heading)) {
    return 'hero';
  }

  // FAQ detection
  if (
    headingLower.includes('faq') ||
    headingLower.includes('frequently asked') ||
    headingLower.includes('common questions') ||
    lower.includes('<details') ||
    lower.includes('<summary') ||
    // Q&A pattern: multiple "Q:" or "Question:" patterns
    (lower.match(/\bq[\s]*[:\.]/gi) || []).length >= 2
  ) {
    return 'faq';
  }

  // CTA detection
  if (
    lower.includes('book now') ||
    lower.includes('call us') ||
    lower.includes('get in touch') ||
    lower.includes('request a quote') ||
    lower.includes('schedule') ||
    lower.includes('contact us')
  ) {
    // Only classify as CTA if it's relatively short
    if (wordCount(stripHtml(section.html)) < 100) {
      return 'cta';
    }
  }

  // Services detection
  if (
    headingLower.includes('service') ||
    headingLower.includes('what we offer') ||
    headingLower.includes('our services') ||
    headingLower.includes('what we do')
  ) {
    return 'services';
  }

  return 'content';
}

// ---------------------------------------------------------------------------
// CTA Extraction
// ---------------------------------------------------------------------------

function extractCTAs(html: string, mainContentHtml: string): Array<{
  text: string;
  placement: string;
  linkTarget?: string;
}> {
  const ctas: Array<{ text: string; placement: string; linkTarget?: string }> = [];

  // CTA patterns: links/buttons with booking/contact language
  const ctaPatterns = [
    /book\s*(?:now|online|today|appointment)/i,
    /call\s*(?:us|now|today)/i,
    /get\s*(?:a\s*)?(?:quote|started|in\s*touch)/i,
    /schedule\s*(?:now|today|a\s*)/i,
    /contact\s*us/i,
    /request\s*(?:a\s*)?(?:quote|callback|appointment)/i,
    /free\s*(?:quote|consultation|estimate)/i,
  ];

  // Search for links matching CTA patterns
  const linkRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const linkText = stripHtml(m[1]);
    const fullTag = m[0];

    for (const pattern of ctaPatterns) {
      if (pattern.test(linkText)) {
        const hrefMatch = fullTag.match(/href\s*=\s*["']([^"']+)["']/i);

        // Determine placement
        let placement = 'inline';
        const position = m.index;
        const heroEnd = html.indexOf('</h1>');
        if (heroEnd > 0 && position < heroEnd + 500) {
          placement = 'hero';
        }

        ctas.push({
          text: linkText,
          placement,
          linkTarget: hrefMatch ? hrefMatch[1] : undefined,
        });
        break;
      }
    }
  }

  // Also check for button elements
  const btnRe = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  while ((m = btnRe.exec(html)) !== null) {
    const btnText = stripHtml(m[1]);
    for (const pattern of ctaPatterns) {
      if (pattern.test(btnText)) {
        ctas.push({
          text: btnText,
          placement: 'inline',
        });
        break;
      }
    }
  }

  return ctas;
}

// ---------------------------------------------------------------------------
// Statistics Detection
// ---------------------------------------------------------------------------

/** Count statistics/numeric claims in text. */
function countStatistics(text: string): number {
  let count = 0;
  // Percentages: "85%", "over 90%"
  count += (text.match(/\d+\s*%/g) || []).length;
  // Dollar amounts: "$500", "$1,200"
  count += (text.match(/\$[\d,]+/g) || []).length;
  // Year counts: "15+ years", "over 20 years"
  count += (text.match(/\d+\+?\s*years?/gi) || []).length;
  // "X,000+" or "X+" large numbers
  count += (text.match(/[\d,]+\+\s/g) || []).length;
  // "#1" or "number one"
  count += (text.match(/#\s*1\b/g) || []).length;
  count += (text.match(/number\s*one/gi) || []).length;
  return count;
}

/** Detect whether the page has a direct answer block (definition-style content near the top). */
function hasDirectAnswer(mainHtml: string): boolean {
  // Look for a paragraph early in the content that directly answers "what is" or defines something
  const firstSection = mainHtml.slice(0, 2000).toLowerCase();
  return (
    firstSection.includes('is a ') ||
    firstSection.includes('is an ') ||
    firstSection.includes('refers to ') ||
    firstSection.includes('are a type of') ||
    /<p\b[^>]*>[^<]{50,200}<\/p>/i.test(mainHtml.slice(0, 1500))
  );
}

// ---------------------------------------------------------------------------
// Public API — Single Page Scrape
// ---------------------------------------------------------------------------

/**
 * Scrape a single page and extract content.
 */
export async function scrapePageContent(url: string): Promise<ExtractedContent> {
  const html = await fetchPage(url);

  if (!html) {
    return emptyContent(url);
  }

  // Extract page-level metadata
  const title = extractTitle(html);
  const metaDescription = extractMetaDescription(html);
  const canonicalUrl = extractCanonicalUrl(html);
  const jsonLd = extractJsonLd(html);

  // Extract all headings from full page
  const headingStructure = extractHeadings(html);
  const h1 = headingStructure.find((h) => h.level === 1)?.text || '';

  // Extract all images from full page (for inMainContent tagging later)
  const allImages = extractImages(html);

  // Extract main content area
  const mainContentHtml = extractMainContent(html);
  const mainContent = stripHtml(mainContentHtml);
  const mainWc = wordCount(mainContent);

  // Images: tag which ones are in main content
  const mainImgSrcs = new Set(extractImages(mainContentHtml).map((i) => i.src));
  const images = allImages.map((img) => ({
    ...img,
    inMainContent: mainImgSrcs.has(img.src),
  }));

  // Split main content into sections and classify
  const rawSections = splitIntoSections(mainContentHtml);
  const sections = rawSections.map((s, i) => {
    const type = classifySection(s, i, rawSections.length);
    return {
      type,
      heading: s.heading,
      wordCount: wordCount(stripHtml(s.html)),
      html: s.html,
    };
  });

  // CTAs
  const ctas = extractCTAs(html, mainContentHtml);

  // FAQ detection
  const hasFaqContent =
    sections.some((s) => s.type === 'faq') ||
    mainContentHtml.toLowerCase().includes('frequently asked') ||
    mainContentHtml.toLowerCase().includes('<details');

  // Statistics count
  const statisticsCount = countStatistics(mainContent);

  // Direct answer block
  const hasDirectAnswerBlock = hasDirectAnswer(mainContentHtml);

  return {
    url,
    title,
    metaDescription,
    h1,
    headingStructure,
    mainContent,
    mainContentHtml,
    sections,
    ctas,
    images,
    wordCount: mainWc,
    hasDirectAnswerBlock,
    hasFaqContent,
    statisticsCount,
    canonicalUrl,
    jsonLd,
  };
}

/** Return an empty ExtractedContent for failed fetches. */
function emptyContent(url: string): ExtractedContent {
  return {
    url,
    title: '',
    metaDescription: '',
    h1: '',
    headingStructure: [],
    mainContent: '',
    mainContentHtml: '',
    sections: [],
    ctas: [],
    images: [],
    wordCount: 0,
    hasDirectAnswerBlock: false,
    hasFaqContent: false,
    statisticsCount: 0,
    jsonLd: [],
  };
}

// ---------------------------------------------------------------------------
// Page Selection
// ---------------------------------------------------------------------------

interface StructureMapRow {
  id: number;
  url: string;
  page_type: string | null;
  title: string | null;
}

const getStructureMapStmt = db.prepare(
  'SELECT id, url, page_type, title FROM site_structure_map WHERE site_id = ?'
);

/**
 * Select 5-10 representative pages from the site_structure_map.
 * Priority: homepage, all service pages, 2-3 location pages, about page.
 */
function selectPages(siteId: number): StructureMapRow[] {
  const rows = getStructureMapStmt.all(siteId) as StructureMapRow[];

  if (rows.length === 0) return [];

  const selected: StructureMapRow[] = [];
  const seen = new Set<number>();

  function add(row: StructureMapRow) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      selected.push(row);
    }
  }

  // Homepage
  const homepage = rows.find((r) => r.page_type === 'homepage');
  if (homepage) add(homepage);

  // All service pages
  const servicePages = rows.filter((r) => r.page_type === 'service');
  for (const sp of servicePages) add(sp);

  // Up to 3 location pages
  const locationPages = rows.filter((r) => r.page_type === 'location');
  for (const lp of locationPages.slice(0, 3)) add(lp);

  // About page
  const aboutPage = rows.find((r) => r.page_type === 'about');
  if (aboutPage) add(aboutPage);

  // FAQ page
  const faqPage = rows.find((r) => r.page_type === 'faq');
  if (faqPage) add(faqPage);

  // Contact page
  const contactPage = rows.find((r) => r.page_type === 'contact');
  if (contactPage) add(contactPage);

  // If still under 5 pages, add some 'other' pages
  if (selected.length < 5) {
    const others = rows.filter((r) => !seen.has(r.id));
    for (const o of others) {
      if (selected.length >= 5) break;
      add(o);
    }
  }

  // Cap at 10
  return selected.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

const getSiteStmt = db.prepare('SELECT id, url FROM sites WHERE id = ?');

const upsertContentAuditStmt = db.prepare(`
  INSERT INTO content_audit (structure_map_id, site_id, extracted_content, sections, ctas,
    has_direct_answer_block, has_faq_content, statistics_count, freshness_date)
  VALUES (@structureMapId, @siteId, @extractedContent, @sections, @ctas,
    @hasDirectAnswerBlock, @hasFaqContent, @statisticsCount, @freshnessDate)
`);

const updateStructureMapStmt = db.prepare(`
  UPDATE site_structure_map
  SET word_count = @wordCount,
      heading_structure = @headingStructure,
      has_schema = @hasSchema,
      schema_types = @schemaTypes,
      has_canonical = @hasCanonical,
      canonical_url = @canonicalUrl,
      title = @title,
      meta_description = @metaDescription,
      last_scraped_at = datetime('now')
  WHERE id = @id
`);

const getContentAuditStmt = db.prepare(
  'SELECT * FROM content_audit WHERE site_id = ?'
);

/** Parse JSON-LD blocks to extract schema types. */
function extractSchemaTypes(jsonLdBlocks: string[]): string[] {
  const types = new Set<string>();
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      if (parsed['@type']) {
        const t = Array.isArray(parsed['@type']) ? parsed['@type'] : [parsed['@type']];
        t.forEach((type: string) => types.add(type));
      }
      // Check @graph items
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        for (const item of parsed['@graph']) {
          if (item['@type']) {
            const t = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            t.forEach((type: string) => types.add(type));
          }
        }
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  }
  return Array.from(types);
}

/** Save a single page's extracted content to the database. */
function savePageToDB(
  siteId: number,
  structureMapId: number,
  content: ExtractedContent
): void {
  // Insert into content_audit
  upsertContentAuditStmt.run({
    structureMapId,
    siteId,
    extractedContent: JSON.stringify({
      url: content.url,
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      mainContent: content.mainContent,
      mainContentHtml: content.mainContentHtml,
      images: content.images,
      wordCount: content.wordCount,
      jsonLd: content.jsonLd,
    }),
    sections: JSON.stringify(content.sections),
    ctas: JSON.stringify(content.ctas),
    hasDirectAnswerBlock: content.hasDirectAnswerBlock ? 1 : 0,
    hasFaqContent: content.hasFaqContent ? 1 : 0,
    statisticsCount: content.statisticsCount,
    freshnessDate: new Date().toISOString().split('T')[0],
  });

  // Update site_structure_map with scraped metadata
  const schemaTypes = extractSchemaTypes(content.jsonLd);
  updateStructureMapStmt.run({
    id: structureMapId,
    wordCount: content.wordCount,
    headingStructure: JSON.stringify(content.headingStructure),
    hasSchema: content.jsonLd.length > 0 ? 1 : 0,
    schemaTypes: schemaTypes.length > 0 ? JSON.stringify(schemaTypes) : null,
    hasCanonical: content.canonicalUrl ? 1 : 0,
    canonicalUrl: content.canonicalUrl ?? null,
    title: content.title || null,
    metaDescription: content.metaDescription || null,
  });
}

// ---------------------------------------------------------------------------
// Public API — Full Site Scrape
// ---------------------------------------------------------------------------

/**
 * Scrape representative pages for a site.
 * Selects: homepage + all service pages + 2-3 location pages + about.
 * Uses site_structure_map to pick pages.
 */
export async function scrapeSiteContent(siteId: number): Promise<ContentScrapeResult> {
  const errors: string[] = [];

  // Validate site exists
  const site = getSiteStmt.get(siteId) as { id: number; url: string } | undefined;
  if (!site) {
    return { siteId, pagesScraped: 0, pages: [], errors: [`Site with id ${siteId} not found`] };
  }

  // Select representative pages
  const pagesToScrape = selectPages(siteId);
  if (pagesToScrape.length === 0) {
    return {
      siteId,
      pagesScraped: 0,
      pages: [],
      errors: ['No pages found in site_structure_map. Run inventory (WRK-009) first.'],
    };
  }

  const pages: ExtractedContent[] = [];

  for (let i = 0; i < pagesToScrape.length; i++) {
    const row = pagesToScrape[i];

    // Inter-page delay (skip before first)
    if (i > 0) {
      await sleep(INTER_PAGE_DELAY_MS);
    }

    try {
      const content = await scrapePageContent(row.url);

      if (content.mainContent.length === 0) {
        errors.push(`No main content extracted from ${row.url}`);
      }

      // Persist to database
      savePageToDB(siteId, row.id, content);
      pages.push(content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to scrape ${row.url}: ${msg}`);
    }
  }

  return {
    siteId,
    pagesScraped: pages.length,
    pages,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Read API — Get existing content audit data
// ---------------------------------------------------------------------------

/**
 * Get existing content_audit rows for a site.
 */
export function getContentAudit(siteId: number): ContentScrapeResult {
  const site = getSiteStmt.get(siteId) as { id: number; url: string } | undefined;
  if (!site) {
    return { siteId, pagesScraped: 0, pages: [], errors: [`Site with id ${siteId} not found`] };
  }

  const rows = getContentAuditStmt.all(siteId) as Array<{
    id: number;
    structure_map_id: number;
    site_id: number;
    extracted_content: string | null;
    sections: string | null;
    ctas: string | null;
    has_direct_answer_block: number;
    has_faq_content: number;
    statistics_count: number;
    freshness_date: string | null;
  }>;

  const pages: ExtractedContent[] = rows.map((row) => {
    const ec = row.extracted_content ? JSON.parse(row.extracted_content) : {};
    const sections = row.sections ? JSON.parse(row.sections) : [];
    const ctas = row.ctas ? JSON.parse(row.ctas) : [];

    return {
      url: ec.url || '',
      title: ec.title || '',
      metaDescription: ec.metaDescription || '',
      h1: ec.h1 || '',
      headingStructure: ec.headingStructure || [],
      mainContent: ec.mainContent || '',
      mainContentHtml: ec.mainContentHtml || '',
      sections,
      ctas,
      images: ec.images || [],
      wordCount: ec.wordCount || 0,
      hasDirectAnswerBlock: row.has_direct_answer_block === 1,
      hasFaqContent: row.has_faq_content === 1,
      statisticsCount: row.statistics_count,
      canonicalUrl: ec.canonicalUrl,
      jsonLd: ec.jsonLd || [],
    };
  });

  return {
    siteId,
    pagesScraped: pages.length,
    pages,
    errors: [],
  };
}
