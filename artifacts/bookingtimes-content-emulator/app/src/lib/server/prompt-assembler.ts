/**
 * 12-Layer Context Prompt Assembler (WRK-BCE2-034)
 *
 * Constructs per-section Claude CLI prompts from 12 context layers.
 * Each section generation call receives a single assembled prompt string
 * built from: platform constraints, brand profile, brand rules, section spec,
 * SEO context, internal links, GEO requirements, CSS palette, previously
 * generated sections, approved examples, location data, and output format.
 *
 * Data sources:
 *   - section_specs (the target section)
 *   - page_blueprints (page-level context)
 *   - work_backlog (page type)
 *   - sites (site info)
 *   - brand_profiles (voice/tone)
 *   - brand_rules (filtered by scope)
 *   - brand_examples (few-shot examples)
 *   - css_audit (Tier 2 classes)
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AssembledPrompt {
  prompt: string;
  layerSizes: Record<string, number>;
  totalEstimatedTokens: number;
  metadata: {
    siteId: number;
    blueprintId: number;
    sectionSpecId: number;
    sectionType: string;
    sectionOrder: number;
  };
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
  internal_links_required: string | null;
  internal_links_optional: string | null;
  section_order: string | null;
}

interface BacklogRow {
  id: number;
  page_type: string;
  target_url: string | null;
}

interface BrandProfileRow {
  voice_description: string | null;
  tone_keywords: string | null;
  sentence_style: string | null;
  recurring_phrases: string | null;
  anti_patterns: string | null;
  target_audience: string | null;
  brand_personality: string | null;
}

interface BrandRuleRow {
  id: number;
  category: string;
  rule_text: string;
  priority: number;
  scope: string;
  page_type: string | null;
  section_type: string | null;
}

interface BrandExampleRow {
  id: number;
  section_type: string | null;
  html_content: string;
  quality_rating: number | null;
  is_negative: number;
  notes: string | null;
}

interface CssAuditRow {
  class_name: string;
  tier: number;
  notes: string | null;
}

interface PreviousSectionRow {
  section_type: string;
  section_order: number;
  heading_text: string | null;
  generated_html: string;
}

interface SiteRow {
  id: number;
  name: string;
  url: string;
}

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getSectionSpec: db.prepare<[number]>(
    `SELECT id, blueprint_id, section_type, section_order, heading_text,
            target_word_count_min, target_word_count_max,
            cta_required, cta_text, content_requirements, links_required,
            direct_answer_block_required, statistics_required, faq_questions,
            css_classes, design_pattern, status, generated_html
     FROM section_specs
     WHERE id = ?`
  ),

  getBlueprint: db.prepare<[number]>(
    `SELECT id, backlog_id, site_id, target_keywords, working_title,
            h1_text, meta_title, meta_description, canonical_url,
            page_level_seo_rules, page_level_geo_rules,
            page_level_voice_rules, page_level_css_rules,
            section_count, internal_links_required, internal_links_optional,
            section_order
     FROM page_blueprints
     WHERE id = ?`
  ),

  getBacklog: db.prepare<[number]>(
    `SELECT id, page_type, target_url
     FROM work_backlog
     WHERE id = ?`
  ),

  getSite: db.prepare<[number]>(
    `SELECT id, name, url FROM sites WHERE id = ?`
  ),

  getBrandProfile: db.prepare<[number]>(
    `SELECT voice_description, tone_keywords, sentence_style,
            recurring_phrases, anti_patterns, target_audience, brand_personality
     FROM brand_profiles
     WHERE site_id = ?`
  ),

  getBrandRules: db.prepare<[number]>(
    `SELECT id, category, rule_text, priority, scope, page_type, section_type
     FROM brand_rules
     WHERE (site_id = ? OR site_id IS NULL)
       AND active = 1
     ORDER BY priority DESC`
  ),

  getPreviousSections: db.prepare<[number, number]>(
    `SELECT section_type, section_order, heading_text, generated_html
     FROM section_specs
     WHERE blueprint_id = ?
       AND section_order < ?
       AND status IN ('generated', 'approved')
     ORDER BY section_order ASC`
  ),

  getBrandExamples: db.prepare<[number, string]>(
    `SELECT id, section_type, html_content, quality_rating, is_negative, notes
     FROM brand_examples
     WHERE site_id = ?
       AND section_type = ?
       AND is_negative = 0
     ORDER BY quality_rating DESC`
  ),

  getCssAudit: db.prepare<[number]>(
    `SELECT class_name, tier, notes
     FROM css_audit
     WHERE site_id = ?
       AND tier = 2
     ORDER BY class_name`
  ),
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Rough token estimate: 1 token ≈ 4 characters. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Safely parse a JSON string field, returning null on failure. */
function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Truncate HTML content to stay within a character budget.
 * Tries to break at a closing tag boundary.
 */
function truncateHtml(html: string, maxChars: number): string {
  if (html.length <= maxChars) return html;
  const truncated = html.slice(0, maxChars);
  const lastClose = truncated.lastIndexOf('>');
  if (lastClose > maxChars * 0.5) {
    return truncated.slice(0, lastClose + 1) + '\n<!-- [truncated for context budget] -->';
  }
  return truncated + '\n<!-- [truncated for context budget] -->';
}

// ── Layer Builders ──────────────────────────────────────────────────────────

function buildLayer1(hasSidebar: boolean): string {
  const lines = [
    '=== PLATFORM CONSTRAINTS ===',
    'You are generating HTML content for a BookingTimes website. Rules:',
    '- Output ONLY body-level HTML (no <html>, <head>, <body>, <meta>, <title> tags)',
    '- Use ONLY the CSS classes provided in the palette below',
    '- Do NOT use bare CSS selectors or inline styles',
    '- Do NOT use <script> tags unless specifically instructed',
    '- All content must be inside semantic HTML elements',
  ];
  if (hasSidebar) {
    lines.push('- Content area is constrained to ~75% width; a sidebar exists on the right');
  }
  return lines.join('\n');
}

function buildLayer2(brand: BrandProfileRow): string {
  const lines = ['=== BRAND VOICE ==='];
  if (brand.voice_description)  lines.push(`Description: ${brand.voice_description}`);
  if (brand.tone_keywords)      lines.push(`Tone: ${brand.tone_keywords}`);
  if (brand.sentence_style)     lines.push(`Style: ${brand.sentence_style}`);
  if (brand.recurring_phrases)  lines.push(`Key phrases to use: ${brand.recurring_phrases}`);
  if (brand.anti_patterns)      lines.push(`Patterns to AVOID: ${brand.anti_patterns}`);
  if (brand.target_audience)    lines.push(`Target audience: ${brand.target_audience}`);
  return lines.join('\n');
}

function buildLayer3(
  rules: BrandRuleRow[],
  pageType: string,
  sectionType: string
): string {
  // Filter rules by applicable scope
  const applicable = rules.filter((r) => {
    if (r.scope === 'global') return true;
    if (r.scope === 'brand') return true;
    if (r.scope === 'page_type' && r.page_type === pageType) return true;
    if (r.scope === 'section_type' && r.section_type === sectionType) return true;
    return false;
  });

  if (applicable.length === 0) return '';

  const lines = ['=== BRAND RULES ==='];
  applicable.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.category}] ${r.rule_text}`);
  });
  return lines.join('\n');
}

function buildLayer4(spec: SectionSpecRow): string {
  const lines = [
    '=== SECTION SPECIFICATION ===',
    `Generate a ${spec.section_type} section:`,
  ];
  if (spec.heading_text) lines.push(`- Heading: ${spec.heading_text}`);
  if (spec.target_word_count_min && spec.target_word_count_max) {
    lines.push(`- Word count: ${spec.target_word_count_min}-${spec.target_word_count_max} words`);
  }
  if (spec.cta_required) {
    lines.push(`- CTA required: yes${spec.cta_text ? ` — "${spec.cta_text}"` : ''}`);
  }
  if (spec.content_requirements) {
    lines.push(`- Content requirements: ${spec.content_requirements}`);
  }
  return lines.join('\n');
}

function buildLayer5(
  blueprint: BlueprintRow,
  spec: SectionSpecRow
): string {
  const seoRules = safeParseJson<Record<string, unknown>>(blueprint.page_level_seo_rules);
  const lines = ['=== SEO CONTEXT ==='];
  if (blueprint.target_keywords) lines.push(`Target keywords: ${blueprint.target_keywords}`);
  if (blueprint.meta_title)      lines.push(`Meta title: ${blueprint.meta_title}`);
  if (seoRules) {
    for (const [key, val] of Object.entries(seoRules)) {
      lines.push(`- ${key}: ${val}`);
    }
  }
  lines.push(`This is section ${spec.section_order} of ${blueprint.section_count ?? '?'} sections`);
  return lines.join('\n');
}

function buildLayer6(spec: SectionSpecRow): string {
  const links = safeParseJson<Array<{ url: string; anchor_text: string }>>(spec.links_required);
  if (!links || links.length === 0) return '';

  const lines = ['=== INTERNAL LINKS ===', 'Include these internal links in the content:'];
  for (const link of links) {
    lines.push(`- Link to ${link.url} with anchor text "${link.anchor_text}"`);
  }
  return lines.join('\n');
}

function buildLayer7(
  blueprint: BlueprintRow,
  spec: SectionSpecRow
): string {
  const geoRules = safeParseJson<Record<string, unknown>>(blueprint.page_level_geo_rules);
  const lines = ['=== GEO REQUIREMENTS ==='];
  let hasContent = false;

  if (spec.direct_answer_block_required) {
    lines.push(`- Direct answer block required: yes`);
    hasContent = true;
  }
  if (spec.statistics_required) {
    lines.push(`- Statistics required: yes (include specific data point every 200 words)`);
    hasContent = true;
  }
  if (spec.faq_questions) {
    const questions = safeParseJson<string[]>(spec.faq_questions);
    if (questions && questions.length > 0) {
      lines.push('- FAQ questions:');
      questions.forEach((q) => lines.push(`  - ${q}`));
      hasContent = true;
    }
  }
  if (geoRules) {
    for (const [key, val] of Object.entries(geoRules)) {
      lines.push(`- ${key}: ${val}`);
      hasContent = true;
    }
  }

  return hasContent ? lines.join('\n') : '';
}

function buildLayer8(
  spec: SectionSpecRow,
  tier2Classes: CssAuditRow[]
): string {
  const specClasses = safeParseJson<string[]>(spec.css_classes) ?? [];
  const tier2Names = tier2Classes.map((c) => c.class_name);

  const lines = ['=== CSS CLASS PALETTE ===', 'Available CSS classes for this section:'];

  // Categorize classes from the spec
  const layout: string[] = [];
  const typography: string[] = [];
  const components: string[] = [];
  const other: string[] = [];

  for (const cls of specClasses) {
    if (/^(container|row|col|d-|flex|justify|align|g-|gap|m[tblrxy]?-|p[tblrxy]?-|w-|h-)/.test(cls)) {
      layout.push(cls);
    } else if (/^(fs-|fw-|text-|font-|lh-|display-|lead|h[1-6])/.test(cls)) {
      typography.push(cls);
    } else if (/^(btn|card|badge|alert|nav|list|accordion|carousel|modal|table|form)/.test(cls)) {
      components.push(cls);
    } else {
      other.push(cls);
    }
  }

  if (layout.length)     lines.push(`- Layout: ${layout.join(', ')}`);
  if (typography.length)  lines.push(`- Typography: ${typography.join(', ')}`);
  if (components.length)  lines.push(`- Components: ${components.join(', ')}`);
  if (other.length)       lines.push(`- Other: ${other.join(', ')}`);

  // Add Tier 2 (site-specific) classes if available
  if (tier2Names.length > 0) {
    lines.push(`- Site-specific (Tier 2): ${tier2Names.join(', ')}`);
  }

  if (spec.design_pattern) {
    lines.push(`- Design pattern: ${spec.design_pattern}`);
  }

  lines.push('Do NOT use any class not listed here.');
  return lines.join('\n');
}

function buildLayer9(previousSections: PreviousSectionRow[]): string {
  if (previousSections.length === 0) return '';

  const MAX_PREVIOUS_CHARS = 12000; // ~3000 tokens budget
  let totalChars = 0;
  const includedSections: string[] = [];

  for (const sec of previousSections) {
    if (!sec.generated_html) continue;
    const remaining = MAX_PREVIOUS_CHARS - totalChars;
    if (remaining <= 200) break; // stop if almost no budget left

    const html = truncateHtml(sec.generated_html, remaining);
    includedSections.push(
      `<!-- Section ${sec.section_order}: ${sec.section_type} -->\n${html}`
    );
    totalChars += html.length;
  }

  if (includedSections.length === 0) return '';

  const lines = [
    '=== PREVIOUSLY GENERATED SECTIONS ===',
    'Previously generated sections on this page (for continuity):',
    '---',
    includedSections.join('\n---\n'),
    '---',
    'Maintain consistent voice and smooth transitions from the previous sections.',
  ];
  return lines.join('\n');
}

function buildLayer10(examples: BrandExampleRow[], sectionType: string): string {
  if (examples.length === 0) return '';

  const MAX_EXAMPLE_CHARS = 8000; // ~2000 tokens budget
  let totalChars = 0;
  const included: string[] = [];

  for (const ex of examples) {
    const remaining = MAX_EXAMPLE_CHARS - totalChars;
    if (remaining <= 200) break;

    const html = truncateHtml(ex.html_content, remaining);
    included.push(html);
    totalChars += html.length;
  }

  if (included.length === 0) return '';

  const lines = [
    `=== APPROVED EXAMPLES ===`,
    `Examples of approved ${sectionType} sections:`,
    '---',
    included.join('\n---\n'),
    '---',
    'Follow the patterns in these approved examples.',
  ];
  return lines.join('\n');
}

function buildLayer11(
  blueprint: BlueprintRow,
  backlog: BacklogRow
): string {
  // Location pages have page_type containing 'suburb' or 'location'
  const pageType = backlog.page_type?.toLowerCase() ?? '';
  const isLocation = pageType.includes('suburb') || pageType.includes('location');
  if (!isLocation) return '';

  // Extract suburb info from the blueprint or working title
  const voiceRules = safeParseJson<Record<string, unknown>>(blueprint.page_level_voice_rules);
  const suburbName = (voiceRules?.suburb_name as string)
    ?? blueprint.working_title
    ?? backlog.target_url
    ?? '';

  if (!suburbName) return '';

  const lines = [
    '=== LOCATION CONTEXT ===',
    `Suburb: ${suburbName}`,
    '- Include local details specific to this area',
    '- Mention nearby landmarks, roads, or local knowledge where natural',
  ];
  return lines.join('\n');
}

function buildLayer12(): string {
  return [
    '=== OUTPUT FORMAT ===',
    'Output ONLY the HTML for this section. Do not include any explanation, markdown, or code fences.',
    'Start directly with the HTML element (e.g., <section>, <div>).',
    'End with the closing tag. Nothing else.',
  ].join('\n');
}

// ── Main Assembly Function ──────────────────────────────────────────────────

/**
 * Assemble the full prompt for a single section generation call.
 * Queries multiple tables and concatenates 12 context layers.
 */
export function assembleSectionPrompt(sectionSpecId: number): AssembledPrompt {
  // ── Fetch core data ─────────────────────────────────────────────────────
  const spec = stmts.getSectionSpec.get(sectionSpecId) as SectionSpecRow | undefined;
  if (!spec) {
    throw new Error(`Section spec not found: ${sectionSpecId}`);
  }

  const blueprint = stmts.getBlueprint.get(spec.blueprint_id) as BlueprintRow | undefined;
  if (!blueprint) {
    throw new Error(`Blueprint not found: ${spec.blueprint_id}`);
  }

  const backlog = stmts.getBacklog.get(blueprint.backlog_id) as BacklogRow | undefined;
  if (!backlog) {
    throw new Error(`Backlog item not found: ${blueprint.backlog_id}`);
  }

  const site = stmts.getSite.get(blueprint.site_id) as SiteRow | undefined;
  if (!site) {
    throw new Error(`Site not found: ${blueprint.site_id}`);
  }

  // ── Fetch brand data (optional — skip layers 2+3 if missing) ───────────
  const brandProfile = stmts.getBrandProfile.get(blueprint.site_id) as BrandProfileRow | undefined;
  const brandRules = stmts.getBrandRules.all(blueprint.site_id) as BrandRuleRow[];

  // ── Fetch supporting data ───────────────────────────────────────────────
  const previousSections = stmts.getPreviousSections.all(
    spec.blueprint_id,
    spec.section_order
  ) as PreviousSectionRow[];

  const brandExamples = stmts.getBrandExamples.all(
    blueprint.site_id,
    spec.section_type
  ) as BrandExampleRow[];

  const tier2Classes = stmts.getCssAudit.all(blueprint.site_id) as CssAuditRow[];

  // ── Determine sidebar presence from page CSS rules ──────────────────────
  const cssRules = safeParseJson<Record<string, unknown>>(blueprint.page_level_css_rules);
  const hasSidebar = !!(cssRules?.sidebar || cssRules?.has_sidebar);

  // ── Assemble layers ─────────────────────────────────────────────────────
  const layers: Record<string, string> = {};

  layers['1_platform_constraints'] = buildLayer1(hasSidebar);

  if (brandProfile) {
    layers['2_brand_profile'] = buildLayer2(brandProfile);
  } else {
    console.warn(`[prompt-assembler] No brand profile for site ${blueprint.site_id} — skipping layers 2 & 3`);
  }

  if (brandProfile && brandRules.length > 0) {
    const layer3 = buildLayer3(brandRules, backlog.page_type, spec.section_type);
    if (layer3) layers['3_brand_rules'] = layer3;
  }

  layers['4_section_spec'] = buildLayer4(spec);
  layers['5_seo_context'] = buildLayer5(blueprint, spec);

  const layer6 = buildLayer6(spec);
  if (layer6) layers['6_internal_links'] = layer6;

  const layer7 = buildLayer7(blueprint, spec);
  if (layer7) layers['7_geo_requirements'] = layer7;

  layers['8_css_palette'] = buildLayer8(spec, tier2Classes);

  const layer9 = buildLayer9(previousSections);
  if (layer9) layers['9_previous_sections'] = layer9;

  const layer10 = buildLayer10(brandExamples, spec.section_type);
  if (layer10) layers['10_approved_examples'] = layer10;

  const layer11 = buildLayer11(blueprint, backlog);
  if (layer11) layers['11_location_data'] = layer11;

  layers['12_output_format'] = buildLayer12();

  // ── Concatenate into final prompt ───────────────────────────────────────
  const layerSizes: Record<string, number> = {};
  const orderedParts: string[] = [];

  for (const [key, text] of Object.entries(layers)) {
    layerSizes[key] = estimateTokens(text);
    orderedParts.push(text);
  }

  const prompt = orderedParts.join('\n\n');
  const totalEstimatedTokens = estimateTokens(prompt);

  return {
    prompt,
    layerSizes,
    totalEstimatedTokens,
    metadata: {
      siteId: blueprint.site_id,
      blueprintId: blueprint.id,
      sectionSpecId: spec.id,
      sectionType: spec.section_type,
      sectionOrder: spec.section_order,
    },
  };
}

/**
 * Assemble prompts for all pending section specs in a blueprint.
 * Returns them in section_order for sequential generation.
 */
export function assembleAllForBlueprint(
  blueprintId: number
): AssembledPrompt[] {
  const specs = db
    .prepare(
      `SELECT id, section_order FROM section_specs
       WHERE blueprint_id = ? AND status = 'pending'
       ORDER BY section_order ASC`
    )
    .all(blueprintId) as Array<{ id: number; section_order: number }>;

  return specs.map((s) => assembleSectionPrompt(s.id));
}
