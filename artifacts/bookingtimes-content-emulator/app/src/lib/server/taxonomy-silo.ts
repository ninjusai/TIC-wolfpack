/**
 * Page Taxonomy & Silo Definitions Service
 *
 * Codifies the Hybrid Two-Page Model taxonomy and silo strategy.
 * - Page taxonomy defines page types, hierarchy, required sections, schema types
 * - Silo definitions establish content silos with linking policies per site
 * - Generation ordering rules stored as benchmark_standard
 *
 * Architecture: Service Pages (3-6) + Location Pages (50+), NO service x location matrix.
 * Three silos: services, locations, trust.
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PageTaxonomyEntry {
  id: number;
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
  created_at: string;
}

export interface SiloDefinition {
  id: number;
  site_id: number;
  silo_name: string;
  description: string;
  hub_page_type: string;
  hub_url: string | null;
  internal_linking_policy: string;
  cross_silo_links: string[];
  created_at: string;
}

// ── Page Taxonomy Data ──────────────────────────────────────────────────────

interface TaxonomyInput {
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

const PAGE_TAXONOMY: TaxonomyInput[] = [
  {
    page_type: 'homepage',
    hierarchy_level: 0,
    display_name: 'Homepage',
    h1_pattern: '[Brand Name] - [Location] Driving School',
    required_sections: [
      'hero',
      'services_overview',
      'why_choose_us',
      'testimonials',
      'service_areas',
      'faq',
      'cta'
    ],
    optional_sections: ['statistics', 'instructor_intro', 'recent_news'],
    target_word_count_min: 500,
    target_word_count_max: 1500,
    primary_keyword_pattern: null,
    schema_types: ['AutomotiveBusiness', 'WebSite', 'BreadcrumbList', 'FAQPage'],
    silo: null,
    geo_requirements: null
  },
  {
    page_type: 'service',
    hierarchy_level: 1,
    display_name: 'Service Page',
    h1_pattern: '[Service Name] in [City/Region]',
    required_sections: [
      'hero',
      'service_detail',
      'benefits',
      'process',
      'pricing_overview',
      'faq',
      'cta'
    ],
    optional_sections: ['testimonials', 'related_services', 'service_areas'],
    target_word_count_min: 800,
    target_word_count_max: 2000,
    primary_keyword_pattern: null,
    schema_types: ['Service', 'BreadcrumbList', 'FAQPage', 'Offer'],
    silo: 'services',
    geo_requirements: null
  },
  {
    page_type: 'location',
    hierarchy_level: 3,
    display_name: 'Location/Suburb Page',
    h1_pattern: 'Driving Lessons in [Suburb]',
    required_sections: [
      'hero',
      'local_intro',
      'services_available',
      'why_local',
      'nearby_areas',
      'faq',
      'cta'
    ],
    optional_sections: ['local_landmarks', 'test_centre_info', 'local_testimonials'],
    target_word_count_min: 600,
    target_word_count_max: 1500,
    primary_keyword_pattern: 'driving lessons [suburb]',
    schema_types: ['AutomotiveBusiness', 'BreadcrumbList', 'FAQPage'],
    silo: 'locations',
    geo_requirements: {
      direct_answer_block: true,
      faq_count: 3,
      stat_frequency: '1 per 200 words'
    }
  },
  {
    page_type: 'about',
    hierarchy_level: 1,
    display_name: 'About Page',
    h1_pattern: null,
    required_sections: ['hero', 'story', 'team', 'values', 'credentials', 'cta'],
    optional_sections: [],
    target_word_count_min: 400,
    target_word_count_max: 1000,
    primary_keyword_pattern: null,
    schema_types: ['AutomotiveBusiness', 'BreadcrumbList'],
    silo: 'trust',
    geo_requirements: null
  },
  {
    page_type: 'faq',
    hierarchy_level: 2,
    display_name: 'FAQ Page',
    h1_pattern: null,
    required_sections: ['hero', 'faq_categories'],
    optional_sections: [],
    target_word_count_min: 500,
    target_word_count_max: 2000,
    primary_keyword_pattern: null,
    schema_types: ['FAQPage', 'BreadcrumbList'],
    silo: 'trust',
    geo_requirements: null
  },
  {
    page_type: 'contact',
    hierarchy_level: 2,
    display_name: 'Contact Page',
    h1_pattern: null,
    required_sections: ['hero', 'contact_form', 'map', 'hours', 'phone'],
    optional_sections: [],
    target_word_count_min: 200,
    target_word_count_max: 500,
    primary_keyword_pattern: null,
    schema_types: ['AutomotiveBusiness', 'BreadcrumbList'],
    silo: 'trust',
    geo_requirements: null
  }
];

// ── Silo Data ───────────────────────────────────────────────────────────────

interface SiloInput {
  silo_name: string;
  description: string;
  hub_page_type: string;
  internal_linking_policy: string;
  cross_silo_links: string[];
}

const SILO_TEMPLATES: SiloInput[] = [
  {
    silo_name: 'services',
    description: 'Core service offerings',
    hub_page_type: 'homepage',
    internal_linking_policy:
      'All service pages link to homepage. Services link to related services. Services link to 3-5 relevant location pages.',
    cross_silo_links: [
      'locations (via relevant suburb mentions)',
      'trust (via about/FAQ links)'
    ]
  },
  {
    silo_name: 'locations',
    description: 'Suburb and area pages',
    hub_page_type: 'homepage',
    internal_linking_policy:
      'All location pages link to homepage. Location pages link to 3-5 nearest locations. Location pages link to relevant service pages.',
    cross_silo_links: [
      'services (via service mentions)',
      'trust (via testimonial/FAQ links)'
    ]
  },
  {
    silo_name: 'trust',
    description: 'Trust and authority pages',
    hub_page_type: 'about',
    internal_linking_policy:
      'About, FAQ, contact, testimonials interlink. All link back to homepage.',
    cross_silo_links: [
      'services (via service references)',
      'locations (via area references)'
    ]
  }
];

// ── Generation Order Benchmark ──────────────────────────────────────────────

const GENERATION_ORDER = {
  order: ['homepage', 'service', 'about', 'faq', 'contact', 'location'],
  rules: [
    'Homepage always first per site (DEC-031)',
    'Service pages before location pages',
    'Hub pages before children',
    'Within locations: batch after 3-5 individually approved'
  ]
};

// ── Seed Functions ──────────────────────────────────────────────────────────

/**
 * Seed all page taxonomy entries into the page_taxonomy table.
 * Idempotent — uses INSERT OR REPLACE keyed on page_type (UNIQUE).
 */
export function seedPageTaxonomy(): { inserted: number } {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO page_taxonomy
      (page_type, hierarchy_level, display_name, h1_pattern,
       required_sections, optional_sections,
       target_word_count_min, target_word_count_max,
       primary_keyword_pattern, schema_types, silo, geo_requirements)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  const seed = db.transaction(() => {
    for (const entry of PAGE_TAXONOMY) {
      stmt.run(
        entry.page_type,
        entry.hierarchy_level,
        entry.display_name,
        entry.h1_pattern,
        JSON.stringify(entry.required_sections),
        JSON.stringify(entry.optional_sections),
        entry.target_word_count_min,
        entry.target_word_count_max,
        entry.primary_keyword_pattern,
        JSON.stringify(entry.schema_types),
        entry.silo,
        entry.geo_requirements ? JSON.stringify(entry.geo_requirements) : null
      );
      inserted++;
    }
  });

  seed();

  // Also seed the generation_order benchmark standard
  seedGenerationOrder();

  return { inserted };
}

/**
 * Seed the generation ordering rules as a benchmark_standard.
 */
function seedGenerationOrder(): void {
  const selectStmt = db.prepare(
    "SELECT id FROM benchmark_standards WHERE category = 'page_type' AND key = 'generation_order'"
  );
  const insertStmt = db.prepare(
    'INSERT INTO benchmark_standards (category, key, value, source) VALUES (?, ?, ?, ?)'
  );
  const updateStmt = db.prepare(
    'UPDATE benchmark_standards SET value = ?, source = ? WHERE category = ? AND key = ?'
  );

  const existing = selectStmt.get() as { id: number } | undefined;
  const jsonValue = JSON.stringify(GENERATION_ORDER);

  if (existing) {
    updateStmt.run(jsonValue, 'manual', 'page_type', 'generation_order');
  } else {
    insertStmt.run('page_type', 'generation_order', jsonValue, 'manual');
  }
}

/**
 * Seed silo definitions for a specific site.
 * Idempotent — uses INSERT OR REPLACE keyed on (site_id, silo_name) UNIQUE.
 */
export function seedSiloDefinitions(siteId: number): { inserted: number } {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO silo_definitions
      (site_id, silo_name, description, hub_page_type, internal_linking_policy, cross_silo_links)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  const seed = db.transaction(() => {
    for (const silo of SILO_TEMPLATES) {
      stmt.run(
        siteId,
        silo.silo_name,
        silo.description,
        silo.hub_page_type,
        silo.internal_linking_policy,
        JSON.stringify(silo.cross_silo_links)
      );
      inserted++;
    }
  });

  seed();
  return { inserted };
}

// ── Query Functions ─────────────────────────────────────────────────────────

/**
 * Retrieve all page taxonomy entries from the database.
 */
export function getPageTaxonomy(): PageTaxonomyEntry[] {
  const rows = db
    .prepare(
      `SELECT id, page_type, hierarchy_level, display_name, h1_pattern,
              required_sections, optional_sections,
              target_word_count_min, target_word_count_max,
              primary_keyword_pattern, schema_types, silo, geo_requirements,
              created_at
       FROM page_taxonomy
       ORDER BY hierarchy_level, page_type`
    )
    .all() as Array<{
    id: number;
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
    created_at: string;
  }>;

  return rows.map((row) => ({
    ...row,
    required_sections: JSON.parse(row.required_sections),
    optional_sections: JSON.parse(row.optional_sections),
    schema_types: JSON.parse(row.schema_types),
    geo_requirements: row.geo_requirements ? JSON.parse(row.geo_requirements) : null
  }));
}

/**
 * Retrieve silo definitions for a specific site.
 */
export function getSiloDefinitions(siteId: number): SiloDefinition[] {
  const rows = db
    .prepare(
      `SELECT id, site_id, silo_name, description, hub_page_type, hub_url,
              internal_linking_policy, cross_silo_links, created_at
       FROM silo_definitions
       WHERE site_id = ?
       ORDER BY silo_name`
    )
    .all(siteId) as Array<{
    id: number;
    site_id: number;
    silo_name: string;
    description: string;
    hub_page_type: string;
    hub_url: string | null;
    internal_linking_policy: string;
    cross_silo_links: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    ...row,
    cross_silo_links: JSON.parse(row.cross_silo_links)
  }));
}
