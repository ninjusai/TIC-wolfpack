/**
 * Section Specification Generator (WRK-BCE2-029)
 *
 * For each page blueprint, generates section_specs with:
 * section_type, order, heading, word count targets, content requirements,
 * links, CTA config, direct answer/statistics flags, FAQ questions.
 *
 * Data sources:
 *   - page_blueprints (blueprint to spec)
 *   - page_taxonomy (section definitions per page type)
 *   - internal_link_graph (link assignments for the page)
 *   - anchor_text_bank (anchor text for link targets)
 *   - benchmark_standards (GEO benchmarks)
 *   - work_backlog (page type / target URL)
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SectionSpecResult {
  siteId: number;
  blueprintId: number;
  sectionsCreated: number;
  sections: Array<{ type: string; order: number; heading: string }>;
}

export interface BulkSectionSpecResult {
  blueprintsProcessed: number;
  totalSections: number;
}

interface BlueprintRow {
  id: number;
  backlog_id: number;
  site_id: number;
  target_keywords: string | null;
  working_title: string | null;
  h1_text: string | null;
  section_count: number | null;
  section_order: string | null;
  internal_links_required: string | null;
  internal_links_optional: string | null;
  canonical_url: string | null;
}

interface BacklogRow {
  id: number;
  page_type: string;
  target_url: string | null;
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
}

interface LinkRow {
  source_url: string;
  target_url: string;
  link_type: string;
  section: string | null;
}

interface AnchorRow {
  target_url: string;
  variant_type: string;
  anchor_text: string;
  usage_count: number;
}

interface SectionSpecRow {
  id: number;
  blueprint_id: number;
  section_type: string;
  section_order: number;
  heading_text: string | null;
  target_word_count_min: number | null;
  target_word_count_max: number | null;
  cta_required: number;
  cta_text: string | null;
  content_requirements: string | null;
  links_required: string | null;
  direct_answer_block_required: number;
  statistics_required: number;
  faq_questions: string | null;
  css_classes: string | null;
  design_pattern: string | null;
  status: string;
  generated_html: string | null;
  generation_attempt_count: number;
  last_feedback: string | null;
  created_at: string;
}

// ── Word Count Ranges ───────────────────────────────────────────────────────

const WORD_COUNT_RANGES: Record<string, { min: number; max: number }> = {
  hero: { min: 80, max: 150 },
  service_detail: { min: 150, max: 300 },
  local_intro: { min: 150, max: 300 },
  benefits: { min: 100, max: 200 },
  why_choose_us: { min: 100, max: 200 },
  why_local: { min: 100, max: 200 },
  process: { min: 150, max: 250 },
  faq: { min: 200, max: 400 },
  cta: { min: 30, max: 60 },
  services_overview: { min: 100, max: 200 },
  services_available: { min: 100, max: 200 },
  testimonials: { min: 100, max: 200 },
  nearby_areas: { min: 80, max: 150 },
  statistics: { min: 80, max: 150 },
};

const DEFAULT_WORD_COUNT = { min: 100, max: 200 };

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getBlueprint: db.prepare<[number]>(
    `SELECT id, backlog_id, site_id, target_keywords, working_title, h1_text,
            section_count, section_order, internal_links_required,
            internal_links_optional, canonical_url
     FROM page_blueprints
     WHERE id = ?`
  ),

  getBlueprintsBySite: db.prepare<[number]>(
    `SELECT id, backlog_id, site_id, target_keywords, working_title, h1_text,
            section_count, section_order, internal_links_required,
            internal_links_optional, canonical_url
     FROM page_blueprints
     WHERE site_id = ?`
  ),

  getBacklogItem: db.prepare<[number]>(
    `SELECT id, page_type, target_url
     FROM work_backlog
     WHERE id = ?`
  ),

  getTaxonomy: db.prepare(
    `SELECT page_type, hierarchy_level, display_name, h1_pattern,
            required_sections, optional_sections,
            target_word_count_min, target_word_count_max,
            primary_keyword_pattern
     FROM page_taxonomy`
  ),

  getLinkGraphForPage: db.prepare<[number, string]>(
    `SELECT source_url, target_url, link_type, section
     FROM internal_link_graph
     WHERE site_id = ? AND source_url = ?`
  ),

  getAnchorBank: db.prepare<[number]>(
    `SELECT target_url, variant_type, anchor_text, usage_count
     FROM anchor_text_bank
     WHERE site_id = ?`
  ),

  clearSectionSpecs: db.prepare<[number]>(
    `DELETE FROM section_specs WHERE blueprint_id = ?`
  ),

  insertSectionSpec: db.prepare(
    `INSERT INTO section_specs
       (blueprint_id, section_type, section_order, heading_text,
        target_word_count_min, target_word_count_max,
        cta_required, cta_text, content_requirements, links_required,
        direct_answer_block_required, statistics_required, faq_questions,
        css_classes, design_pattern, status, generated_html,
        generation_attempt_count, last_feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),

  updateBlueprintSectionOrder: db.prepare<[string, number]>(
    `UPDATE page_blueprints SET section_order = ? WHERE id = ?`
  ),

  getSectionSpecs: db.prepare<[number]>(
    `SELECT id, blueprint_id, section_type, section_order, heading_text,
            target_word_count_min, target_word_count_max,
            cta_required, cta_text, content_requirements, links_required,
            direct_answer_block_required, statistics_required, faq_questions,
            css_classes, design_pattern, status, generated_html,
            generation_attempt_count, last_feedback, created_at
     FROM section_specs
     WHERE blueprint_id = ?
     ORDER BY section_order ASC`
  ),
};

// ── Main Functions ──────────────────────────────────────────────────────────

/**
 * Generate section specs for a single blueprint.
 * Clears existing specs for this blueprint and regenerates (idempotent).
 */
export function generateSectionSpecs(blueprintId: number): SectionSpecResult {
  // 1. Load blueprint
  const blueprint = stmts.getBlueprint.get(blueprintId) as BlueprintRow | undefined;
  if (!blueprint) {
    throw new Error(`Blueprint ${blueprintId} not found`);
  }

  // 2. Load backlog item for page type
  const backlogItem = stmts.getBacklogItem.get(blueprint.backlog_id) as BacklogRow | undefined;
  if (!backlogItem) {
    throw new Error(`Backlog item ${blueprint.backlog_id} not found for blueprint ${blueprintId}`);
  }

  // 3. Load taxonomy
  const taxonomyMap = loadTaxonomyMap();
  const taxonomy = taxonomyMap.get(backlogItem.page_type);
  if (!taxonomy) {
    throw new Error(`No taxonomy for page_type="${backlogItem.page_type}"`);
  }

  // 4. Load link graph for this page
  const pageUrl = blueprint.canonical_url || backlogItem.target_url || '';
  const linkRows = pageUrl
    ? (stmts.getLinkGraphForPage.all(blueprint.site_id, pageUrl) as LinkRow[])
    : [];

  // 5. Load anchor bank for link targets
  const anchorRows = stmts.getAnchorBank.all(blueprint.site_id) as AnchorRow[];
  const anchorMap = buildAnchorMap(anchorRows);

  // 6. Determine section list
  const sectionList = buildSectionList(taxonomy, blueprint, backlogItem.page_type);

  // 7. Distribute links across sections
  const linkDistribution = distributeLinksSections(sectionList, linkRows, anchorMap);

  // 8. Build and insert section specs
  const keywords = blueprint.target_keywords ? JSON.parse(blueprint.target_keywords) as string[] : [];

  const result: SectionSpecResult = {
    siteId: blueprint.site_id,
    blueprintId,
    sectionsCreated: 0,
    sections: [],
  };

  const generate = db.transaction(() => {
    // Clear existing specs
    stmts.clearSectionSpecs.run(blueprintId);

    for (let i = 0; i < sectionList.length; i++) {
      const sectionType = sectionList[i];
      const wordCount = WORD_COUNT_RANGES[sectionType] || DEFAULT_WORD_COUNT;
      const heading = generateHeading(sectionType, backlogItem.page_type, keywords);
      const ctaRequired = sectionType === 'cta' || sectionType === 'hero' ? 1 : 0;
      const ctaText = generateCtaText(sectionType);
      const contentReqs = requirementsForSection(sectionType, backlogItem.page_type);
      const sectionLinks = linkDistribution.get(i) || [];
      const directAnswerRequired = sectionType === 'hero' ? 1 : 0;
      const statsRequired = sectionType === 'hero' || sectionType === 'local_intro' || sectionType === 'statistics' ? 1 : 0;
      const faqQuestions = sectionType === 'faq' ? generateFaqQuestions(backlogItem.page_type, keywords) : null;

      stmts.insertSectionSpec.run(
        blueprintId,
        sectionType,
        i,
        heading,
        wordCount.min,
        wordCount.max,
        ctaRequired,
        ctaText,
        JSON.stringify(contentReqs),
        JSON.stringify(sectionLinks),
        directAnswerRequired,
        statsRequired,
        faqQuestions ? JSON.stringify(faqQuestions) : null,
        null, // css_classes — WRK-030 fills this
        null, // design_pattern — WRK-030 fills this
        'pending',
        null, // generated_html
        0,    // generation_attempt_count
        null  // last_feedback
      );

      result.sections.push({ type: sectionType, order: i, heading });
      result.sectionsCreated++;
    }

    // Update blueprint's section_order
    const sectionOrder = JSON.stringify(sectionList);
    stmts.updateBlueprintSectionOrder.run(sectionOrder, blueprintId);
  });

  generate();
  return result;
}

/**
 * Generate section specs for ALL blueprints belonging to a site.
 * Ensures at least 2 distinct section orderings for same-type pages.
 */
export function generateAllSectionSpecs(siteId: number): BulkSectionSpecResult {
  const blueprints = stmts.getBlueprintsBySite.all(siteId) as BlueprintRow[];

  let totalSections = 0;

  for (const bp of blueprints) {
    const result = generateSectionSpecs(bp.id);
    totalSections += result.sectionsCreated;
  }

  return {
    blueprintsProcessed: blueprints.length,
    totalSections,
  };
}

/**
 * Retrieve existing section specs for a blueprint.
 */
export function getSectionSpecs(blueprintId: number): SectionSpecRow[] {
  return stmts.getSectionSpecs.all(blueprintId) as SectionSpecRow[];
}

// ── Section List Building ───────────────────────────────────────────────────

/**
 * Build the ordered list of section types for a blueprint.
 * Uses required + optional sections from taxonomy, capped by section_count.
 * Rotates optional sections for variation across same-type pages.
 */
function buildSectionList(
  taxonomy: TaxonomyEntry,
  blueprint: BlueprintRow,
  pageType: string
): string[] {
  const required = [...taxonomy.required_sections];
  const optional = [...taxonomy.optional_sections];
  const targetCount = blueprint.section_count || required.length;

  // Start with required sections
  const sections = [...required];

  // Add optional sections up to target count
  const optionalNeeded = Math.max(0, targetCount - required.length);

  // Use blueprint ID for deterministic rotation so same-type pages get different orderings
  const rotationOffset = blueprint.id % Math.max(optional.length, 1);
  const rotatedOptional = rotateArray(optional, rotationOffset);

  for (let i = 0; i < Math.min(optionalNeeded, rotatedOptional.length); i++) {
    sections.push(rotatedOptional[i]);
  }

  // Ensure sensible ordering: hero first, cta last
  return orderSections(sections);
}

/**
 * Order sections in a logical page flow.
 * hero always first, cta always last, everything else in a natural content order.
 */
function orderSections(sections: string[]): string[] {
  const ORDER_PRIORITY: Record<string, number> = {
    hero: 0,
    local_intro: 10,
    service_detail: 20,
    services_overview: 25,
    services_available: 25,
    benefits: 30,
    why_choose_us: 35,
    why_local: 35,
    process: 40,
    statistics: 45,
    testimonials: 50,
    nearby_areas: 60,
    faq: 70,
    cta: 100,
  };

  return [...sections].sort((a, b) => {
    const pa = ORDER_PRIORITY[a] ?? 50;
    const pb = ORDER_PRIORITY[b] ?? 50;
    return pa - pb;
  });
}

/**
 * Rotate an array by `offset` positions for variation.
 */
function rotateArray<T>(arr: T[], offset: number): T[] {
  if (arr.length === 0) return arr;
  const n = offset % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

// ── Heading Generation ──────────────────────────────────────────────────────

/**
 * Generate a section heading based on section type, page type, and keywords.
 */
function generateHeading(sectionType: string, pageType: string, keywords: string[]): string {
  const primaryKeyword = keywords[0] || '';
  const locationKeyword = keywords.find((k) => k !== primaryKeyword) || '';

  const headingTemplates: Record<string, Record<string, string>> = {
    hero: {
      homepage: `Professional Driving Lessons${locationKeyword ? ` in ${titleCase(locationKeyword)}` : ''}`,
      service: `${titleCase(primaryKeyword) || 'Our Driving Lessons'}`,
      location: `Driving Lessons in ${titleCase(locationKeyword || primaryKeyword) || 'Your Area'}`,
      about: `About Our Driving School`,
      faq: `Frequently Asked Questions`,
      contact: `Get in Touch`,
      default: `Welcome`,
    },
    service_detail: {
      service: `What's Included in ${titleCase(primaryKeyword) || 'Our Lessons'}`,
      default: `Service Details`,
    },
    local_intro: {
      location: `About ${titleCase(locationKeyword || primaryKeyword) || 'Our Area'}`,
      default: `Local Information`,
    },
    benefits: {
      default: `Why Choose Our Lessons`,
    },
    why_choose_us: {
      default: `Why Choose Us`,
    },
    why_local: {
      location: `Why Learn to Drive in ${titleCase(locationKeyword || primaryKeyword) || 'This Area'}`,
      default: `Why Choose a Local Instructor`,
    },
    process: {
      default: `How It Works`,
    },
    faq: {
      default: `Common Questions About ${titleCase(primaryKeyword) || 'Driving Lessons'}`,
    },
    cta: {
      default: `Book Your Lesson Today`,
    },
    services_overview: {
      default: `Our Services`,
    },
    services_available: {
      location: `Driving Services in ${titleCase(locationKeyword || primaryKeyword) || 'Your Area'}`,
      default: `Available Services`,
    },
    testimonials: {
      location: `What Our ${titleCase(locationKeyword || primaryKeyword) || 'Local'} Students Say`,
      default: `What Our Students Say`,
    },
    nearby_areas: {
      default: `Nearby Areas We Cover`,
    },
    statistics: {
      default: `Our Results in Numbers`,
    },
  };

  const templates = headingTemplates[sectionType];
  if (!templates) return titleCase(sectionType.replace(/_/g, ' '));

  return templates[pageType] || templates['default'] || titleCase(sectionType.replace(/_/g, ' '));
}

// ── CTA Text Generation ─────────────────────────────────────────────────────

function generateCtaText(sectionType: string): string | null {
  switch (sectionType) {
    case 'hero':
      return 'Book Your First Lesson';
    case 'cta':
      return 'Get Started Today';
    default:
      return null;
  }
}

// ── Content Requirements ────────────────────────────────────────────────────

/**
 * Build content requirements for a given section type and page type.
 */
function requirementsForSection(
  sectionType: string,
  pageType: string
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    tone: 'professional, friendly, trustworthy',
    readability: 'Grade 8-10 reading level',
    uniqueness: 'Must not duplicate content from other sections',
  };

  switch (sectionType) {
    case 'hero':
      return {
        ...base,
        purpose: 'Immediately communicate value proposition and location relevance',
        mustInclude: ['primary keyword in first sentence', 'location name if applicable', 'clear CTA'],
        directAnswer: 'Include a concise direct-answer paragraph for AI engine extraction',
        formatting: 'Short paragraphs, strong opening statement',
      };
    case 'service_detail':
      return {
        ...base,
        purpose: 'Detailed description of the service offering',
        mustInclude: ['lesson structure', 'what students learn', 'duration/pricing hints'],
        formatting: 'Can use bullet lists or numbered steps',
      };
    case 'local_intro':
      return {
        ...base,
        purpose: 'Establish local relevance and geographic authority',
        mustInclude: ['suburb/area name', 'local landmarks or roads', 'statistics about the area'],
        formatting: 'Narrative style with local details woven in',
      };
    case 'benefits':
    case 'why_choose_us':
      return {
        ...base,
        purpose: 'Differentiate from competitors with concrete benefits',
        mustInclude: ['pass rate or success metric', 'instructor qualifications', 'unique selling points'],
        formatting: 'Bullet points or short benefit blocks',
      };
    case 'why_local':
      return {
        ...base,
        purpose: 'Explain advantages of learning to drive in this specific area',
        mustInclude: ['local road types', 'test route familiarity', 'area-specific advantages'],
        formatting: 'Mix of paragraphs and lists',
      };
    case 'process':
      return {
        ...base,
        purpose: 'Walk the reader through the booking/lesson process',
        mustInclude: ['numbered steps', 'booking method', 'what to expect'],
        formatting: 'Numbered steps (3-5 steps)',
      };
    case 'faq':
      return {
        ...base,
        purpose: 'Answer common questions in FAQ schema format',
        mustInclude: ['question-answer pairs', 'schema-ready markup hints'],
        formatting: 'Q&A format, each answer 40-80 words',
      };
    case 'cta':
      return {
        ...base,
        purpose: 'Drive conversion with a strong call-to-action',
        mustInclude: ['phone number placeholder', 'booking link placeholder', 'urgency or benefit reminder'],
        formatting: 'Short and punchy, single paragraph with button',
      };
    case 'services_overview':
    case 'services_available':
      return {
        ...base,
        purpose: 'List available services with brief descriptions',
        mustInclude: ['service names', 'brief 1-line descriptions', 'links to detail pages'],
        formatting: 'Card-style or list layout',
      };
    case 'testimonials':
      return {
        ...base,
        purpose: 'Social proof from past students',
        mustInclude: ['student name placeholder', 'location reference', 'specific outcome mentioned'],
        formatting: 'Quote blocks with attribution',
      };
    case 'nearby_areas':
      return {
        ...base,
        purpose: 'Link to sibling location pages for geographic coverage',
        mustInclude: ['nearby suburb names', 'links to those location pages'],
        formatting: 'List or grid of linked area names',
      };
    case 'statistics':
      return {
        ...base,
        purpose: 'Present key metrics for credibility',
        mustInclude: ['pass rate', 'years of experience', 'number of students'],
        formatting: 'Stat blocks with numbers prominently displayed',
      };
    default:
      return {
        ...base,
        purpose: `Content section: ${sectionType}`,
        formatting: 'Paragraphs with subheadings as needed',
      };
  }
}

// ── Link Distribution ───────────────────────────────────────────────────────

interface SectionLink {
  targetUrl: string;
  anchorText: string | null;
  anchorVariant: string | null;
  linkType: string;
}

/**
 * Build a map of target_url -> anchor texts from anchor bank rows.
 */
function buildAnchorMap(anchorRows: AnchorRow[]): Map<string, AnchorRow[]> {
  const map = new Map<string, AnchorRow[]>();
  for (const row of anchorRows) {
    const existing = map.get(row.target_url) || [];
    existing.push(row);
    map.set(row.target_url, existing);
  }
  return map;
}

/**
 * Pick the best anchor text for a target URL.
 * Prefers 'natural' and 'partial' variants, then falls back to others.
 * Picks the one with the lowest usage_count to maintain variety.
 */
function pickAnchor(
  targetUrl: string,
  anchorMap: Map<string, AnchorRow[]>
): { text: string; variant: string } | null {
  const anchors = anchorMap.get(targetUrl);
  if (!anchors || anchors.length === 0) return null;

  // Prefer natural > partial > branded > exact > localized > generic
  const preferenceOrder = ['natural', 'partial', 'branded', 'exact', 'localized', 'generic'];

  // Sort by preference then by lowest usage
  const sorted = [...anchors].sort((a, b) => {
    const pa = preferenceOrder.indexOf(a.variant_type);
    const pb = preferenceOrder.indexOf(b.variant_type);
    const prefA = pa === -1 ? 99 : pa;
    const prefB = pb === -1 ? 99 : pb;
    if (prefA !== prefB) return prefA - prefB;
    return a.usage_count - b.usage_count;
  });

  return { text: sorted[0].anchor_text, variant: sorted[0].variant_type };
}

/**
 * Distribute internal links across sections.
 * Returns a map of sectionIndex -> links for that section.
 *
 * Rules:
 * - Each content section gets 1-2 internal links max
 * - Hero: 0-1 links (CTA link)
 * - FAQ: 0-1 links in answers
 * - nearby_areas: gets sibling location links
 */
function distributeLinksSections(
  sectionList: string[],
  linkRows: LinkRow[],
  anchorMap: Map<string, AnchorRow[]>
): Map<number, SectionLink[]> {
  const distribution = new Map<number, SectionLink[]>();

  // Initialize all sections
  for (let i = 0; i < sectionList.length; i++) {
    distribution.set(i, []);
  }

  // Categorize links
  const ctaLinks = linkRows.filter((l) => l.link_type === 'cta');
  const siblingLinks = linkRows.filter((l) => l.link_type === 'sibling');
  const contextualLinks = linkRows.filter((l) => l.link_type === 'contextual');
  const hubSpokeLinks = linkRows.filter((l) => l.link_type === 'hub-spoke');
  // Navigation, breadcrumb, footer links are structural — not placed in section content
  const contentLinks = [...hubSpokeLinks, ...contextualLinks];

  // 1. Hero section: 0-1 CTA links
  const heroIdx = sectionList.indexOf('hero');
  if (heroIdx !== -1 && ctaLinks.length > 0) {
    const link = ctaLinks[0];
    const anchor = pickAnchor(link.target_url, anchorMap);
    distribution.get(heroIdx)!.push({
      targetUrl: link.target_url,
      anchorText: anchor?.text || null,
      anchorVariant: anchor?.variant || null,
      linkType: link.link_type,
    });
  }

  // 2. Nearby_areas section: gets sibling links
  const nearbyIdx = sectionList.indexOf('nearby_areas');
  if (nearbyIdx !== -1) {
    for (const link of siblingLinks) {
      const anchor = pickAnchor(link.target_url, anchorMap);
      distribution.get(nearbyIdx)!.push({
        targetUrl: link.target_url,
        anchorText: anchor?.text || null,
        anchorVariant: anchor?.variant || null,
        linkType: link.link_type,
      });
    }
  }

  // 3. FAQ section: 0-1 contextual links
  const faqIdx = sectionList.indexOf('faq');
  if (faqIdx !== -1 && contentLinks.length > 0) {
    const link = contentLinks.shift()!;
    const anchor = pickAnchor(link.target_url, anchorMap);
    distribution.get(faqIdx)!.push({
      targetUrl: link.target_url,
      anchorText: anchor?.text || null,
      anchorVariant: anchor?.variant || null,
      linkType: link.link_type,
    });
  }

  // 4. Distribute remaining content links across other content sections (1-2 per section)
  const contentSectionIndices = sectionList
    .map((type, idx) => ({ type, idx }))
    .filter(
      ({ type, idx }) =>
        type !== 'hero' &&
        type !== 'nearby_areas' &&
        type !== 'faq' &&
        type !== 'cta'
    )
    .map(({ idx }) => idx);

  let linkIdx = 0;
  for (const sIdx of contentSectionIndices) {
    const maxLinksPerSection = 2;
    let added = 0;
    while (added < maxLinksPerSection && linkIdx < contentLinks.length) {
      const link = contentLinks[linkIdx];
      linkIdx++;
      const anchor = pickAnchor(link.target_url, anchorMap);
      distribution.get(sIdx)!.push({
        targetUrl: link.target_url,
        anchorText: anchor?.text || null,
        anchorVariant: anchor?.variant || null,
        linkType: link.link_type,
      });
      added++;
    }
  }

  return distribution;
}

// ── FAQ Question Generation ─────────────────────────────────────────────────

/**
 * Generate 3-5 FAQ questions appropriate for the page type.
 */
function generateFaqQuestions(
  pageType: string,
  keywords: string[]
): string[] {
  const primaryKeyword = keywords[0] || 'driving lessons';
  const locationKeyword = keywords.find((k) => k !== primaryKeyword) || '';

  const baseQuestions: Record<string, string[]> = {
    homepage: [
      'How much do driving lessons cost?',
      'How do I book my first lesson?',
      'How many lessons will I need before my test?',
      'What areas do you cover?',
      'Do you offer automatic and manual lessons?',
    ],
    service: [
      `What is included in ${primaryKeyword}?`,
      `How long does each ${primaryKeyword} session last?`,
      `How much do ${primaryKeyword} cost?`,
      `Who is ${primaryKeyword} suitable for?`,
      `How do I book ${primaryKeyword}?`,
    ],
    location: [
      `Where do you offer driving lessons in ${titleCase(locationKeyword) || 'this area'}?`,
      `How much are driving lessons in ${titleCase(locationKeyword) || 'this area'}?`,
      `What test routes are used near ${titleCase(locationKeyword) || 'here'}?`,
      `Do you pick up from my home in ${titleCase(locationKeyword) || 'the area'}?`,
      `How many lessons do I need to pass in ${titleCase(locationKeyword) || 'this area'}?`,
    ],
    about: [
      'How long have you been teaching?',
      'What qualifications do your instructors have?',
      'What is your pass rate?',
      'Do you offer a satisfaction guarantee?',
    ],
    faq: [
      'How much do driving lessons cost?',
      'How many lessons will I need?',
      'Can I use my own car for lessons?',
      'What happens if I need to cancel a lesson?',
      'Do you help with test booking?',
    ],
    contact: [
      'What are your operating hours?',
      'How quickly can I get a lesson?',
      'Can I book lessons online?',
    ],
  };

  const questions = baseQuestions[pageType] || baseQuestions['homepage']!;

  // Return 3-5 questions
  return questions.slice(0, Math.min(questions.length, 5));
}

// ── Utility ─────────────────────────────────────────────────────────────────

/**
 * Load taxonomy into a map, parsing JSON fields.
 */
function loadTaxonomyMap(): Map<string, TaxonomyEntry> {
  const rows = stmts.getTaxonomy.all() as Array<{
    page_type: string;
    hierarchy_level: number;
    display_name: string;
    h1_pattern: string | null;
    required_sections: string;
    optional_sections: string;
    target_word_count_min: number;
    target_word_count_max: number;
    primary_keyword_pattern: string | null;
  }>;

  const map = new Map<string, TaxonomyEntry>();
  for (const row of rows) {
    map.set(row.page_type, {
      ...row,
      required_sections: JSON.parse(row.required_sections),
      optional_sections: JSON.parse(row.optional_sections),
    });
  }
  return map;
}

/**
 * Title-case a string.
 */
function titleCase(str: string): string {
  if (!str) return '';
  return str
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
