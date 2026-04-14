/**
 * GEO Readiness Auditor (WRK-BCE2-015)
 *
 * Assesses each page's readiness for AI citation / Generative Engine Optimization.
 * Scoring based on the Princeton GEO Study factors:
 *   - Direct Answer Block (20%)
 *   - TLDR-First Structure (15%)
 *   - FAQ Content (15%)
 *   - Statistics Density (20%) — largest single GEO gain factor (+41%)
 *   - Freshness Signals (15%)
 *   - Named Authorship (10%)
 *   - Citation Readiness (5%)
 *
 * Works entirely from database data — no HTTP requests.
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoAuditDetails {
  directAnswerScore: number;       // 0-1
  tldrFirstScore: number;          // 0-1
  faqScore: number;                // 0-1
  statisticsScore: number;         // 0-1
  freshnessScore: number;          // 0-1
  authorshipScore: number;         // 0-1
  citationReadinessScore: number;  // 0-1
}

export interface GeoAuditResult {
  structureMapId: number;
  siteId: number;
  geoScore: number;            // 0.0-1.0 weighted composite
  deficiencies: string[];      // Actionable GEO issues
  details: GeoAuditDetails;
}

// ---------------------------------------------------------------------------
// Weight configuration (must sum to 1.0)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  directAnswer: 0.20,
  tldrFirst: 0.15,
  faq: 0.15,
  statistics: 0.20,
  freshness: 0.15,
  authorship: 0.10,
  citationReadiness: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Database statements
// ---------------------------------------------------------------------------

const getContentAuditForPage = db.prepare(`
  SELECT ca.*, ssm.url, ssm.page_type, ssm.word_count
  FROM content_audit ca
  JOIN site_structure_map ssm ON ssm.id = ca.structure_map_id
  WHERE ca.structure_map_id = ? AND ca.site_id = ?
`);

const getContentAuditForSite = db.prepare(`
  SELECT ca.*, ssm.url, ssm.page_type, ssm.word_count
  FROM content_audit ca
  JOIN site_structure_map ssm ON ssm.id = ca.structure_map_id
  WHERE ca.site_id = ?
`);

const updateGeoScore = db.prepare(`
  UPDATE content_audit
  SET geo_score = ?, geo_deficiencies = ?
  WHERE structure_map_id = ? AND site_id = ?
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags and decode common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

/**
 * 1. Direct Answer Block (20%)
 * First paragraph should be a self-contained 40-60 word answer.
 */
function scoreDirectAnswer(
  hasDirectAnswerBlock: boolean,
  mainContent: string,
  mainContentHtml: string
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];

  if (!hasDirectAnswerBlock) {
    deficiencies.push(
      'No direct answer block found — add a 40-60 word self-contained answer in the first paragraph that an AI could extract and cite without surrounding context.'
    );
    return { score: 0, deficiencies };
  }

  // Check the first paragraph's word count
  const firstParagraphMatch = mainContentHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!firstParagraphMatch) {
    deficiencies.push(
      'Direct answer block detected but no clear first paragraph found — wrap the opening answer in a <p> tag.'
    );
    return { score: 0.3, deficiencies };
  }

  const firstParagraphText = stripHtml(firstParagraphMatch[1]);
  const fpWordCount = wordCount(firstParagraphText);

  if (fpWordCount >= 40 && fpWordCount <= 60) {
    return { score: 1.0, deficiencies };
  }

  if (fpWordCount < 40) {
    deficiencies.push(
      `First paragraph is only ${fpWordCount} words — expand to 40-60 words for optimal AI citation extraction.`
    );
    return { score: 0.5, deficiencies };
  }

  // Too long (> 60 words)
  deficiencies.push(
    `First paragraph is ${fpWordCount} words — trim to 40-60 words for a concise, citable direct answer block.`
  );
  return { score: 0.5, deficiencies };
}

/**
 * 2. TLDR-First Structure (15%)
 * First 200 words should provide a complete answer to the primary query.
 */
function scoreTldrFirst(
  mainContent: string,
  hasDirectAnswerBlock: boolean
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];
  const words = mainContent.split(/\s+/);
  const first200 = words.slice(0, 200).join(' ').toLowerCase();

  if (words.length < 50) {
    deficiencies.push(
      'Page content is very thin — add substantive content in the first 200 words that directly answers the page\'s primary query.'
    );
    return { score: 0, deficiencies };
  }

  let score = 0;

  // Check for key information signals in the first 200 words
  const hasDefinition = /\b(is a|is an|are a|refers to|means|defined as)\b/.test(first200);
  const hasSpecifics = /\d/.test(first200); // Contains numbers/data
  const hasBenefit = /\b(benefit|advantage|help|improve|save|reduce|increase)\b/.test(first200);
  const hasAction = /\b(call|book|contact|schedule|visit|get)\b/.test(first200);

  if (hasDefinition) score += 0.3;
  if (hasSpecifics) score += 0.3;
  if (hasBenefit || hasAction) score += 0.2;
  if (hasDirectAnswerBlock) score += 0.2;

  score = clamp01(score);

  if (score < 0.5) {
    deficiencies.push(
      'First 200 words do not front-load key information — restructure to answer the primary query upfront with definitions, specific data, and clear benefits.'
    );
  } else if (score < 0.8) {
    deficiencies.push(
      'First 200 words partially answer the primary query — add more specific data points or a clearer definition to strengthen the TLDR-first structure.'
    );
  }

  return { score, deficiencies };
}

/**
 * 3. FAQ Content (15%)
 * Has FAQ section with 3-5+ questions, each with 40-80 word answers.
 */
function scoreFaq(
  hasFaqContent: boolean,
  sections: Array<{ type: string; heading?: string; wordCount: number; html: string }>
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];

  if (!hasFaqContent) {
    deficiencies.push(
      'No FAQ section found — add a "Frequently Asked Questions" section with 3-5 questions phrased as users/AI would ask them, each answered in 40-80 words with specific facts.'
    );
    return { score: 0, deficiencies };
  }

  // Find FAQ sections and count questions
  const faqSections = sections.filter((s) => s.type === 'faq');
  if (faqSections.length === 0) {
    // hasFaqContent is true but no typed sections — partial detection
    deficiencies.push(
      'FAQ content detected but not well-structured — use clear heading hierarchy and Q&A format for better AI parsing.'
    );
    return { score: 0.3, deficiencies };
  }

  // Count question patterns in FAQ sections
  let questionCount = 0;
  for (const section of faqSections) {
    const html = section.html.toLowerCase();
    // Count h3/h4 headings (each is likely a question)
    const headingMatches = html.match(/<h[34]\b[^>]*>/gi) || [];
    // Count <dt> elements (definition list Q&A)
    const dtMatches = html.match(/<dt\b/gi) || [];
    // Count <summary> elements (accordion Q&A)
    const summaryMatches = html.match(/<summary\b/gi) || [];
    // Count "Q:" patterns
    const qPatterns = html.match(/\bq\s*[:\.]/gi) || [];

    questionCount += headingMatches.length + dtMatches.length + summaryMatches.length + qPatterns.length;
  }

  // If no sub-questions found, estimate from word count
  if (questionCount === 0) {
    const totalFaqWords = faqSections.reduce((sum, s) => sum + s.wordCount, 0);
    questionCount = Math.max(1, Math.floor(totalFaqWords / 80)); // rough estimate
  }

  let score = 0;

  if (questionCount >= 5) {
    score = 1.0;
  } else if (questionCount >= 3) {
    score = 0.7;
    deficiencies.push(
      `FAQ has ${questionCount} questions — add ${5 - questionCount} more for optimal GEO coverage (target 5+).`
    );
  } else {
    score = 0.4;
    deficiencies.push(
      `FAQ has only ${questionCount} question(s) — expand to at least 3-5 questions with 40-80 word answers containing specific facts.`
    );
  }

  return { score, deficiencies };
}

/**
 * 4. Statistics Density (20%) — Single largest GEO gain factor (+41%)
 * Optimal: >= 1 statistic per 200 words.
 */
function scoreStatistics(
  statisticsCount: number,
  totalWordCount: number
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];

  if (totalWordCount === 0) {
    deficiencies.push('No content found — cannot evaluate statistics density.');
    return { score: 0, deficiencies };
  }

  if (statisticsCount === 0) {
    deficiencies.push(
      'No statistics or data points found — adding statistics is the single largest GEO gain factor (+41% visibility). Include percentages, dollar amounts, year counts, or other numeric claims with cited sources.'
    );
    return { score: 0, deficiencies };
  }

  // Optimal: 1 statistic per 200 words
  const expectedStats = totalWordCount / 200;
  const density = statisticsCount / expectedStats;
  const score = clamp01(density);

  if (score < 0.5) {
    const needed = Math.ceil(expectedStats) - statisticsCount;
    deficiencies.push(
      `Only ${statisticsCount} statistic(s) found in ${totalWordCount} words — add ${needed} more data points (target: 1 per 200 words). Statistics boost AI citation by +41%.`
    );
  } else if (score < 1.0) {
    const needed = Math.ceil(expectedStats) - statisticsCount;
    deficiencies.push(
      `${statisticsCount} statistic(s) found but density is below optimal — add ${needed} more for 1 per 200 words. Cite sources for each statistic.`
    );
  }

  return { score, deficiencies };
}

/**
 * 5. Freshness Signals (15%)
 * Has visible date, references current year, content feels current.
 */
function scoreFreshness(
  freshnessDate: string | null,
  mainContent: string
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];
  let score = 0;
  const currentYear = new Date().getFullYear().toString();
  const lastYear = (new Date().getFullYear() - 1).toString();

  // Check freshness_date column
  if (freshnessDate) {
    score += 0.4;
  } else {
    deficiencies.push(
      'No visible "last updated" or publication date found — add a visible date to signal content freshness to AI engines.'
    );
  }

  // Check for current/recent year references
  const contentLower = mainContent.toLowerCase();
  if (contentLower.includes(currentYear)) {
    score += 0.4;
  } else if (contentLower.includes(lastYear)) {
    score += 0.2;
    deficiencies.push(
      `Content references ${lastYear} but not ${currentYear} — update year references to signal current relevance.`
    );
  } else {
    deficiencies.push(
      `No current year (${currentYear}) references found — include current year in statistics, updates, or date references.`
    );
  }

  // Check for temporal freshness language
  const freshnessPatterns = /\b(latest|updated|new|recent|current|today|this year|modern)\b/i;
  if (freshnessPatterns.test(contentLower)) {
    score += 0.2;
  } else {
    deficiencies.push(
      'No temporal freshness language found — use terms like "latest," "updated," or "current" to signal content recency.'
    );
  }

  return { score: clamp01(score), deficiencies };
}

/**
 * 6. Named Authorship (10%)
 * Named authors are cited 2.3x more than anonymous content.
 */
function scoreAuthorship(
  mainContent: string,
  mainContentHtml: string
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];
  const contentLower = mainContentHtml.toLowerCase();

  // Check for author patterns
  const hasAuthorByline =
    /\b(written by|author|by\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\b/i.test(mainContent) ||
    /class\s*=\s*["'][^"']*author[^"']*["']/i.test(mainContentHtml) ||
    /rel\s*=\s*["']author["']/i.test(mainContentHtml) ||
    /itemprop\s*=\s*["']author["']/i.test(mainContentHtml);

  // Check for author schema in JSON-LD (stored in extracted_content)
  const hasAuthorMeta =
    contentLower.includes('"author"') ||
    contentLower.includes("'author'");

  if (hasAuthorByline) {
    return { score: 1.0, deficiencies };
  }

  if (hasAuthorMeta) {
    deficiencies.push(
      'Author metadata found but no visible byline — add a visible "Written by [Name]" byline. Named authors are cited 2.3x more by AI.'
    );
    return { score: 0.5, deficiencies };
  }

  deficiencies.push(
    'No author attribution found — add a visible author byline (e.g., "Written by [Name], [Title]"). Named content is cited 2.3x more by AI engines.'
  );
  return { score: 0, deficiencies };
}

/**
 * 7. Citation Readiness (5%)
 * Content has clear, extractable claims stated declaratively.
 */
function scoreCitationReadiness(
  mainContent: string
): { score: number; deficiencies: string[] } {
  const deficiencies: string[] = [];
  let score = 0;

  // Check for declarative statements (not hedged)
  const hedgeWords = /\b(maybe|perhaps|might|could possibly|it seems|we think|probably|arguably)\b/gi;
  const hedgeMatches = mainContent.match(hedgeWords) || [];
  const words = mainContent.split(/\s+/).length;

  // Hedging ratio
  const hedgeRatio = words > 0 ? hedgeMatches.length / (words / 100) : 0;

  if (hedgeRatio < 0.5) {
    score += 0.4; // Low hedging — good
  } else {
    deficiencies.push(
      `Content uses ${hedgeMatches.length} hedging words (e.g., "maybe," "probably") — state facts declaratively for stronger AI citation readiness.`
    );
  }

  // Check for clearly extractable claims (sentences with numbers or definitive statements)
  const sentences = mainContent.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const declarativeSentences = sentences.filter((s) => {
    const trimmed = s.trim();
    // Contains a number or strong claim language
    return (
      /\d/.test(trimmed) ||
      /\b(is|are|was|were|provides|offers|includes|ensures|delivers|guarantees)\b/i.test(trimmed)
    );
  });

  const declarativeRatio = sentences.length > 0 ? declarativeSentences.length / sentences.length : 0;

  if (declarativeRatio >= 0.5) {
    score += 0.6;
  } else if (declarativeRatio >= 0.3) {
    score += 0.3;
    deficiencies.push(
      'Content could be more declarative — rephrase qualifying statements as clear factual claims for better AI extractability.'
    );
  } else {
    deficiencies.push(
      'Low citation readiness — content lacks clear, extractable claims. Rewrite key sentences as declarative facts with specific data.'
    );
  }

  return { score: clamp01(score), deficiencies };
}

// ---------------------------------------------------------------------------
// Core Audit Function
// ---------------------------------------------------------------------------

interface ContentAuditRow {
  id: number;
  structure_map_id: number;
  site_id: number;
  extracted_content: string | null;
  sections: string | null;
  ctas: string | null;
  has_direct_answer_block: number;
  has_faq_content: number;
  statistics_count: number;
  freshness_date: string | null;
  url: string;
  page_type: string | null;
  word_count: number | null;
}

function auditFromRow(row: ContentAuditRow): GeoAuditResult {
  // Parse stored content
  const extractedContent = row.extracted_content ? JSON.parse(row.extracted_content) : {};
  const sections = row.sections ? JSON.parse(row.sections) : [];

  const mainContent: string = extractedContent.mainContent || '';
  const mainContentHtml: string = extractedContent.mainContentHtml || '';
  const totalWordCount = extractedContent.wordCount || row.word_count || wordCount(mainContent);

  // Run each scoring component
  const directAnswer = scoreDirectAnswer(
    row.has_direct_answer_block === 1,
    mainContent,
    mainContentHtml
  );

  const tldrFirst = scoreTldrFirst(
    mainContent,
    row.has_direct_answer_block === 1
  );

  const faq = scoreFaq(
    row.has_faq_content === 1,
    sections
  );

  const statistics = scoreStatistics(
    row.statistics_count,
    totalWordCount
  );

  const freshness = scoreFreshness(
    row.freshness_date,
    mainContent
  );

  const authorship = scoreAuthorship(
    mainContent,
    mainContentHtml
  );

  const citationReadiness = scoreCitationReadiness(mainContent);

  // Weighted composite score
  const geoScore = Number((
    directAnswer.score * WEIGHTS.directAnswer +
    tldrFirst.score * WEIGHTS.tldrFirst +
    faq.score * WEIGHTS.faq +
    statistics.score * WEIGHTS.statistics +
    freshness.score * WEIGHTS.freshness +
    authorship.score * WEIGHTS.authorship +
    citationReadiness.score * WEIGHTS.citationReadiness
  ).toFixed(3));

  // Collect all deficiencies
  const deficiencies = [
    ...directAnswer.deficiencies,
    ...tldrFirst.deficiencies,
    ...faq.deficiencies,
    ...statistics.deficiencies,
    ...freshness.deficiencies,
    ...authorship.deficiencies,
    ...citationReadiness.deficiencies,
  ];

  const details: GeoAuditDetails = {
    directAnswerScore: directAnswer.score,
    tldrFirstScore: tldrFirst.score,
    faqScore: faq.score,
    statisticsScore: statistics.score,
    freshnessScore: freshness.score,
    authorshipScore: authorship.score,
    citationReadinessScore: citationReadiness.score,
  };

  return {
    structureMapId: row.structure_map_id,
    siteId: row.site_id,
    geoScore,
    deficiencies,
    details,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Audit GEO readiness for a single page.
 * Reads from content_audit, scores, and updates geo_score + geo_deficiencies.
 */
export async function auditPageGeo(
  structureMapId: number,
  siteId: number
): Promise<GeoAuditResult> {
  const row = getContentAuditForPage.get(structureMapId, siteId) as ContentAuditRow | undefined;

  if (!row) {
    return {
      structureMapId,
      siteId,
      geoScore: 0,
      deficiencies: [
        `No content_audit data found for structure_map_id=${structureMapId}, site_id=${siteId}. Run content scraper (WRK-011) first.`,
      ],
      details: {
        directAnswerScore: 0,
        tldrFirstScore: 0,
        faqScore: 0,
        statisticsScore: 0,
        freshnessScore: 0,
        authorshipScore: 0,
        citationReadinessScore: 0,
      },
    };
  }

  const result = auditFromRow(row);

  // Persist to database
  updateGeoScore.run(
    result.geoScore,
    JSON.stringify(result.deficiencies),
    structureMapId,
    siteId
  );

  return result;
}

/**
 * Audit GEO readiness for all content-scraped pages of a site.
 * Returns results for every page and updates the database.
 */
export async function auditSiteGeo(siteId: number): Promise<GeoAuditResult[]> {
  const rows = getContentAuditForSite.all(siteId) as ContentAuditRow[];

  if (rows.length === 0) {
    return [];
  }

  const results: GeoAuditResult[] = [];

  const updateMany = db.transaction(() => {
    for (const row of rows) {
      const result = auditFromRow(row);
      updateGeoScore.run(
        result.geoScore,
        JSON.stringify(result.deficiencies),
        row.structure_map_id,
        row.site_id
      );
      results.push(result);
    }
  });

  updateMany();

  return results;
}
