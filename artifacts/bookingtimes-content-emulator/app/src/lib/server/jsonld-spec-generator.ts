/**
 * JSON-LD Spec Generator (WRK-BCE2-031)
 *
 * For each page_blueprint, generates the exact JSON-LD schema specification
 * using the @graph/@id pattern. The Organization entity is defined once on
 * the homepage and referenced by @id on all other pages.
 *
 * Data sources:
 *   - page_blueprints (joined with work_backlog for page type)
 *   - sites (site name, URL)
 *
 * Template variables ({{phone}}, {{city}}, {{state}}, {{googleMapsUrl}},
 * {{facebookUrl}}, {{PLACEHOLDER_FAQ_QUESTIONS}}) are left as placeholders
 * and resolved at HTML generation time.
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface JsonLdSpecResult {
  siteId: number;
  blueprintsUpdated: number;
  specsByPageType: Record<string, number>;
}

interface BlueprintWithType {
  id: number;
  backlog_id: number;
  site_id: number;
  working_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  breadcrumb_path: string | null;
  page_type: string;
  target_url: string | null;
}

interface SiteRow {
  id: number;
  name: string;
  url: string;
}

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getBlueprintsWithType: db.prepare<[number]>(
    `SELECT pb.id, pb.backlog_id, pb.site_id,
            pb.working_title, pb.meta_description, pb.canonical_url,
            pb.breadcrumb_path,
            wb.page_type, wb.target_url
     FROM page_blueprints pb
     JOIN work_backlog wb ON pb.backlog_id = wb.id
     WHERE pb.site_id = ?
     ORDER BY wb.priority ASC`
  ),

  getBlueprintById: db.prepare<[number]>(
    `SELECT pb.id, pb.backlog_id, pb.site_id,
            pb.working_title, pb.meta_description, pb.canonical_url,
            pb.breadcrumb_path,
            wb.page_type, wb.target_url
     FROM page_blueprints pb
     JOIN work_backlog wb ON pb.backlog_id = wb.id
     WHERE pb.id = ?`
  ),

  getSite: db.prepare<[number]>(
    `SELECT id, name, url FROM sites WHERE id = ?`
  ),

  updateSchemaSpec: db.prepare<[string, number]>(
    `UPDATE page_blueprints SET schema_spec = ? WHERE id = ?`
  ),
};

// ── Main Functions ──────────────────────────────────────────────────────────

/**
 * Generate JSON-LD specs for all blueprints belonging to a site.
 * Updates the schema_spec column on each page_blueprint row.
 */
export function generateJsonLdSpecs(siteId: number): JsonLdSpecResult {
  const blueprints = stmts.getBlueprintsWithType.all(siteId) as BlueprintWithType[];

  if (blueprints.length === 0) {
    return { siteId, blueprintsUpdated: 0, specsByPageType: {} };
  }

  const site = stmts.getSite.get(siteId) as SiteRow | undefined;
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  const result: JsonLdSpecResult = {
    siteId,
    blueprintsUpdated: 0,
    specsByPageType: {},
  };

  const generate = db.transaction(() => {
    for (const bp of blueprints) {
      const spec = buildJsonLdSpec(bp, site);
      stmts.updateSchemaSpec.run(JSON.stringify(spec), bp.id);

      result.blueprintsUpdated++;
      result.specsByPageType[bp.page_type] =
        (result.specsByPageType[bp.page_type] || 0) + 1;
    }
  });

  generate();
  return result;
}

/**
 * Generate a JSON-LD spec for a single blueprint.
 * Returns the spec object (does NOT persist — caller decides).
 */
export function generateJsonLdSpec(blueprintId: number): object {
  const bp = stmts.getBlueprintById.get(blueprintId) as BlueprintWithType | undefined;
  if (!bp) {
    throw new Error(`Blueprint ${blueprintId} not found`);
  }

  const site = stmts.getSite.get(bp.site_id) as SiteRow | undefined;
  if (!site) {
    throw new Error(`Site ${bp.site_id} not found`);
  }

  return buildJsonLdSpec(bp, site);
}

/**
 * Retrieve the current schema_spec values for all blueprints belonging to a site.
 */
export function getJsonLdSpecs(siteId: number): Array<{
  blueprintId: number;
  pageType: string;
  targetUrl: string | null;
  schemaSpec: object | null;
}> {
  const rows = db
    .prepare<[number]>(
      `SELECT pb.id, pb.schema_spec, wb.page_type, wb.target_url
       FROM page_blueprints pb
       JOIN work_backlog wb ON pb.backlog_id = wb.id
       WHERE pb.site_id = ?
       ORDER BY wb.priority ASC`
    )
    .all(siteId) as Array<{
      id: number;
      schema_spec: string | null;
      page_type: string;
      target_url: string | null;
    }>;

  return rows.map((r) => ({
    blueprintId: r.id,
    pageType: r.page_type,
    targetUrl: r.target_url,
    schemaSpec: r.schema_spec ? JSON.parse(r.schema_spec) : null,
  }));
}

// ── Spec Builders ───────────────────────────────────────────────────────────

/**
 * Build the JSON-LD spec for a single blueprint based on its page type.
 */
function buildJsonLdSpec(
  bp: BlueprintWithType,
  site: SiteRow
): object {
  const siteUrl = (site.url || '').replace(/\/$/, '');
  const pageUrl = bp.canonical_url || bp.target_url || siteUrl;
  const siteName = site.name || 'Site';

  switch (bp.page_type) {
    case 'homepage':
      return buildHomepageSpec(siteUrl, siteName, pageUrl);
    case 'service':
      return buildServicePageSpec(siteUrl, siteName, pageUrl, bp);
    case 'location':
      return buildLocationPageSpec(siteUrl, siteName, pageUrl, bp);
    default:
      // For page types without a specific spec (about, faq, contact, etc.),
      // produce a minimal WebPage + BreadcrumbList spec
      return buildGenericPageSpec(siteUrl, siteName, pageUrl, bp);
  }
}

/**
 * Homepage JSON-LD: Organization + WebSite + BreadcrumbList
 */
function buildHomepageSpec(
  siteUrl: string,
  siteName: string,
  pageUrl: string
): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['AutomotiveBusiness', 'EducationalOrganization'],
        '@id': `${siteUrl}/#organization`,
        name: siteName,
        url: siteUrl,
        telephone: '{{phone}}',
        address: {
          '@type': 'PostalAddress',
          addressLocality: '{{city}}',
          addressRegion: '{{state}}',
          addressCountry: 'AU',
        },
        areaServed: { '@type': 'City', name: '{{city}}' },
        priceRange: '$$',
        sameAs: ['{{googleMapsUrl}}', '{{facebookUrl}}'],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: siteName,
        url: siteUrl,
        publisher: { '@id': `${siteUrl}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ],
      },
    ],
  };
}

/**
 * Service page JSON-LD: Service + BreadcrumbList + FAQPage placeholder
 */
function buildServicePageSpec(
  siteUrl: string,
  siteName: string,
  pageUrl: string,
  bp: BlueprintWithType
): object {
  const serviceName = extractServiceName(bp);
  const serviceType = serviceName; // serviceType mirrors the inferred service name

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${pageUrl}/#service`,
        name: serviceName,
        description: bp.meta_description || `${serviceName}`,
        provider: { '@id': `${siteUrl}/#organization` },
        areaServed: { '@type': 'City', name: '{{city}}' },
        serviceType,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: serviceName, item: pageUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}/#faq`,
        mainEntity: '{{PLACEHOLDER_FAQ_QUESTIONS}}',
      },
    ],
  };
}

/**
 * Location page JSON-LD: AutomotiveBusiness (local) + BreadcrumbList + FAQPage placeholder
 */
function buildLocationPageSpec(
  siteUrl: string,
  siteName: string,
  pageUrl: string,
  bp: BlueprintWithType
): object {
  const suburb = extractSuburb(bp);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AutomotiveBusiness',
        '@id': `${pageUrl}/#local-business`,
        name: `${siteName} - ${suburb}`,
        url: pageUrl,
        parentOrganization: { '@id': `${siteUrl}/#organization` },
        areaServed: {
          '@type': 'City',
          name: suburb,
          containedInPlace: {
            '@type': 'AdministrativeArea',
            name: '{{state}}',
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Areas', item: `${siteUrl}/areas` },
          { '@type': 'ListItem', position: 3, name: suburb, item: pageUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}/#faq`,
        mainEntity: '{{PLACEHOLDER_FAQ_QUESTIONS}}',
      },
    ],
  };
}

/**
 * Generic page JSON-LD (about, faq, contact, etc.): WebPage + BreadcrumbList
 */
function buildGenericPageSpec(
  siteUrl: string,
  siteName: string,
  pageUrl: string,
  bp: BlueprintWithType
): object {
  const pageName = bp.working_title || titleCase(bp.page_type);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}/#webpage`,
        name: pageName,
        url: pageUrl,
        isPartOf: { '@id': `${siteUrl}/#website` },
        about: { '@id': `${siteUrl}/#organization` },
        description: bp.meta_description || pageName,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: pageName, item: pageUrl },
        ],
      },
    ],
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a human-readable service name from the blueprint.
 */
function extractServiceName(bp: BlueprintWithType): string {
  // Prefer working_title if it looks like a service name
  if (bp.working_title && !bp.working_title.includes(' - ')) {
    return bp.working_title;
  }

  // Fall back to parsing the URL
  if (bp.target_url) {
    const segments = bp.target_url.replace(/https?:\/\/[^/]+/, '').split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      return titleCase(last.replace(/\.(html|htm)$/i, '').replace(/-/g, ' '));
    }
  }

  // Extract from working title before the dash
  if (bp.working_title) {
    const parts = bp.working_title.split(' - ');
    return parts[0].trim();
  }

  return 'Driving Lessons';
}

/**
 * Extract a suburb name from the blueprint for location pages.
 */
function extractSuburb(bp: BlueprintWithType): string {
  // Parse from URL
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

  // Extract from working title ("Driving Lessons in Suburb - Location Page")
  if (bp.working_title) {
    const match = bp.working_title.match(/in\s+(.+?)(?:\s*-|$)/i);
    if (match) return match[1].trim();
  }

  return '{{suburb}}';
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
