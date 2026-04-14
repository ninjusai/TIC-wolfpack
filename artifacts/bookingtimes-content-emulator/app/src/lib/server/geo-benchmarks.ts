/**
 * GEO Benchmark Seeder (WRK-BCE2-018)
 *
 * Codifies GEO optimization benchmarks into the benchmark_standards table.
 * These are domain-wide standards (no site_id) based on the Princeton GEO Study
 * (ACM KDD 2024) and related research.
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Benchmark definitions
// ---------------------------------------------------------------------------

const GEO_BENCHMARKS: Array<{ key: string; value: object }> = [
  {
    key: 'direct_answer_block',
    value: {
      wordCount: { min: 40, max: 60 },
      requirements: [
        'self-contained answer to primary query',
        'no need for surrounding context',
        'factual and specific',
        'placed in first paragraph',
      ],
      pageTypes: ['homepage', 'service', 'location', 'faq'],
    },
  },
  {
    key: 'tldr_first',
    value: {
      firstWordsTarget: 200,
      requirements: [
        'complete answer to primary query in first 200 words',
        'key facts and numbers front-loaded',
        'not just an introduction but the actual answer',
      ],
      citationZone: '44.2% of ChatGPT citations come from first 30% of page',
    },
  },
  {
    key: 'faq_format',
    value: {
      questionCount: { min: 3, max: 5 },
      answerWordCount: { min: 40, max: 80 },
      requirements: [
        'questions phrased as AI assistant queries',
        'answers contain specific facts',
        'each answer self-contained',
      ],
      pageTypes: ['service', 'location'],
    },
  },
  {
    key: 'statistics_frequency',
    value: {
      minPerWords: 200,
      description: 'At least 1 statistic or data point per 200 words',
      improvement: '+41% visibility (largest single GEO gain factor)',
      requirements: [
        'cite source of statistics',
        'use specific numbers not vague claims',
        'embed naturally in content',
      ],
      source: 'Princeton GEO Study (ACM KDD 2024)',
    },
  },
  {
    key: 'freshness_signals',
    value: {
      requirements: [
        'visible last-updated date on page',
        'current year references',
        'recent statistics and data',
      ],
      staleThreshold: { aging: '6 weeks', stale: '10 weeks' },
      updateFrequency: 'ad hoc, ~2 month cycles (DEC-033)',
    },
  },
  {
    key: 'named_authorship',
    value: {
      requirement: 'named author byline on all content pages',
      benefit: 'named authors cited 2.3x more than anonymous content',
      format: 'Author name + credentials/role',
    },
  },
  {
    key: 'citation_optimization',
    value: {
      techniques: [
        { name: 'statistics_addition', improvement: '+41%', description: 'Embed data every 150-200 words' },
        { name: 'quotation_addition', improvement: '+28%', description: 'Include expert quotes' },
        { name: 'citation_of_sources', improvement: '+115% (lower-ranked)', description: 'Cite credible sources' },
        { name: 'fluency_optimization', improvement: '+15-30%', description: 'Smooth readable prose' },
        { name: 'faq_content', improvement: 'top-5 correlated', description: 'Q&A pairs' },
      ],
      source: 'Princeton GEO Study (ACM KDD 2024)',
    },
  },
  {
    key: 'platform_specific',
    value: {
      google_ai_overviews: 'uses Gemini, pulls from top-ranked content, favors structured data',
      chatgpt: '44.2% citations from first 30% of page, favors statistics and clear claims',
      perplexity: 'heavy source attribution, favors fresh content with dates',
      claude: 'prefers well-structured factual content with citations',
      note: 'optimize for ChatGPT/Perplexity first as they cite most explicitly',
    },
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

/**
 * Insert all GEO benchmarks into the benchmark_standards table.
 * Uses INSERT OR IGNORE to avoid duplicates on re-run.
 * Returns the count of newly inserted rows.
 */
export function seedGeoBenchmarks(): { inserted: number } {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO benchmark_standards (category, key, value, source)
     VALUES ('geo', ?, ?, 'research')`
  );

  const runAll = db.transaction(() => {
    let inserted = 0;
    for (const benchmark of GEO_BENCHMARKS) {
      const result = insert.run(benchmark.key, JSON.stringify(benchmark.value));
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });

  const inserted = runAll();
  return { inserted };
}

/**
 * Retrieve all GEO benchmarks from the database.
 */
export function getGeoBenchmarks(): Array<{
  id: number;
  category: string;
  key: string;
  value: unknown;
  source: string | null;
  created_at: string;
}> {
  const rows = db
    .prepare(
      `SELECT id, category, key, value, source, created_at
       FROM benchmark_standards
       WHERE category = 'geo'
       ORDER BY id`
    )
    .all() as Array<{
      id: number;
      category: string;
      key: string;
      value: string;
      source: string | null;
      created_at: string;
    }>;

  return rows.map((row) => ({
    ...row,
    value: JSON.parse(row.value),
  }));
}
