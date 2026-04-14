/**
 * JSON-LD Structured Data Generator (WRK-BCE2-039)
 *
 * Generates valid JSON-LD per page from the blueprint's schema_spec,
 * resolving template variables and aligning FAQ content with generated HTML.
 *
 * Flow:
 *   1. Load blueprint + schema_spec (template with placeholders)
 *   2. Load site info from sites table
 *   3. Resolve template variables (siteUrl, siteName, phone, city, etc.)
 *   4. Resolve FAQ content from section_specs generated_html
 *   5. Validate: JSON.parse, schema.org types, required props, no leftover {{}}
 *   6. Output as <script type="application/ld+json"> ready string
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface JsonLdResult {
  blueprintId: number;
  valid: boolean;
  jsonLd: string;
  validationErrors: string[];
  schemaTypes: string[];
}

interface BlueprintRow {
  id: number;
  backlog_id: number;
  site_id: number;
  working_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  schema_spec: string | null;
  page_type: string;
  target_url: string | null;
}

interface SiteRow {
  id: number;
  name: string;
  url: string;
}

interface SectionSpecRow {
  id: number;
  section_type: string;
  generated_html: string | null;
}

interface FaqPair {
  '@type': 'Question';
  name: string;
  acceptedAnswer: {
    '@type': 'Answer';
    text: string;
  };
}

// ── Valid schema.org types (common subset relevant to this project) ─────────

const VALID_SCHEMA_TYPES = new Set([
  'AutomotiveBusiness',
  'BreadcrumbList',
  'City',
  'EducationalOrganization',
  'FAQPage',
  'ListItem',
  'LocalBusiness',
  'Organization',
  'PostalAddress',
  'Question',
  'Answer',
  'SearchAction',
  'Service',
  'WebPage',
  'WebSite',
  'AdministrativeArea',
  'Place',
  'Thing',
  'CreativeWork',
  'Article',
  'HowTo',
  'HowToStep',
  'Product',
  'Offer',
  'Review',
  'AggregateRating',
  'ContactPoint',
  'GeoCoordinates',
  'ImageObject',
  'ItemList',
  'Person',
  'Event',
]);

// ── Required properties by @type ───────────────────────────────────────────

const REQUIRED_PROPERTIES: Record<string, string[]> = {
  'AutomotiveBusiness': ['name'],
  'BreadcrumbList': ['itemListElement'],
  'FAQPage': ['mainEntity'],
  'Organization': ['name'],
  'Service': ['name'],
  'WebPage': ['name', 'url'],
  'WebSite': ['name', 'url'],
};

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getBlueprint: db.prepare<[number]>(
    `SELECT pb.id, pb.backlog_id, pb.site_id,
            pb.working_title, pb.meta_description, pb.canonical_url,
            pb.schema_spec,
            wb.page_type, wb.target_url
     FROM page_blueprints pb
     JOIN work_backlog wb ON pb.backlog_id = wb.id
     WHERE pb.id = ?`
  ),

  getSite: db.prepare<[number]>(
    `SELECT id, name, url FROM sites WHERE id = ?`
  ),

  getFaqSections: db.prepare<[number]>(
    `SELECT id, section_type, generated_html
     FROM section_specs
     WHERE blueprint_id = ? AND section_type = 'faq'
     ORDER BY section_order ASC`
  ),
};

// ── Main Functions ──────────────────────────────────────────────────────────

/**
 * Generate resolved JSON-LD for a single blueprint.
 * Resolves all template variables and FAQ placeholders, then validates.
 */
export function generateJsonLd(blueprintId: number): JsonLdResult {
  const bp = stmts.getBlueprint.get(blueprintId) as BlueprintRow | undefined;
  if (!bp) {
    return {
      blueprintId,
      valid: false,
      jsonLd: '',
      validationErrors: [`Blueprint ${blueprintId} not found`],
      schemaTypes: [],
    };
  }

  if (!bp.schema_spec) {
    return {
      blueprintId,
      valid: false,
      jsonLd: '',
      validationErrors: ['No schema_spec found on blueprint. Run JSON-LD spec generation first.'],
      schemaTypes: [],
    };
  }

  const site = stmts.getSite.get(bp.site_id) as SiteRow | undefined;
  if (!site) {
    return {
      blueprintId,
      valid: false,
      jsonLd: '',
      validationErrors: [`Site ${bp.site_id} not found`],
      schemaTypes: [],
    };
  }

  // Step 1: Start with the raw schema_spec JSON string
  let jsonLdStr = bp.schema_spec;

  // Step 2: Build template variable map
  const siteUrl = (site.url || '').replace(/\/$/, '');
  const pageUrl = bp.canonical_url || bp.target_url || siteUrl;
  const suburb = extractSuburb(bp);
  const serviceName = extractServiceName(bp);

  const variables: Record<string, string> = {
    '{{siteUrl}}': siteUrl,
    '{{siteName}}': site.name || 'Site',
    '{{pageUrl}}': pageUrl,
    '{{phone}}': '(02) 0000 0000',         // default - not in DB
    '{{city}}': 'Sydney',                    // default - not in DB
    '{{state}}': 'NSW',                      // default - not in DB
    '{{suburb}}': suburb,
    '{{serviceName}}': serviceName,
    '{{metaDescription}}': bp.meta_description || '',
    '{{googleMapsUrl}}': '',                 // default - not in DB
    '{{facebookUrl}}': '',                   // default - not in DB
  };

  // Step 3: Resolve simple template variables
  for (const [placeholder, value] of Object.entries(variables)) {
    jsonLdStr = jsonLdStr.split(placeholder).join(value);
  }

  // Step 4: Resolve FAQ content
  jsonLdStr = resolveFaqContent(jsonLdStr, blueprintId);

  // Step 5: Validate
  const validation = validateJsonLd(jsonLdStr);

  return {
    blueprintId,
    valid: validation.valid,
    jsonLd: jsonLdStr,
    validationErrors: validation.errors,
    schemaTypes: validation.schemaTypes || [],
  };
}

/**
 * Validate a JSON-LD string for correctness.
 */
export function validateJsonLd(jsonLdString: string): {
  valid: boolean;
  errors: string[];
  schemaTypes?: string[];
} {
  const errors: string[] = [];
  const schemaTypes: string[] = [];

  // 1. JSON.parse must succeed
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonLdString);
  } catch (e) {
    errors.push(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return { valid: false, errors };
  }

  // 2. Check for remaining template variables
  const templateVarPattern = /\{\{[^}]+\}\}/g;
  const remaining = jsonLdString.match(templateVarPattern);
  if (remaining) {
    const unique = [...new Set(remaining)];
    errors.push(`Unresolved template variables: ${unique.join(', ')}`);
  }

  // 3. Collect and validate @type values
  collectTypes(parsed, schemaTypes);
  const uniqueTypes = [...new Set(schemaTypes)];

  for (const t of uniqueTypes) {
    if (!VALID_SCHEMA_TYPES.has(t)) {
      errors.push(`Unknown schema.org type: ${t}`);
    }
  }

  // 4. Check required properties per @type in @graph
  if (parsed && typeof parsed === 'object' && '@graph' in (parsed as Record<string, unknown>)) {
    const graph = (parsed as Record<string, unknown>)['@graph'];
    if (Array.isArray(graph)) {
      for (const node of graph) {
        if (node && typeof node === 'object') {
          const nodeObj = node as Record<string, unknown>;
          const nodeTypes = getNodeTypes(nodeObj);
          for (const nt of nodeTypes) {
            const required = REQUIRED_PROPERTIES[nt];
            if (required) {
              for (const prop of required) {
                if (!(prop in nodeObj) || nodeObj[prop] === null || nodeObj[prop] === undefined || nodeObj[prop] === '') {
                  errors.push(`${nt}: missing required property "${prop}"`);
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    schemaTypes: uniqueTypes,
  };
}

// ── FAQ Resolution ─────────────────────────────────────────────────────────

/**
 * Replace {{PLACEHOLDER_FAQ_QUESTIONS}} with actual FAQ Q&A pairs
 * parsed from the generated HTML of FAQ section specs.
 */
function resolveFaqContent(jsonLdStr: string, blueprintId: number): string {
  if (!jsonLdStr.includes('{{PLACEHOLDER_FAQ_QUESTIONS}}') &&
      !jsonLdStr.includes('"{{PLACEHOLDER_FAQ_QUESTIONS}}"')) {
    return jsonLdStr;
  }

  const faqSections = stmts.getFaqSections.all(blueprintId) as SectionSpecRow[];
  const faqPairs: FaqPair[] = [];

  for (const section of faqSections) {
    if (section.generated_html) {
      const pairs = parseFaqFromHtml(section.generated_html);
      faqPairs.push(...pairs);
    }
  }

  // If no FAQ content was generated, produce an empty array
  const faqJson = JSON.stringify(faqPairs);

  // Replace the placeholder - handle both quoted and unquoted forms
  // The spec generator stores it as: mainEntity: '{{PLACEHOLDER_FAQ_QUESTIONS}}'
  // which in JSON becomes: "mainEntity": "{{PLACEHOLDER_FAQ_QUESTIONS}}"
  jsonLdStr = jsonLdStr.replace(
    '"{{PLACEHOLDER_FAQ_QUESTIONS}}"',
    faqJson
  );
  jsonLdStr = jsonLdStr.replace(
    '{{PLACEHOLDER_FAQ_QUESTIONS}}',
    faqJson
  );

  return jsonLdStr;
}

/**
 * Parse FAQ question/answer pairs from generated HTML.
 *
 * Supports common FAQ HTML patterns:
 *   - <h3>Question</h3> followed by <p>Answer</p> or <div>Answer</div>
 *   - <details><summary>Question</summary>Answer</details>
 *   - <dt>Question</dt><dd>Answer</dd>
 *   - Accordion divs with headings + content
 */
function parseFaqFromHtml(html: string): FaqPair[] {
  const pairs: FaqPair[] = [];

  // Pattern 1: <h3>Q</h3> ... <p>A</p> or <div class="...">A</div>
  const h3Pattern = /<h[2-4][^>]*>(.*?)<\/h[2-4]>\s*(?:<div[^>]*>)?\s*<p[^>]*>(.*?)<\/p>/gis;
  let match: RegExpExecArray | null;

  match = h3Pattern.exec(html);
  while (match) {
    const q = stripTags(match[1]).trim();
    const a = stripTags(match[2]).trim();
    if (q && a) {
      pairs.push(buildFaqPair(q, a));
    }
    match = h3Pattern.exec(html);
  }

  if (pairs.length > 0) return pairs;

  // Pattern 2: <details><summary>Q</summary>...A...</details>
  const detailsPattern = /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>([\s\S]*?)<\/details>/gi;
  match = detailsPattern.exec(html);
  while (match) {
    const q = stripTags(match[1]).trim();
    const a = stripTags(match[2]).trim();
    if (q && a) {
      pairs.push(buildFaqPair(q, a));
    }
    match = detailsPattern.exec(html);
  }

  if (pairs.length > 0) return pairs;

  // Pattern 3: <dt>Q</dt><dd>A</dd>
  const dlPattern = /<dt[^>]*>(.*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  match = dlPattern.exec(html);
  while (match) {
    const q = stripTags(match[1]).trim();
    const a = stripTags(match[2]).trim();
    if (q && a) {
      pairs.push(buildFaqPair(q, a));
    }
    match = dlPattern.exec(html);
  }

  // Pattern 4: accordion - button with heading + collapse content
  if (pairs.length === 0) {
    const accordionPattern = /<button[^>]*>(.*?)<\/button>[\s\S]*?<div[^>]*class="[^"]*collapse[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    match = accordionPattern.exec(html);
    while (match) {
      const q = stripTags(match[1]).trim();
      const a = stripTags(match[2]).trim();
      if (q && a) {
        pairs.push(buildFaqPair(q, a));
      }
      match = accordionPattern.exec(html);
    }
  }

  return pairs;
}

function buildFaqPair(question: string, answer: string): FaqPair {
  return {
    '@type': 'Question',
    name: question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: answer,
    },
  };
}

/**
 * Strip HTML tags from a string.
 */
function stripTags(str: string): string {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively collect all @type values from a JSON-LD object.
 */
function collectTypes(obj: unknown, types: string[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectTypes(item, types);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  if ('@type' in record) {
    const t = record['@type'];
    if (typeof t === 'string') {
      types.push(t);
    } else if (Array.isArray(t)) {
      for (const item of t) {
        if (typeof item === 'string') types.push(item);
      }
    }
  }

  for (const value of Object.values(record)) {
    collectTypes(value, types);
  }
}

/**
 * Get @type values from a single node as an array.
 */
function getNodeTypes(node: Record<string, unknown>): string[] {
  const t = node['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}

/**
 * Extract a human-readable service name from the blueprint.
 */
function extractServiceName(bp: BlueprintRow): string {
  if (bp.working_title && !bp.working_title.includes(' - ')) {
    return bp.working_title;
  }

  if (bp.target_url) {
    const segments = bp.target_url.replace(/https?:\/\/[^/]+/, '').split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      return titleCase(last.replace(/\.(html|htm)$/i, '').replace(/-/g, ' '));
    }
  }

  if (bp.working_title) {
    const parts = bp.working_title.split(' - ');
    return parts[0].trim();
  }

  return 'Service';
}

/**
 * Extract a suburb name from the blueprint for location pages.
 */
function extractSuburb(bp: BlueprintRow): string {
  if (bp.target_url) {
    const segments = bp.target_url.replace(/https?:\/\/[^/]+/, '').split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      const cleaned = last
        .replace(/^driving-lessons?-/i, '')
        .replace(/^lessons?-/i, '')
        .replace(/\.(html|htm)$/i, '')
        .replace(/-/g, ' ');
      if (cleaned) return titleCase(cleaned);
    }
  }

  if (bp.working_title) {
    const match = bp.working_title.match(/in\s+(.+?)(?:\s*-|$)/i);
    if (match) return match[1].trim();
  }

  return 'Unknown';
}

/**
 * Title-case a string.
 */
function titleCase(str: string): string {
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
