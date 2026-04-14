/**
 * Page Blueprint Generator (WRK-BCE2-028)
 *
 * For each work_backlog item, generates a page_blueprint with page-level rules:
 * SEO targets, GEO requirements, schema spec placeholder, linking rules,
 * voice constraints, CSS tier preference. Dynamic section count per page.
 *
 * Data sources:
 *   - work_backlog (pending/blueprinted items)
 *   - page_taxonomy (section requirements per page type)
 *   - benchmark_standards (SEO/GEO rules)
 *   - brand_profiles (voice constraints)
 *   - internal_link_graph (link assignments)
 *   - silo_definitions (silo membership)
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BlueprintResult {
  siteId: number;
  blueprintsCreated: number;
  blueprints: Array<{
    backlogId: number;
    pageType: string;
    workingTitle: string;
    sectionCount: number;
  }>;
}

interface BacklogItem {
  id: number;
  site_id: number;
  gap_analysis_id: number | null;
  page_type: string;
  target_url: string | null;
  action: string;
  priority: number;
  status: string;
}

interface TaxonomyEntry {
  page_type: string;
  hierarchy_level: number;
  display_name: string;
  h1_pattern: string | null;
  required_sections: string[];
  optional_sections: string[];
  target_word_count_min: number;
  target_word_count_max: number;
  primary_keyword_pattern: string | null;
  schema_types: string[];
  silo: string | null;
  geo_requirements: Record<string, unknown> | null;
}

interface BrandProfileRow {
  voice_description: string | null;
  tone_keywords: string | null;
  terminology_patterns: string | null;
  sentence_style: string | null;
  recurring_phrases: string | null;
  anti_patterns: string | null;
  target_audience: string | null;
  brand_personality: string | null;
}

interface LinkRow {
  source_url: string;
  target_url: string;
  link_type: string;
  section: string | null;
  status: string;
}

interface SiloRow {
  silo_name: string;
  hub_page_type: string;
  hub_url: string | null;
  internal_linking_policy: string;
}

interface SiteRow {
  name: string;
  url: string;
}

interface BenchmarkRow {
  category: string;
  key: string;
  value: string;
}

interface BlueprintRow {
  id: number;
  backlog_id: number;
  site_id: number;
  target_keywords: string | null;
  working_title: string | null;
  h1_text: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  page_level_seo_rules: string | null;
  page_level_geo_rules: string | null;
  page_level_voice_rules: string | null;
  page_level_css_rules: string | null;
  section_count: number | null;
  section_count_rationale: string | null;
  internal_links_required: string | null;
  internal_links_optional: string | null;
  breadcrumb_path: string | null;
  silo_membership: string | null;
  schema_spec: string | null;
  section_order: string | null;
  coherence_requirements: string | null;
  user_approved: number;
  created_at: string;
}

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getBacklogItems: db.prepare<[number]>(
    `SELECT id, site_id, gap_analysis_id, page_type, target_url, action, priority, status
     FROM work_backlog
     WHERE site_id = ? AND status IN ('pending', 'blueprinted')
     ORDER BY priority ASC`
  ),

  getTaxonomy: db.prepare(
    `SELECT page_type, hierarchy_level, display_name, h1_pattern,
            required_sections, optional_sections,
            target_word_count_min, target_word_count_max,
            primary_keyword_pattern, schema_types, silo, geo_requirements
     FROM page_taxonomy`
  ),

  getBenchmarks: db.prepare(
    `SELECT category, key, value
     FROM benchmark_standards
     WHERE category IN ('seo', 'geo', 'content', 'linking')
     ORDER BY category, key`
  ),

  getBrandProfile: db.prepare<[number]>(
    `SELECT voice_description, tone_keywords, terminology_patterns,
            sentence_style, recurring_phrases, anti_patterns,
            target_audience, brand_personality
     FROM brand_profiles
     WHERE site_id = ?`
  ),

  getLinkGraph: db.prepare<[number]>(
    `SELECT source_url, target_url, link_type, section, status
     FROM internal_link_graph
     WHERE site_id = ?`
  ),

  getSilos: db.prepare<[number]>(
    `SELECT silo_name, hub_page_type, hub_url, internal_linking_policy
     FROM silo_definitions
     WHERE site_id = ?`
  ),

  getSite: db.prepare<[number]>(
    `SELECT name, url FROM sites WHERE id = ?`
  ),

  insertBlueprint: db.prepare(
    `INSERT INTO page_blueprints
       (backlog_id, site_id, target_keywords, working_title, h1_text,
        meta_title, meta_description, canonical_url,
        page_level_seo_rules, page_level_geo_rules,
        page_level_voice_rules, page_level_css_rules,
        section_count, section_count_rationale,
        internal_links_required, internal_links_optional,
        breadcrumb_path, silo_membership,
        schema_spec, section_order, coherence_requirements, user_approved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),

  clearBlueprintsForBacklog: db.prepare<[number]>(
    `DELETE FROM page_blueprints WHERE backlog_id = ?`
  ),

  updateBacklogStatus: db.prepare<[string, number]>(
    `UPDATE work_backlog SET status = ? WHERE id = ?`
  ),

  getBlueprints: db.prepare<[number]>(
    `SELECT pb.*, wb.page_type, wb.action, wb.priority
     FROM page_blueprints pb
     JOIN work_backlog wb ON pb.backlog_id = wb.id
     WHERE pb.site_id = ?
     ORDER BY wb.priority ASC`
  ),
};

// ── Main Functions ──────────────────────────────────────────────────────────

/**
 * Generate blueprints for all pending/blueprinted work_backlog items.
 * Replaces any existing blueprints for the same backlog items.
 * Uses a transaction for consistency.
 */
export function generateBlueprints(siteId: number): BlueprintResult {
  // 1. Load work_backlog items
  const backlogItems = stmts.getBacklogItems.all(siteId) as BacklogItem[];

  if (backlogItems.length === 0) {
    return { siteId, blueprintsCreated: 0, blueprints: [] };
  }

  // 2. Load taxonomy
  const taxonomyRows = stmts.getTaxonomy.all() as Array<{
    page_type: string;
    hierarchy_level: number;
    display_name: string;
    h1_pattern: string | null;
    required_sections: string;
    optional_sections: string;
    target_word_count_min: number;
    target_word_count_max: number;
    primary_keyword_pattern: string | null;
    schema_types: string;
    silo: string | null;
    geo_requirements: string | null;
  }>;

  const taxonomyMap = new Map<string, TaxonomyEntry>();
  for (const row of taxonomyRows) {
    taxonomyMap.set(row.page_type, {
      ...row,
      required_sections: JSON.parse(row.required_sections),
      optional_sections: JSON.parse(row.optional_sections),
      schema_types: JSON.parse(row.schema_types),
      geo_requirements: row.geo_requirements ? JSON.parse(row.geo_requirements) : null,
    });
  }

  // 3. Load benchmarks
  const benchmarkRows = stmts.getBenchmarks.all() as BenchmarkRow[];
  const benchmarks = new Map<string, Record<string, unknown>>();
  for (const row of benchmarkRows) {
    benchmarks.set(`${row.category}:${row.key}`, JSON.parse(row.value));
  }

  // 4. Load brand profile
  const brandProfile = stmts.getBrandProfile.get(siteId) as BrandProfileRow | undefined;

  // 5. Load link graph
  const linkRows = stmts.getLinkGraph.all(siteId) as LinkRow[];

  // 6. Load silo definitions
  const siloRows = stmts.getSilos.all(siteId) as SiloRow[];
  const siloMap = new Map<string, SiloRow>();
  for (const silo of siloRows) {
    siloMap.set(silo.silo_name, silo);
  }

  // 7. Load site info
  const site = stmts.getSite.get(siteId) as SiteRow | undefined;
  const siteName = site?.name || 'Site';
  const siteUrl = site?.url?.replace(/\/$/, '') || '';

  // Track page types seen for section ordering variation
  const pageTypeCounter = new Map<string, number>();

  // 8. Generate blueprints in a transaction
  const result: BlueprintResult = { siteId, blueprintsCreated: 0, blueprints: [] };

  const generate = db.transaction(() => {
    for (const item of backlogItems) {
      const taxonomy = taxonomyMap.get(item.page_type);
      if (!taxonomy) {
        console.log(`[blueprint-generator] No taxonomy found for page_type="${item.page_type}", skipping backlog #${item.id}`);
        continue;
      }

      // Track how many of this page type we've generated (for variation)
      const typeIndex = pageTypeCounter.get(item.page_type) || 0;
      pageTypeCounter.set(item.page_type, typeIndex + 1);

      // Compute dynamic section count
      const { sectionCount, rationale } = computeSectionCount(taxonomy, item, typeIndex);

      // Build keyword list
      const keywords = inferKeywords(item, taxonomy);

      // Generate title/meta
      const workingTitle = generateWorkingTitle(item, taxonomy, siteName);
      const h1Text = generateH1(item, taxonomy);
      const metaTitle = generateMetaTitle(item, taxonomy, siteName);
      const metaDescription = generateMetaDescription(item, taxonomy, siteName);

      // Canonical URL
      const canonicalUrl = item.target_url || `${siteUrl}/${item.page_type}-${item.id}`;

      // SEO/GEO/Voice rules
      const seoRules = seoRulesForPageType(item.page_type, benchmarks);
      const geoRules = geoRulesForPageType(item.page_type, benchmarks, taxonomy);
      const voiceRules = voiceRulesFromProfile(brandProfile);
      const cssRules = { preferredTier: 1, allowTier2: true };

      // Link assignments
      const requiredLinks = getRequiredLinks(item, linkRows);
      const optionalLinks = getOptionalLinks(item, linkRows);

      // Breadcrumb
      const breadcrumb = buildBreadcrumb(item, taxonomy, siteName, siteUrl);

      // Silo membership
      const siloMembership = taxonomy.silo || null;

      // Coherence requirements
      const coherence = { transitions: true, voiceConsistency: true };

      // Clear any existing blueprint for this backlog item
      stmts.clearBlueprintsForBacklog.run(item.id);

      // Insert blueprint
      stmts.insertBlueprint.run(
        item.id,
        siteId,
        JSON.stringify(keywords),
        workingTitle,
        h1Text,
        metaTitle,
        metaDescription,
        canonicalUrl,
        JSON.stringify(seoRules),
        JSON.stringify(geoRules),
        JSON.stringify(voiceRules),
        JSON.stringify(cssRules),
        sectionCount,
        rationale,
        JSON.stringify(requiredLinks),
        JSON.stringify(optionalLinks),
        JSON.stringify(breadcrumb),
        siloMembership,
        null, // schema_spec — WRK-031 fills this
        null, // section_order — WRK-029 fills this
        JSON.stringify(coherence),
        0
      );

      // Update backlog status
      stmts.updateBacklogStatus.run('blueprinted', item.id);

      result.blueprints.push({
        backlogId: item.id,
        pageType: item.page_type,
        workingTitle,
        sectionCount,
      });
      result.blueprintsCreated++;
    }
  });

  generate();
  return result;
}

/**
 * Retrieve all existing blueprints for a site.
 */
export function getBlueprints(siteId: number): BlueprintRow[] {
  return stmts.getBlueprints.all(siteId) as BlueprintRow[];
}

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Compute dynamic section count based on taxonomy and content needs.
 * Ensures variation: alternates optional section counts across same-type pages.
 */
function computeSectionCount(
  taxonomy: TaxonomyEntry,
  item: BacklogItem,
  typeIndex: number
): { sectionCount: number; rationale: string } {
  const requiredCount = taxonomy.required_sections.length;
  const availableOptional = taxonomy.optional_sections.length;

  // Determine extra optional sections (0-2)
  let extraSections: number;

  // Higher word count targets suggest more sections
  const wordTarget = taxonomy.target_word_count_max;
  if (wordTarget >= 1500) {
    extraSections = 2;
  } else if (wordTarget >= 1000) {
    extraSections = 1;
  } else {
    extraSections = 0;
  }

  // Alternate for variation: odd-indexed pages of same type get different count
  if (typeIndex % 2 === 1 && extraSections > 0) {
    extraSections = Math.max(0, extraSections - 1);
  }

  // Cap at available optional sections
  extraSections = Math.min(extraSections, availableOptional);

  // Improve/rewrite actions may need more depth
  if (item.action === 'improve' || item.action === 'rewrite') {
    extraSections = Math.min(extraSections + 1, availableOptional);
  }

  const sectionCount = requiredCount + extraSections;
  const rationale =
    `${requiredCount} required sections for ${item.page_type} + ` +
    `${extraSections} optional (word target: ${taxonomy.target_word_count_min}-${wordTarget}, ` +
    `action: ${item.action}, variation index: ${typeIndex})`;

  return { sectionCount, rationale };
}

/**
 * Infer target keywords from backlog item and taxonomy.
 */
function inferKeywords(item: BacklogItem, taxonomy: TaxonomyEntry): string[] {
  const keywords: string[] = [];

  // Primary keyword from taxonomy pattern
  if (taxonomy.primary_keyword_pattern) {
    keywords.push(taxonomy.primary_keyword_pattern);
  }

  // Page type as keyword context
  if (item.page_type === 'homepage') {
    keywords.push('driving school', 'driving lessons', 'learn to drive');
  } else if (item.page_type === 'service') {
    keywords.push('driving lessons', 'driving course', 'learn to drive');
  } else if (item.page_type === 'location') {
    keywords.push('driving lessons', 'driving school', 'learn to drive');
  } else if (item.page_type === 'about') {
    keywords.push('about', 'driving instructor', 'driving school');
  } else if (item.page_type === 'faq') {
    keywords.push('FAQ', 'frequently asked questions', 'driving lessons');
  } else if (item.page_type === 'contact') {
    keywords.push('contact', 'book driving lesson', 'driving school');
  }

  // Extract location hint from target URL if present
  if (item.target_url) {
    const urlParts = item.target_url
      .replace(/https?:\/\/[^/]+/, '')
      .split('/')
      .filter(Boolean);
    const lastSegment = urlParts[urlParts.length - 1];
    if (lastSegment) {
      const locationHint = lastSegment.replace(/-/g, ' ').replace(/\.(html|htm)$/, '');
      if (locationHint && !keywords.includes(locationHint)) {
        keywords.push(locationHint);
      }
    }
  }

  return keywords;
}

/**
 * Generate a working title for the page.
 */
function generateWorkingTitle(item: BacklogItem, taxonomy: TaxonomyEntry, siteName: string): string {
  const locationHint = extractLocationFromUrl(item.target_url);

  switch (item.page_type) {
    case 'homepage':
      return `${siteName} - Driving School Homepage`;
    case 'service':
      return `${extractServiceFromUrl(item.target_url) || 'Driving Lessons'} Service Page`;
    case 'location':
      return `Driving Lessons in ${locationHint || 'Area'} - Location Page`;
    case 'about':
      return `About ${siteName}`;
    case 'faq':
      return `Frequently Asked Questions - ${siteName}`;
    case 'contact':
      return `Contact ${siteName}`;
    default:
      return `${taxonomy.display_name} - ${siteName}`;
  }
}

/**
 * Generate H1 text following taxonomy h1_pattern.
 */
function generateH1(item: BacklogItem, taxonomy: TaxonomyEntry): string {
  if (!taxonomy.h1_pattern) {
    return taxonomy.display_name;
  }

  const locationHint = extractLocationFromUrl(item.target_url);
  const serviceHint = extractServiceFromUrl(item.target_url);

  let h1 = taxonomy.h1_pattern;
  h1 = h1.replace('[Suburb]', locationHint || '[Suburb]');
  h1 = h1.replace('[City/Region]', locationHint || '[City]');
  h1 = h1.replace('[Location]', locationHint || '[Location]');
  h1 = h1.replace('[Service Name]', serviceHint || 'Driving Lessons');
  h1 = h1.replace('[Brand Name]', '[Brand]');
  h1 = h1.replace('[Service]', serviceHint || 'Driving Lessons');

  return h1;
}

/**
 * Generate meta title following benchmark rules.
 * Under 60 chars, keyword-first, brand included.
 */
function generateMetaTitle(item: BacklogItem, taxonomy: TaxonomyEntry, siteName: string): string {
  const locationHint = extractLocationFromUrl(item.target_url);
  const serviceHint = extractServiceFromUrl(item.target_url);

  let title: string;

  switch (item.page_type) {
    case 'homepage':
      title = `${siteName} - Driving School | ${locationHint || 'Local Area'}`;
      break;
    case 'service':
      title = `${serviceHint || 'Driving Lessons'} in ${locationHint || 'Your Area'} | ${siteName}`;
      break;
    case 'location':
      title = `Driving Lessons ${locationHint || 'Local Area'} | ${siteName}`;
      break;
    case 'about':
      title = `About ${siteName} | Driving School`;
      break;
    case 'faq':
      title = `Driving FAQ | ${siteName}`;
      break;
    case 'contact':
      title = `Contact ${siteName} | Book a Lesson`;
      break;
    default:
      title = `${taxonomy.display_name} | ${siteName}`;
  }

  // Truncate to 60 chars
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }

  return title;
}

/**
 * Generate meta description (150-160 chars, CTA + USP + location).
 */
function generateMetaDescription(item: BacklogItem, taxonomy: TaxonomyEntry, siteName: string): string {
  const locationHint = extractLocationFromUrl(item.target_url);

  let desc: string;

  switch (item.page_type) {
    case 'homepage':
      desc = `${siteName} offers professional driving lessons in ${locationHint || 'your area'}. Learn to drive with experienced instructors. Book your lesson today!`;
      break;
    case 'service':
      desc = `${extractServiceFromUrl(item.target_url) || 'Driving lessons'} in ${locationHint || 'your area'} with ${siteName}. Expert instruction and high pass rates. Book today!`;
      break;
    case 'location':
      desc = `Driving lessons in ${locationHint || 'your suburb'} with ${siteName}. Local instructors who know your area. Book your first lesson today!`;
      break;
    case 'about':
      desc = `Meet ${siteName}, your trusted driving school. Experienced instructors, proven results. Learn more about our team and approach.`;
      break;
    case 'faq':
      desc = `Common questions about driving lessons with ${siteName}. Pricing, booking, lesson structure, and more answered here.`;
      break;
    case 'contact':
      desc = `Contact ${siteName} to book driving lessons. Call, email, or use our online form. We're here to help you get on the road.`;
      break;
    default:
      desc = `${taxonomy.display_name} at ${siteName}. Professional driving instruction. Learn more and book today.`;
  }

  // Enforce 150-160 char range
  if (desc.length > 160) {
    desc = desc.substring(0, 157) + '...';
  }

  return desc;
}

/**
 * Build page-level SEO rules for the given page type.
 */
function seoRulesForPageType(
  pageType: string,
  benchmarks: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const titleRules = benchmarks.get('seo:title_tag_rules') || {};
  const metaRules = benchmarks.get('seo:meta_description_rules') || {};
  const headingRules = benchmarks.get('seo:heading_hierarchy_rules') || {};
  const canonicalRules = benchmarks.get('seo:canonical_rules') || {};
  const eeatRules = benchmarks.get('seo:eeat_signals') || {};
  const contentRules = benchmarks.get('content:word_count_targets') || {};

  return {
    titleTag: {
      maxLength: 60,
      formula: (titleRules as Record<string, unknown>).formulas
        ? ((titleRules as Record<string, Record<string, string>>).formulas)[pageType] || null
        : null,
    },
    metaDescription: {
      minLength: 150,
      maxLength: 160,
    },
    headings: headingRules,
    canonical: canonicalRules,
    eeat: (eeatRules as Record<string, Record<string, unknown>>).requirements
      ? ((eeatRules as Record<string, Record<string, unknown>>).requirements)[pageType] || []
      : [],
    wordCount: (contentRules as Record<string, unknown>)[pageType] || null,
  };
}

/**
 * Build page-level GEO rules for the given page type.
 */
function geoRulesForPageType(
  pageType: string,
  benchmarks: Map<string, Record<string, unknown>>,
  taxonomy: TaxonomyEntry
): Record<string, unknown> {
  const directAnswer = benchmarks.get('geo:direct_answer_block') || {};
  const faqFormat = benchmarks.get('geo:faq_format') || {};
  const statsFreq = benchmarks.get('geo:statistics_frequency') || {};
  const freshness = benchmarks.get('geo:freshness_signals') || {};

  return {
    directAnswerBlock: directAnswer,
    faqFormat: faqFormat,
    statisticsFrequency: statsFreq,
    freshness: freshness,
    taxonomyGeoRequirements: taxonomy.geo_requirements,
  };
}

/**
 * Build voice rules from brand profile.
 */
function voiceRulesFromProfile(
  profile: BrandProfileRow | undefined
): Record<string, unknown> {
  if (!profile) {
    return {
      available: false,
      fallback: 'Use professional, friendly tone appropriate for driving school audience',
    };
  }

  return {
    available: true,
    voiceDescription: profile.voice_description,
    toneKeywords: profile.tone_keywords ? JSON.parse(profile.tone_keywords) : [],
    sentenceStyle: profile.sentence_style,
    recurringPhrases: profile.recurring_phrases ? JSON.parse(profile.recurring_phrases) : [],
    antiPatterns: profile.anti_patterns ? JSON.parse(profile.anti_patterns) : [],
    targetAudience: profile.target_audience,
    brandPersonality: profile.brand_personality,
  };
}

/**
 * Get required internal links for a page (from the link graph).
 * Required = hub-spoke, breadcrumb, navigation links.
 */
function getRequiredLinks(item: BacklogItem, linkRows: LinkRow[]): Array<{ url: string; type: string; section: string | null }> {
  const pageUrl = item.target_url;
  if (!pageUrl) return [];

  return linkRows
    .filter(
      (link) =>
        link.source_url === pageUrl &&
        ['hub-spoke', 'breadcrumb', 'navigation'].includes(link.link_type)
    )
    .map((link) => ({
      url: link.target_url,
      type: link.link_type,
      section: link.section,
    }));
}

/**
 * Get optional internal links for a page (from the link graph).
 * Optional = contextual, sibling, footer links.
 */
function getOptionalLinks(item: BacklogItem, linkRows: LinkRow[]): Array<{ url: string; type: string; section: string | null }> {
  const pageUrl = item.target_url;
  if (!pageUrl) return [];

  return linkRows
    .filter(
      (link) =>
        link.source_url === pageUrl &&
        ['contextual', 'sibling', 'footer', 'cta'].includes(link.link_type)
    )
    .map((link) => ({
      url: link.target_url,
      type: link.link_type,
      section: link.section,
    }));
}

/**
 * Build breadcrumb path for a page.
 */
function buildBreadcrumb(
  item: BacklogItem,
  taxonomy: TaxonomyEntry,
  siteName: string,
  siteUrl: string
): Array<{ label: string; url: string }> {
  const breadcrumb: Array<{ label: string; url: string }> = [
    { label: siteName, url: siteUrl || '/' },
  ];

  switch (item.page_type) {
    case 'homepage':
      // Homepage is root — no additional breadcrumbs
      break;
    case 'service':
      breadcrumb.push({
        label: extractServiceFromUrl(item.target_url) || 'Service',
        url: item.target_url || '#',
      });
      break;
    case 'location':
      breadcrumb.push({
        label: 'Locations',
        url: `${siteUrl}/locations`,
      });
      breadcrumb.push({
        label: extractLocationFromUrl(item.target_url) || 'Location',
        url: item.target_url || '#',
      });
      break;
    case 'about':
      breadcrumb.push({ label: 'About', url: item.target_url || `${siteUrl}/about` });
      break;
    case 'faq':
      breadcrumb.push({ label: 'FAQ', url: item.target_url || `${siteUrl}/faq` });
      break;
    case 'contact':
      breadcrumb.push({ label: 'Contact', url: item.target_url || `${siteUrl}/contact` });
      break;
    default:
      breadcrumb.push({
        label: taxonomy.display_name,
        url: item.target_url || '#',
      });
  }

  return breadcrumb;
}

// ── URL Parsing Helpers ─────────────────────────────────────────────────────

/**
 * Extract a location hint from a target URL's last path segment.
 * e.g., "/driving-lessons-melbourne" => "Melbourne"
 */
function extractLocationFromUrl(url: string | null): string | null {
  if (!url) return null;
  const path = url.replace(/https?:\/\/[^/]+/, '').replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;

  // Remove common prefixes
  const cleaned = last
    .replace(/^driving-lessons?-/i, '')
    .replace(/^lessons?-/i, '')
    .replace(/\.(html|htm)$/i, '')
    .replace(/-/g, ' ');

  if (!cleaned) return null;

  // Title-case
  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract a service hint from a target URL's last path segment.
 * e.g., "/automatic-driving-lessons" => "Automatic Driving Lessons"
 */
function extractServiceFromUrl(url: string | null): string | null {
  if (!url) return null;
  const path = url.replace(/https?:\/\/[^/]+/, '').replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;

  const cleaned = last
    .replace(/\.(html|htm)$/i, '')
    .replace(/-/g, ' ');

  if (!cleaned) return null;

  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
