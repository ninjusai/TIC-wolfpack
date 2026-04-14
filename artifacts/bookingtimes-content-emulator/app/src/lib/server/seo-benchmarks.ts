/**
 * SEO Benchmark Standards Service
 *
 * Codifies domain-wide SEO benchmark rules into the benchmark_standards table.
 * These benchmarks define what "good" looks like for SEO across all page types
 * in the driving school domain. They are shared across all sites (no site_id).
 */

import db from '$lib/db';

interface BenchmarkStandard {
  category: 'page_type' | 'seo' | 'geo' | 'schema' | 'content' | 'linking';
  key: string;
  value: Record<string, unknown>;
  source: string;
}

const SEO_BENCHMARKS: BenchmarkStandard[] = [
  // ── Category: seo ──────────────────────────────────────────
  {
    category: 'seo',
    key: 'title_tag_rules',
    value: {
      maxLength: 60,
      formulas: {
        homepage: '[Brand Name] - [Primary Differentiator] | [Location]',
        service: '[Service] in [Location] | [Brand] - [Differentiator]',
        location: '[Service] [Suburb/City] | [Brand] - Driving School',
        about: 'About [Brand] | [Location] Driving School',
        faq: '[Topic] FAQ | [Brand] - [Location]'
      },
      requirements: [
        'primary keyword front-loaded',
        'unique per page',
        'brand name included'
      ]
    },
    source: 'manual'
  },
  {
    category: 'seo',
    key: 'meta_description_rules',
    value: {
      minLength: 150,
      maxLength: 160,
      requirements: [
        'include CTA',
        'include USP',
        'include location',
        'unique per page'
      ],
      templates: {
        homepage: '[Brand] offers [services] in [location]. [USP]. [CTA].',
        service: '[Service] in [location] with [Brand]. [USP]. [CTA] today!',
        location:
          'Driving lessons in [suburb] with [Brand]. [Local detail]. [CTA].',
        about:
          "Meet [Brand], [location]'s [differentiator]. [Experience]. [CTA]."
      }
    },
    source: 'manual'
  },
  {
    category: 'seo',
    key: 'heading_hierarchy_rules',
    value: {
      h1: { count: 1, requirements: ['primary keyword', 'unique per page'] },
      levels: 'never skip levels (H1->H3 without H2)',
      h2: 'major page sections',
      h3: 'subsections within H2'
    },
    source: 'manual'
  },
  {
    category: 'seo',
    key: 'content_uniqueness_rules',
    value: {
      locationPages: {
        minUniquePercentage: 40,
        targetUniquePercentage: 50
      },
      note: 'Location pages sharing boilerplate must have 40-50% unique content per page'
    },
    source: 'manual'
  },
  {
    category: 'seo',
    key: 'canonical_rules',
    value: {
      selfReferencing: true,
      mustMatchSitemap: true,
      neverCanonicalizeLocationToMaster: true
    },
    source: 'manual'
  },
  {
    category: 'seo',
    key: 'eeat_signals',
    value: {
      requirements: {
        homepage: [
          'business history',
          'credentials',
          'team info',
          'testimonials'
        ],
        service: [
          'instructor qualifications',
          'pass rates',
          'methodology'
        ],
        location: [
          'local knowledge',
          'local testimonials',
          'suburb-specific detail'
        ]
      },
      authorshipRequired: true,
      lastUpdatedRequired: true
    },
    source: 'manual'
  },
  {
    category: 'seo',
    key: 'image_optimization',
    value: {
      altText: 'descriptive with keywords, not just filename',
      format: 'WebP preferred',
      heroMax: '100KB',
      lazyLoad: 'below fold',
      widthHeight: 'required on all images'
    },
    source: 'manual'
  },
  {
    category: 'seo',
    key: 'mobile_first',
    value: {
      touchTargets: '48x48px minimum',
      baseFontSize: '16px minimum',
      clickToCall: true,
      clickToMap: true
    },
    source: 'manual'
  },

  // ── Category: content ──────────────────────────────────────
  {
    category: 'content',
    key: 'word_count_targets',
    value: {
      homepage: { min: 500, max: 1500, target: 800 },
      service: { min: 800, max: 2000, target: 1200 },
      location: { min: 600, max: 1500, target: 900 },
      about: { min: 400, max: 1000, target: 600 },
      faq: { min: 500, max: 2000, target: 1000 }
    },
    source: 'manual'
  },

  // ── Category: linking ──────────────────────────────────────
  {
    category: 'linking',
    key: 'internal_linking_rules',
    value: {
      contextualLinksPerPage: {
        min: 2,
        max: 5,
        perThousandWords: '2-5'
      },
      maxLinksPerPage: 150,
      anchorDistribution: {
        descriptiveKeyword: '30-40%',
        partialMatch: '20-30%',
        branded: '20-30%',
        generic: '10-20%'
      },
      orphanThreshold: 2,
      maxClicksFromHome: 3
    },
    source: 'manual'
  }
];

/**
 * Seed all SEO benchmark standards into the benchmark_standards table.
 * Idempotent — uses INSERT OR REPLACE keyed on (category, key).
 *
 * Note: The table has a UNIQUE constraint implicitly handled by OR REPLACE
 * on the combination we target. Since the schema doesn't have a UNIQUE on
 * (category, key), we first check existence and update or insert accordingly.
 */
export function seedSeoBenchmarks(): { inserted: number } {
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
    for (const benchmark of SEO_BENCHMARKS) {
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
 * Retrieve all SEO-related benchmark standards from the database.
 * Returns benchmarks across categories: seo, content, linking.
 */
export function getSeoBenchmarks(): Array<{
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
       WHERE category IN ('seo', 'content', 'linking')
       ORDER BY category, key`
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
