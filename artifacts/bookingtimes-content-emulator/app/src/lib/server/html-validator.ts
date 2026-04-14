/**
 * AI Output Validation Layer (WRK-BCE2-036)
 *
 * Post-processing validation for generated HTML sections and pages.
 * Checks CSS classes, well-formedness, placeholders, heading hierarchy,
 * internal links, and word counts before content can be approved or exported.
 */

import db from '$lib/db';
import bootstrapCatalog from '$lib/data/bootstrap-5.0.2-classes.json';
import fa6Catalog from '$lib/data/fa6-pro-classes.json';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    cssClassesUsed: string[];
    unknownClasses: string[];
    headingStructure: Array<{ level: number; text: string }>;
    internalLinks: Array<{ href: string; text: string }>;
    wordCount: number;
    hasPlaceholders: boolean;
    hasHeadElements: boolean;
    hasScriptTags: boolean;
  };
}

interface SectionSpecRow {
  id: number;
  blueprint_id: number;
  section_type: string;
  target_word_count_min: number | null;
  target_word_count_max: number | null;
  generated_html: string | null;
}

interface CssAuditRow {
  class_name: string;
}

interface LinkGraphRow {
  target_url: string;
}

interface BlueprintRow {
  id: number;
  site_id: number;
}

// ── Bootstrap 5.0.2 Class Set ──────────────────────────────────────────────

function buildBootstrapClassSet(): Set<string> {
  const classes = new Set<string>();

  function walk(obj: unknown): void {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'string') classes.add(item);
      }
    } else if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        walk(value);
      }
    }
  }

  walk((bootstrapCatalog as Record<string, unknown>).categories);
  return classes;
}

const BS_CLASSES = buildBootstrapClassSet();

// ── FA6 Pro Validation ─────────────────────────────────────────────────────

function buildFa6ClassSet(): Set<string> {
  const classes = new Set<string>();
  const catalog = fa6Catalog as Record<string, unknown>;

  for (const key of ['styles', 'sizing', 'utility', 'duotone_specific', 'sharp_family']) {
    const arr = catalog[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === 'string') classes.add(item);
      }
    }
  }

  return classes;
}

const FA6_KNOWN_CLASSES = buildFa6ClassSet();

// FA6 icon names match fa-[a-z0-9][a-z0-9-]+  (2000+ icons, not enumerated)
const FA6_ICON_PATTERN = /^fa-[a-z0-9][a-z0-9-]*$/;
const FA6_STYLE_PREFIXES = new Set([
  'fa-solid', 'fa-regular', 'fa-light', 'fa-thin',
  'fa-duotone', 'fa-brands', 'fa-sharp', 'fa-sharp-duotone',
]);

function isFa6Class(className: string): boolean {
  if (FA6_KNOWN_CLASSES.has(className)) return true;
  // Accept any fa- prefixed class that matches the icon name pattern
  if (FA6_ICON_PATTERN.test(className)) return true;
  return false;
}

// ── Site CSS Audit Classes (Tier 2) ────────────────────────────────────────

function getSiteCssClasses(siteId: number): Set<string> {
  const rows = db.prepare(
    'SELECT class_name FROM css_audit WHERE site_id = ?'
  ).all(siteId) as CssAuditRow[];

  return new Set(rows.map((r) => r.class_name));
}

// ── Extraction Helpers ─────────────────────────────────────────────────────

/**
 * Extract all CSS class names from class="..." attributes in HTML.
 */
function extractCssClasses(html: string): string[] {
  const classAttrPattern = /class\s*=\s*"([^"]*)"/gi;
  const allClasses = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = classAttrPattern.exec(html)) !== null) {
    const value = match[1];
    for (const cls of value.split(/\s+/)) {
      const trimmed = cls.trim();
      if (trimmed) allClasses.add(trimmed);
    }
  }

  // Also handle single-quoted class attributes
  const singleQuotePattern = /class\s*=\s*'([^']*)'/gi;
  while ((match = singleQuotePattern.exec(html)) !== null) {
    const value = match[1];
    for (const cls of value.split(/\s+/)) {
      const trimmed = cls.trim();
      if (trimmed) allClasses.add(trimmed);
    }
  }

  return [...allClasses].sort();
}

/**
 * Extract heading tags from HTML.
 */
function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const headingPattern = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ level: number; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    // Strip inner HTML tags to get text content
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    headings.push({ level, text });
  }

  return headings;
}

/**
 * Extract anchor tags from HTML.
 */
function extractLinks(html: string): Array<{ href: string; text: string }> {
  const linkPattern = /<a\s[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: Array<{ href: string; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    links.push({ href, text });
  }

  return links;
}

/**
 * Extract visible text content from HTML (strip tags) and count words.
 */
function countWords(html: string): number {
  // Remove all tags
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 0;
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// ── Validation Checks ──────────────────────────────────────────────────────

const HEAD_ONLY_TAGS = /(?:^|[\s\S]*)<(meta|title|link|html|head|body)\b[^>]*>/i;
const SCRIPT_TAG = /<script\b[^>]*>/i;

const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/,           // {{...}}
  /\[TBD\]/i,                // [TBD]
  /\bTODO\b/,                // TODO
  /\bINSERT_\w+/,            // INSERT_*
  /\bPLACEHOLDER\b/i,        // PLACEHOLDER
  /\bLorem ipsum\b/i,        // Lorem ipsum
];

/**
 * Check for unclosed tags (basic matching — not a full parser).
 * Returns list of error messages.
 */
function checkWellFormedness(html: string): string[] {
  const errors: string[] = [];

  // Self-closing / void elements that don't need closing tags
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);

  // Extract all tags
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\/?>/g;
  const stack: Array<{ tag: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1].toLowerCase();

    // Skip void elements
    if (voidElements.has(tagName)) continue;
    // Skip self-closing tags
    if (fullMatch.endsWith('/>')) continue;
    // Skip comments
    if (fullMatch.startsWith('<!--')) continue;

    if (fullMatch.startsWith('</')) {
      // Closing tag
      if (stack.length === 0) {
        errors.push(`Unexpected closing tag </${tagName}> with no matching opening tag`);
      } else if (stack[stack.length - 1].tag !== tagName) {
        // Find if the tag exists somewhere in the stack
        const idx = stack.findLastIndex((s) => s.tag === tagName);
        if (idx === -1) {
          errors.push(`Unexpected closing tag </${tagName}> with no matching opening tag`);
        } else {
          // Report all unclosed tags between idx+1 and end
          for (let i = stack.length - 1; i > idx; i--) {
            errors.push(`Unclosed tag <${stack[i].tag}>`);
          }
          stack.splice(idx); // Remove from idx onwards
        }
      } else {
        stack.pop();
      }
    } else {
      // Opening tag
      stack.push({ tag: tagName, index: match.index });
    }
  }

  // Anything remaining in the stack is unclosed
  for (const item of stack) {
    errors.push(`Unclosed tag <${item.tag}>`);
  }

  return errors;
}

// ── Main Validation Functions ──────────────────────────────────────────────

/**
 * Validate a single section's generated HTML.
 */
export function validateSectionHtml(
  html: string,
  siteId: number,
  sectionSpecId: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── 1. CSS class validation ──────────────────────────────────────────

  const cssClassesUsed = extractCssClasses(html);
  const siteCssClasses = getSiteCssClasses(siteId);
  const unknownClasses: string[] = [];

  for (const cls of cssClassesUsed) {
    // Tier 1: Bootstrap 5.0.2
    if (BS_CLASSES.has(cls)) continue;
    // Tier 2: Site css_audit
    if (siteCssClasses.has(cls)) continue;
    // Tier 3: FA6 Pro patterns
    if (isFa6Class(cls)) continue;

    unknownClasses.push(cls);
  }

  if (unknownClasses.length > 0) {
    errors.push(
      `Unknown CSS classes (not in BS 5.0.2, site css_audit, or FA6 Pro): ${unknownClasses.join(', ')}`
    );
  }

  // ── 2. HTML well-formedness ──────────────────────────────────────────

  const formErrors = checkWellFormedness(html);
  for (const err of formErrors) {
    errors.push(`HTML structure: ${err}`);
  }

  // ── 3. Head-only elements ────────────────────────────────────────────

  const hasHeadElements = HEAD_ONLY_TAGS.test(html);
  if (hasHeadElements) {
    const headTags = ['meta', 'title', 'link', 'html', 'head', 'body'];
    const found: string[] = [];
    for (const tag of headTags) {
      const re = new RegExp(`<${tag}\\b`, 'i');
      if (re.test(html)) found.push(`<${tag}>`);
    }
    errors.push(`Head/document-level elements not allowed in section HTML: ${found.join(', ')}`);
  }

  // ── 4. Script tags ──────────────────────────────────────────────────

  const hasScriptTags = SCRIPT_TAG.test(html);
  if (hasScriptTags) {
    errors.push('Script tags are not allowed in generated section HTML');
  }

  // ── 5. Placeholder detection ─────────────────────────────────────────

  let hasPlaceholders = false;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(html)) {
      hasPlaceholders = true;
      break;
    }
  }
  if (hasPlaceholders) {
    const found: string[] = [];
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = html.match(pattern);
      if (match) found.push(match[0]);
    }
    errors.push(`Placeholder content detected: ${found.join(', ')}`);
  }

  // ── 6. Heading hierarchy ─────────────────────────────────────────────

  const headingStructure = extractHeadings(html);

  // Section content should not contain H1
  const h1s = headingStructure.filter((h) => h.level === 1);
  if (h1s.length > 0) {
    errors.push(
      `Section content must not contain H1 tags (page H1 is separate). Found: "${h1s.map((h) => h.text).join('", "')}"`
    );
  }

  // Check for skipped heading levels within section (e.g., H2 then H4 with no H3)
  const nonH1Headings = headingStructure.filter((h) => h.level > 1);
  if (nonH1Headings.length > 1) {
    for (let i = 1; i < nonH1Headings.length; i++) {
      const prev = nonH1Headings[i - 1].level;
      const curr = nonH1Headings[i].level;
      if (curr > prev + 1) {
        warnings.push(
          `Heading level skipped: H${prev} followed by H${curr} (expected H${prev + 1} or same/lower)`
        );
      }
    }
  }

  // ── 7. Internal link validation ──────────────────────────────────────

  const allLinks = extractLinks(html);
  const internalLinks = allLinks.filter(
    (l) => l.href.startsWith('/') || (!l.href.startsWith('http') && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:') && !l.href.startsWith('#'))
  );

  // Check internal links against the link graph
  if (internalLinks.length > 0) {
    const knownTargets = db.prepare(
      'SELECT DISTINCT target_url FROM internal_link_graph WHERE site_id = ?'
    ).all(siteId) as LinkGraphRow[];
    const knownTargetSet = new Set(knownTargets.map((r) => r.target_url));

    // Also include existing pages
    const existingPages = db.prepare(
      'SELECT DISTINCT url FROM site_structure_map WHERE site_id = ?'
    ).all(siteId) as Array<{ url: string }>;
    for (const p of existingPages) {
      knownTargetSet.add(p.url);
    }

    // And planned pages from work_backlog
    const plannedPages = db.prepare(
      'SELECT DISTINCT target_url FROM work_backlog WHERE site_id = ? AND target_url IS NOT NULL'
    ).all(siteId) as Array<{ target_url: string }>;
    for (const p of plannedPages) {
      knownTargetSet.add(p.target_url);
    }

    for (const link of internalLinks) {
      if (!knownTargetSet.has(link.href)) {
        warnings.push(
          `Internal link to unknown page: "${link.href}" (anchor: "${link.text}")`
        );
      }
    }
  }

  // ── 8. Word count check ──────────────────────────────────────────────

  const wordCount = countWords(html);

  const specRow = db.prepare(
    'SELECT target_word_count_min, target_word_count_max FROM section_specs WHERE id = ?'
  ).get(sectionSpecId) as Pick<SectionSpecRow, 'target_word_count_min' | 'target_word_count_max'> | undefined;

  if (specRow) {
    if (specRow.target_word_count_min !== null && wordCount < specRow.target_word_count_min) {
      errors.push(
        `Word count ${wordCount} is below minimum target of ${specRow.target_word_count_min}`
      );
    }
    if (specRow.target_word_count_max !== null && wordCount > specRow.target_word_count_max) {
      warnings.push(
        `Word count ${wordCount} exceeds maximum target of ${specRow.target_word_count_max}`
      );
    }
  }

  // ── Build result ─────────────────────────────────────────────────────

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      cssClassesUsed,
      unknownClasses,
      headingStructure,
      internalLinks,
      wordCount,
      hasPlaceholders,
      hasHeadElements,
      hasScriptTags,
    },
  };
}

/**
 * Validate all sections for a page blueprint.
 * Returns a combined ValidationResult covering every section.
 */
export function validatePageHtml(blueprintId: number): ValidationResult {
  const blueprint = db.prepare(
    'SELECT id, site_id FROM page_blueprints WHERE id = ?'
  ).get(blueprintId) as BlueprintRow | undefined;

  if (!blueprint) {
    return {
      valid: false,
      errors: [`Blueprint ${blueprintId} not found`],
      warnings: [],
      details: {
        cssClassesUsed: [],
        unknownClasses: [],
        headingStructure: [],
        internalLinks: [],
        wordCount: 0,
        hasPlaceholders: false,
        hasHeadElements: false,
        hasScriptTags: false,
      },
    };
  }

  const sections = db.prepare(
    'SELECT id, generated_html FROM section_specs WHERE blueprint_id = ? ORDER BY section_order'
  ).all(blueprintId) as Array<{ id: number; generated_html: string | null }>;

  const combinedErrors: string[] = [];
  const combinedWarnings: string[] = [];
  const allCssClasses = new Set<string>();
  const allUnknownClasses = new Set<string>();
  const allHeadings: Array<{ level: number; text: string }> = [];
  const allLinks: Array<{ href: string; text: string }> = [];
  let totalWords = 0;
  let anyPlaceholders = false;
  let anyHeadElements = false;
  let anyScriptTags = false;

  let sectionsWithHtml = 0;

  for (const section of sections) {
    if (!section.generated_html) {
      combinedWarnings.push(`Section spec ${section.id} has no generated HTML`);
      continue;
    }

    sectionsWithHtml++;
    const result = validateSectionHtml(
      section.generated_html,
      blueprint.site_id,
      section.id
    );

    // Prefix errors/warnings with section ID for clarity
    for (const err of result.errors) {
      combinedErrors.push(`[Section ${section.id}] ${err}`);
    }
    for (const warn of result.warnings) {
      combinedWarnings.push(`[Section ${section.id}] ${warn}`);
    }

    for (const cls of result.details.cssClassesUsed) allCssClasses.add(cls);
    for (const cls of result.details.unknownClasses) allUnknownClasses.add(cls);
    allHeadings.push(...result.details.headingStructure);
    allLinks.push(...result.details.internalLinks);
    totalWords += result.details.wordCount;
    if (result.details.hasPlaceholders) anyPlaceholders = true;
    if (result.details.hasHeadElements) anyHeadElements = true;
    if (result.details.hasScriptTags) anyScriptTags = true;
  }

  if (sectionsWithHtml === 0) {
    combinedErrors.push('No sections have generated HTML');
  }

  // Cross-section heading hierarchy check: verify no skipped levels across the entire page
  if (allHeadings.length > 1) {
    for (let i = 1; i < allHeadings.length; i++) {
      const prev = allHeadings[i - 1].level;
      const curr = allHeadings[i].level;
      if (curr > prev + 1) {
        combinedWarnings.push(
          `Page-level heading skip: H${prev} followed by H${curr}`
        );
      }
    }
  }

  return {
    valid: combinedErrors.length === 0,
    errors: combinedErrors,
    warnings: combinedWarnings,
    details: {
      cssClassesUsed: [...allCssClasses].sort(),
      unknownClasses: [...allUnknownClasses].sort(),
      headingStructure: allHeadings,
      internalLinks: allLinks,
      wordCount: totalWords,
      hasPlaceholders: anyPlaceholders,
      hasHeadElements: anyHeadElements,
      hasScriptTags: anyScriptTags,
    },
  };
}
