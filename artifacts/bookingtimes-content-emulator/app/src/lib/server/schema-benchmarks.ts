/**
 * Schema.org Benchmark Standards Service
 *
 * Codifies domain-wide Schema.org structured data benchmark rules into the
 * benchmark_standards table. These benchmarks define the @graph/@id pattern
 * and per-page-type schema requirements for automotive businesses (driving schools).
 *
 * Key decision: AutomotiveBusiness (NOT DrivingSchool) per Google's recommendation
 * for driving instruction businesses.
 *
 * These are shared across all sites (no site_id).
 */

import db from '$lib/db';

interface BenchmarkStandard {
  category: 'page_type' | 'seo' | 'geo' | 'schema' | 'content' | 'linking';
  key: string;
  value: Record<string, unknown>;
  source: string;
}

const SCHEMA_BENCHMARKS: BenchmarkStandard[] = [
  {
    category: 'schema',
    key: 'primary_type',
    value: {
      type: 'AutomotiveBusiness',
      note: 'NOT DrivingSchool — Google recommends AutomotiveBusiness for driving instruction businesses',
      multiTyping: ['AutomotiveBusiness', 'EducationalOrganization'],
      multiTypingNote:
        'Multi-Typed Entity allowed for driving schools that emphasize education'
    },
    source: 'industry_standard'
  },
  {
    category: 'schema',
    key: 'graph_pattern',
    value: {
      pattern: '@graph with @id references',
      idConvention: 'URL + hash fragment (e.g., https://example.com/#organization)',
      singleBlock: true,
      note: "One <script type='application/ld+json'> block per page with @graph array"
    },
    source: 'industry_standard'
  },
  {
    category: 'schema',
    key: 'mandatory_baseline',
    value: {
      allPages: ['Organization/@id', 'WebSite/@id', 'BreadcrumbList'],
      note: 'Every page must reference the Organization and WebSite via @id, and include a BreadcrumbList'
    },
    source: 'industry_standard'
  },
  {
    category: 'schema',
    key: 'homepage_schema',
    value: {
      required: [
        'AutomotiveBusiness (full)',
        'WebSite with SearchAction',
        'BreadcrumbList'
      ],
      automotiveBusiness: {
        required: [
          'name',
          'url',
          'telephone',
          'address',
          'areaServed',
          'openingHoursSpecification',
          'priceRange',
          'image',
          'logo',
          'sameAs'
        ],
        recommended: [
          'aggregateRating',
          'review',
          'hasOfferCatalog',
          'description',
          'foundingDate',
          'numberOfEmployees'
        ]
      },
      webSite: {
        required: ['name', 'url', 'potentialAction (SearchAction)'],
        searchAction: {
          target: 'https://example.com/search?q={search_term_string}',
          queryInput: 'required name=search_term_string'
        }
      },
      sameAs: [
        'Google Maps URL',
        'Facebook',
        'Instagram',
        'LinkedIn',
        'Yellow Pages AU'
      ]
    },
    source: 'industry_standard'
  },
  {
    category: 'schema',
    key: 'service_page_schema',
    value: {
      required: ['Service', 'BreadcrumbList'],
      optional: ['FAQPage', 'Offer'],
      service: {
        required: [
          'name',
          'description',
          'provider (@id ref to Organization)',
          'areaServed'
        ],
        recommended: [
          'offers (Offer with price, priceCurrency)',
          'serviceType',
          'category'
        ]
      },
      faqPage: {
        required: ['mainEntity (array of Question)'],
        question: [
          'name (question text)',
          'acceptedAnswer.text (answer text)'
        ],
        constraint: 'FAQ JSON-LD must EXACTLY match visible FAQ HTML content'
      }
    },
    source: 'industry_standard'
  },
  {
    category: 'schema',
    key: 'location_page_schema',
    value: {
      required: ['AutomotiveBusiness (with areaServed)', 'BreadcrumbList'],
      optional: ['FAQPage'],
      automotiveBusiness: {
        areaServed: {
          type: 'City or AdministrativeArea',
          required: ['name', 'geo (GeoCoordinates)']
        },
        note: 'Location page AutomotiveBusiness references parent Organization via @id but adds specific areaServed'
      }
    },
    source: 'industry_standard'
  },
  {
    category: 'schema',
    key: 'sameAs_disambiguation',
    value: {
      purpose:
        'Link entity to authoritative external profiles for disambiguation',
      required: ['Google Maps listing URL'],
      recommended: [
        'Facebook page',
        'Instagram profile',
        'LinkedIn company page',
        'Yellow Pages AU listing'
      ],
      note: 'sameAs helps AI engines confirm entity identity across platforms'
    },
    source: 'industry_standard'
  },
  {
    category: 'schema',
    key: 'validation_rules',
    value: {
      syntaxRules: [
        'valid JSON',
        'parseable by JSON.parse()',
        "placed in <script type='application/ld+json'>"
      ],
      contentAlignment:
        'every claim in schema must match visible page content',
      faqAlignment:
        'FAQ Question names and Answer texts must exactly match visible HTML FAQ',
      noHiddenContent:
        'schema must not contain information not visible on the page',
      tools: [
        'Google Rich Results Test',
        'Schema Markup Validator',
        'JSON-LD Playground'
      ]
    },
    source: 'industry_standard'
  }
];

/**
 * Seed all Schema.org benchmark standards into the benchmark_standards table.
 * Idempotent — checks existence before inserting or updating.
 */
export function seedSchemaBenchmarks(): { inserted: number } {
  const selectStmt = db.prepare(
    'SELECT id FROM benchmark_standards WHERE category = ? AND key = ?'
  );
  const insertStmt = db.prepare(
    'INSERT INTO benchmark_standards (category, key, value, source) VALUES (?, ?, ?, ?)'
  );
  const updateStmt = db.prepare(
    'UPDATE benchmark_standards SET value = ?, source = ? WHERE category = ? AND key = ?'
  );

  let inserted = 0;

  const seed = db.transaction(() => {
    for (const benchmark of SCHEMA_BENCHMARKS) {
      const existing = selectStmt.get(benchmark.category, benchmark.key) as
        | { id: number }
        | undefined;

      const jsonValue = JSON.stringify(benchmark.value);

      if (existing) {
        updateStmt.run(jsonValue, benchmark.source, benchmark.category, benchmark.key);
      } else {
        insertStmt.run(benchmark.category, benchmark.key, jsonValue, benchmark.source);
      }
      inserted++;
    }
  });

  seed();
  return { inserted };
}

/**
 * Retrieve all schema-related benchmark standards from the database.
 */
export function getSchemaBenchmarks(): Array<{
  id: number;
  category: string;
  key: string;
  value: Record<string, unknown>;
  source: string;
  created_at: string;
}> {
  const rows = db
    .prepare(
      `SELECT id, category, key, value, source, created_at
       FROM benchmark_standards
       WHERE category = 'schema'
       ORDER BY key`
    )
    .all() as Array<{
    id: number;
    category: string;
    key: string;
    value: string;
    source: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    ...row,
    value: JSON.parse(row.value)
  }));
}
