/**
 * Schema / Structured Data Detection (WRK-BCE2-013)
 *
 * Inspects every audited page for existing structured data (JSON-LD,
 * Microdata, RDFa), catalogues what exists, validates it, and stores
 * results in the `schema_audit` table.
 *
 * Downstream consumers:
 *   - Stage 4: Schema generation uses gaps identified here
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaAnalysis {
  structureMapId: number;
  siteId: number;
  schemaTypesFound: string[];
  schemaFormat: 'json-ld' | 'microdata' | 'rdfa' | 'none';
  hasGraph: boolean;
  hasIdReferences: boolean;
  hasSameAs: boolean;
  hasBreadcrumb: boolean;
  hasFaqSchema: boolean;
  validationErrors: string[];
  missingTypes: string[];
  missingProperties: string[];
  recommendations: string[];
}

export interface SiteSchemaAuditResult {
  siteId: number;
  pagesAnalyzed: number;
  analyses: SchemaAnalysis[];
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

// ---------------------------------------------------------------------------
// JSON-LD Extraction & Parsing
// ---------------------------------------------------------------------------

/** Extract all JSON-LD script blocks from HTML. */
function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const content = m[1].trim();
    if (content) blocks.push(content);
  }
  return blocks;
}

/** Detect Microdata attributes in HTML. */
function detectMicrodata(html: string): boolean {
  return /\bitemscope\b/i.test(html) && /\bitemtype\b/i.test(html);
}

/** Detect RDFa attributes in HTML. */
function detectRdfa(html: string): boolean {
  // RDFa uses typeof + property or vocab attributes on elements
  return (
    (/\btypeof\s*=/i.test(html) && /\bproperty\s*=/i.test(html)) ||
    /\bvocab\s*=\s*["']https?:\/\/schema\.org/i.test(html)
  );
}

interface ParsedJsonLd {
  types: string[];
  hasGraph: boolean;
  hasIdReferences: boolean;
  hasSameAs: boolean;
  hasBreadcrumb: boolean;
  hasFaqSchema: boolean;
  validationErrors: string[];
  /** Flat list of all parsed objects for property checking. */
  allObjects: Record<string, unknown>[];
}

/** Recursively collect all @type values and objects from a parsed JSON-LD structure. */
function collectFromJsonLd(
  obj: unknown,
  types: Set<string>,
  objects: Record<string, unknown>[],
  flags: { hasGraph: boolean; hasIdReferences: boolean; hasSameAs: boolean }
): void {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectFromJsonLd(item, types, objects, flags);
    }
    return;
  }

  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    objects.push(record);

    // Collect @type
    if (record['@type']) {
      const t = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
      for (const type of t) {
        if (typeof type === 'string') types.add(type);
      }
    }

    // Check @graph
    if (record['@graph'] && Array.isArray(record['@graph'])) {
      flags.hasGraph = true;
      for (const item of record['@graph']) {
        collectFromJsonLd(item, types, objects, flags);
      }
    }

    // Check @id
    if (record['@id']) {
      flags.hasIdReferences = true;
    }

    // Check sameAs
    if (record['sameAs']) {
      flags.hasSameAs = true;
    }

    // Recurse into nested objects (e.g., address, provider, mainEntity)
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith('@')) continue; // skip JSON-LD keywords already handled
      if (value && typeof value === 'object') {
        collectFromJsonLd(value, types, objects, flags);
      }
    }
  }
}

/** Parse all JSON-LD blocks and extract structured information. */
function parseJsonLdBlocks(blocks: string[]): ParsedJsonLd {
  const types = new Set<string>();
  const allObjects: Record<string, unknown>[] = [];
  const validationErrors: string[] = [];
  const flags = { hasGraph: false, hasIdReferences: false, hasSameAs: false };

  for (let i = 0; i < blocks.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(blocks[i]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      validationErrors.push(`JSON-LD block ${i + 1}: syntax error — ${msg}`);
      continue;
    }

    // Validate it has @context
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      if (!record['@context']) {
        validationErrors.push(`JSON-LD block ${i + 1}: missing @context`);
      }
      if (!record['@type'] && !record['@graph']) {
        validationErrors.push(`JSON-LD block ${i + 1}: missing @type and @graph`);
      }
    }

    collectFromJsonLd(parsed, types, allObjects, flags);
  }

  const typeArr = Array.from(types);

  return {
    types: typeArr,
    hasGraph: flags.hasGraph,
    hasIdReferences: flags.hasIdReferences,
    hasSameAs: flags.hasSameAs,
    hasBreadcrumb: typeArr.includes('BreadcrumbList'),
    hasFaqSchema: typeArr.includes('FAQPage'),
    validationErrors,
    allObjects,
  };
}

// ---------------------------------------------------------------------------
// Missing Types — What SHOULD exist for each page type
// ---------------------------------------------------------------------------

/** Expected schema types per page type. */
function getExpectedTypes(pageType: string): string[] {
  switch (pageType) {
    case 'homepage':
      return ['LocalBusiness', 'WebSite', 'BreadcrumbList'];
    case 'service':
      return ['Service', 'BreadcrumbList'];
    case 'location':
      return ['LocalBusiness', 'BreadcrumbList'];
    case 'about':
      return ['Organization', 'BreadcrumbList'];
    case 'faq':
      return ['FAQPage', 'BreadcrumbList'];
    case 'contact':
      return ['LocalBusiness', 'BreadcrumbList'];
    default:
      return ['BreadcrumbList'];
  }
}

/**
 * Determine which expected types are missing.
 * For driving schools: AutomotiveBusiness is the correct type, NOT DrivingSchool.
 * We accept Organization, LocalBusiness, or AutomotiveBusiness as satisfying
 * any of those three in the "found" set.
 */
function findMissingTypes(expected: string[], found: string[]): string[] {
  const foundSet = new Set(found);

  // Organization family: any of these satisfies a requirement for Organization/LocalBusiness
  const orgFamily = ['Organization', 'LocalBusiness', 'AutomotiveBusiness'];
  const hasOrgType = orgFamily.some((t) => foundSet.has(t));

  const missing: string[] = [];
  for (const type of expected) {
    if (foundSet.has(type)) continue;

    // If the expected type is an org-family type, accept any org-family type
    if (orgFamily.includes(type) && hasOrgType) continue;

    missing.push(type);
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Missing Properties — Required properties per schema type
// ---------------------------------------------------------------------------

interface PropertyRequirement {
  type: string;
  required: string[];
}

const PROPERTY_REQUIREMENTS: PropertyRequirement[] = [
  {
    type: 'Organization',
    required: ['name', 'url', 'telephone', 'address'],
  },
  {
    type: 'LocalBusiness',
    required: ['name', 'url', 'telephone', 'address', 'areaServed'],
  },
  {
    type: 'AutomotiveBusiness',
    required: ['name', 'url', 'telephone', 'address', 'areaServed'],
  },
  {
    type: 'FAQPage',
    required: ['mainEntity'],
  },
  {
    type: 'BreadcrumbList',
    required: ['itemListElement'],
  },
  {
    type: 'Service',
    required: ['name', 'provider', 'areaServed'],
  },
  {
    type: 'WebSite',
    required: ['name', 'url'],
  },
];

/** Check found schema objects for missing required properties. */
function findMissingProperties(
  allObjects: Record<string, unknown>[],
  typesFound: string[]
): string[] {
  const missing: string[] = [];

  for (const req of PROPERTY_REQUIREMENTS) {
    // Only check types that were actually found
    if (!typesFound.includes(req.type)) continue;

    // Find objects of this type
    const matchingObjects = allObjects.filter((obj) => {
      const t = obj['@type'];
      if (Array.isArray(t)) return t.includes(req.type);
      return t === req.type;
    });

    if (matchingObjects.length === 0) continue;

    for (const prop of req.required) {
      const hasProp = matchingObjects.some(
        (obj) => obj[prop] !== undefined && obj[prop] !== null && obj[prop] !== ''
      );
      if (!hasProp) {
        missing.push(`${req.type}: missing "${prop}"`);
      }
    }
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function generateRecommendations(
  pageType: string,
  missingTypes: string[],
  missingProperties: string[],
  validationErrors: string[],
  hasGraph: boolean,
  hasBreadcrumb: boolean,
  hasSameAs: boolean,
  schemaFormat: string
): string[] {
  const recs: string[] = [];

  // Missing types
  for (const type of missingTypes) {
    switch (type) {
      case 'BreadcrumbList':
        recs.push('Add BreadcrumbList schema to provide navigation context for search engines.');
        break;
      case 'FAQPage':
        recs.push(
          'Add FAQPage schema with Question/Answer pairs to earn FAQ rich results in SERPs.'
        );
        break;
      case 'Service':
        recs.push('Add Service schema with name, provider, and areaServed properties.');
        break;
      case 'LocalBusiness':
        recs.push(
          'Add LocalBusiness (or AutomotiveBusiness for driving schools) schema with full NAP+W details.'
        );
        break;
      case 'Organization':
        recs.push('Add Organization schema with name, url, telephone, and address.');
        break;
      case 'WebSite':
        recs.push('Add WebSite schema on the homepage with name and url at minimum.');
        break;
      default:
        recs.push(`Add ${type} schema markup for this page type.`);
    }
  }

  // Missing properties
  for (const prop of missingProperties) {
    recs.push(`Fix: ${prop}.`);
  }

  // Validation errors
  if (validationErrors.length > 0) {
    recs.push(`Fix ${validationErrors.length} JSON-LD validation error(s) before adding new schema.`);
  }

  // Structural improvements
  if (schemaFormat !== 'none' && !hasGraph) {
    recs.push(
      'Consider using the @graph pattern to connect multiple schema entities in a single JSON-LD block.'
    );
  }

  if (schemaFormat !== 'none' && !hasSameAs) {
    recs.push(
      'Add sameAs property linking to social profiles (Google Business, Facebook, etc.) for entity disambiguation.'
    );
  }

  // If page type suggests FAQ content but no FAQ schema
  if ((pageType === 'service' || pageType === 'location') && !hasBreadcrumb) {
    recs.push(
      'Service and location pages benefit strongly from BreadcrumbList schema for SERP navigation.'
    );
  }

  if (schemaFormat === 'none') {
    recs.push(
      'No structured data found at all. Implement JSON-LD schema markup to improve search visibility.'
    );
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Core Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a single page for existing structured data.
 */
export async function analyzePageSchema(
  url: string,
  pageType: string,
  structureMapId: number,
  siteId: number
): Promise<SchemaAnalysis> {
  const html = await fetchPage(url);

  if (!html) {
    return {
      structureMapId,
      siteId,
      schemaTypesFound: [],
      schemaFormat: 'none',
      hasGraph: false,
      hasIdReferences: false,
      hasSameAs: false,
      hasBreadcrumb: false,
      hasFaqSchema: false,
      validationErrors: ['Failed to fetch page'],
      missingTypes: getExpectedTypes(pageType),
      missingProperties: [],
      recommendations: ['Page could not be fetched — unable to analyze schema.'],
    };
  }

  // 1. Extract JSON-LD blocks
  const jsonLdBlocks = extractJsonLdBlocks(html);

  // 2. Detect Microdata and RDFa
  const hasMicrodata = detectMicrodata(html);
  const hasRdfa = detectRdfa(html);

  // 3. Determine primary schema format
  let schemaFormat: SchemaAnalysis['schemaFormat'] = 'none';
  if (jsonLdBlocks.length > 0) {
    schemaFormat = 'json-ld';
  } else if (hasMicrodata) {
    schemaFormat = 'microdata';
  } else if (hasRdfa) {
    schemaFormat = 'rdfa';
  }

  // 4. Parse JSON-LD
  const parsed = parseJsonLdBlocks(jsonLdBlocks);

  // 5. Find missing types for this page type
  const expectedTypes = getExpectedTypes(pageType);
  const missingTypes = findMissingTypes(expectedTypes, parsed.types);

  // 6. Check required properties
  const missingProperties = findMissingProperties(parsed.allObjects, parsed.types);

  // 7. Generate recommendations
  const recommendations = generateRecommendations(
    pageType,
    missingTypes,
    missingProperties,
    parsed.validationErrors,
    parsed.hasGraph,
    parsed.hasBreadcrumb,
    parsed.hasSameAs,
    schemaFormat
  );

  return {
    structureMapId,
    siteId,
    schemaTypesFound: parsed.types,
    schemaFormat,
    hasGraph: parsed.hasGraph,
    hasIdReferences: parsed.hasIdReferences,
    hasSameAs: parsed.hasSameAs,
    hasBreadcrumb: parsed.hasBreadcrumb,
    hasFaqSchema: parsed.hasFaqSchema,
    validationErrors: parsed.validationErrors,
    missingTypes,
    missingProperties,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

interface StructureMapRow {
  id: number;
  url: string;
  page_type: string | null;
}

const getAuditedPagesStmt = db.prepare(
  `SELECT id, url, page_type FROM site_structure_map
   WHERE site_id = ? AND last_scraped_at IS NOT NULL`
);

const getSiteStmt = db.prepare('SELECT id, url FROM sites WHERE id = ?');

const deleteExistingAuditStmt = db.prepare(
  'DELETE FROM schema_audit WHERE site_id = ?'
);

const insertSchemaAuditStmt = db.prepare(`
  INSERT INTO schema_audit (
    structure_map_id, site_id, schema_types_found, schema_format,
    has_graph, has_id_references, has_same_as, has_breadcrumb, has_faq_schema,
    validation_errors, missing_types, missing_properties, recommendations
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getSchemaAuditStmt = db.prepare(
  `SELECT sa.*, ssm.url, ssm.page_type
   FROM schema_audit sa
   JOIN site_structure_map ssm ON sa.structure_map_id = ssm.id
   WHERE sa.site_id = ?`
);

/** Persist a single SchemaAnalysis to the database. */
function saveAnalysis(analysis: SchemaAnalysis): void {
  insertSchemaAuditStmt.run(
    analysis.structureMapId,
    analysis.siteId,
    JSON.stringify(analysis.schemaTypesFound),
    analysis.schemaFormat,
    analysis.hasGraph ? 1 : 0,
    analysis.hasIdReferences ? 1 : 0,
    analysis.hasSameAs ? 1 : 0,
    analysis.hasBreadcrumb ? 1 : 0,
    analysis.hasFaqSchema ? 1 : 0,
    JSON.stringify(analysis.validationErrors),
    JSON.stringify(analysis.missingTypes),
    JSON.stringify(analysis.missingProperties),
    JSON.stringify(analysis.recommendations)
  );
}

// ---------------------------------------------------------------------------
// Public API — Site-wide Schema Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze schema markup for all audited pages of a site.
 * Fetches each page, extracts structured data, validates it,
 * identifies gaps, and persists results to schema_audit.
 */
export async function analyzeSiteSchema(siteId: number): Promise<SiteSchemaAuditResult> {
  const errors: string[] = [];

  // Validate site exists
  const site = getSiteStmt.get(siteId) as { id: number; url: string } | undefined;
  if (!site) {
    return { siteId, pagesAnalyzed: 0, analyses: [], errors: [`Site ${siteId} not found`] };
  }

  // Get all audited pages
  const pages = getAuditedPagesStmt.all(siteId) as StructureMapRow[];
  if (pages.length === 0) {
    return {
      siteId,
      pagesAnalyzed: 0,
      analyses: [],
      errors: ['No audited pages found. Run content scraping (WRK-011) first.'],
    };
  }

  // Clear previous audit data for this site (re-run = fresh results)
  deleteExistingAuditStmt.run(siteId);

  const analyses: SchemaAnalysis[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Inter-page delay (skip before first)
    if (i > 0) {
      await sleep(INTER_PAGE_DELAY_MS);
    }

    try {
      const analysis = await analyzePageSchema(
        page.url,
        page.page_type || 'other',
        page.id,
        siteId
      );

      // Persist to database
      saveAnalysis(analysis);
      analyses.push(analysis);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to analyze ${page.url}: ${msg}`);
    }
  }

  return {
    siteId,
    pagesAnalyzed: analyses.length,
    analyses,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Read API — Get existing schema audit data
// ---------------------------------------------------------------------------

/**
 * Get existing schema_audit rows for a site.
 */
export function getSchemaAudit(siteId: number): SiteSchemaAuditResult {
  const site = getSiteStmt.get(siteId) as { id: number; url: string } | undefined;
  if (!site) {
    return { siteId, pagesAnalyzed: 0, analyses: [], errors: [`Site ${siteId} not found`] };
  }

  const rows = getSchemaAuditStmt.all(siteId) as Array<{
    id: number;
    structure_map_id: number;
    site_id: number;
    schema_types_found: string | null;
    schema_format: string | null;
    has_graph: number;
    has_id_references: number;
    has_same_as: number;
    has_breadcrumb: number;
    has_faq_schema: number;
    validation_errors: string | null;
    missing_types: string | null;
    missing_properties: string | null;
    recommendations: string | null;
    url: string;
    page_type: string | null;
  }>;

  const analyses: SchemaAnalysis[] = rows.map((row) => ({
    structureMapId: row.structure_map_id,
    siteId: row.site_id,
    schemaTypesFound: row.schema_types_found ? JSON.parse(row.schema_types_found) : [],
    schemaFormat: (row.schema_format as SchemaAnalysis['schemaFormat']) || 'none',
    hasGraph: row.has_graph === 1,
    hasIdReferences: row.has_id_references === 1,
    hasSameAs: row.has_same_as === 1,
    hasBreadcrumb: row.has_breadcrumb === 1,
    hasFaqSchema: row.has_faq_schema === 1,
    validationErrors: row.validation_errors ? JSON.parse(row.validation_errors) : [],
    missingTypes: row.missing_types ? JSON.parse(row.missing_types) : [],
    missingProperties: row.missing_properties ? JSON.parse(row.missing_properties) : [],
    recommendations: row.recommendations ? JSON.parse(row.recommendations) : [],
  }));

  return {
    siteId,
    pagesAnalyzed: analyses.length,
    analyses,
    errors: [],
  };
}
