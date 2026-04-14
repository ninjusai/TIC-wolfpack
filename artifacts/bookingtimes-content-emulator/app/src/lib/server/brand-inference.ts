/**
 * Brand Voice Inference Engine — WRK-BCE2-012
 *
 * Uses scraped content from content_audit to infer brand voice via Claude CLI.
 * Stores structured brand profiles in the brand_profiles table.
 *
 * Three-phase lifecycle (ADR-015):
 *   Phase 1 — Extraction: Scrape → Claude inference → structured profile (this module)
 *   Phase 2 — Confirmation: Operator reviews and confirms profile
 *   Phase 3 — Enrichment: Approved sections feed back into the profile (Stage 5)
 */

import db from '$lib/db';
import { callClaude } from '$lib/server/claude-cli';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandProfile {
  siteId: number;
  voiceDescription: string;
  toneKeywords: string[];
  terminologyPatterns: Array<{ use: string; avoid: string }>;
  sentenceStyle: string;
  recurringPhrases: string[];
  antiPatterns: string[];
  targetAudience?: string;
  keyDifferentiators?: string;
  brandPersonality?: string;
  inferenceConfidence: number; // 0.0–1.0, based on source_page_count
  sourcePageCount: number;
  userConfirmed?: boolean;
}

interface ContentAuditRow {
  extracted_content: string | null;
  sections: string | null;
  ctas: string | null;
  url: string | null;
}

interface BrandProfileRow {
  site_id: number;
  voice_description: string | null;
  tone_keywords: string | null;
  terminology_patterns: string | null;
  sentence_style: string | null;
  recurring_phrases: string | null;
  anti_patterns: string | null;
  target_audience: string | null;
  key_differentiators: string | null;
  brand_personality: string | null;
  inference_confidence: number | null;
  source_page_count: number | null;
  user_confirmed: number;
}

interface ClaudeProfileResponse {
  voiceDescription?: string;
  toneKeywords?: string[];
  terminologyPatterns?: Array<{ use: string; avoid: string }>;
  sentenceStyle?: string;
  recurringPhrases?: string[];
  antiPatterns?: string[];
  targetAudience?: string;
  keyDifferentiators?: string;
  brandPersonality?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max words per page excerpt sent to Claude */
const MAX_WORDS_PER_PAGE = 2000;

/** Pages needed for full confidence */
const FULL_CONFIDENCE_PAGE_COUNT = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate text to approximately N words. */
function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

/** Safely parse a JSON string, returning fallback on failure. */
function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Extract JSON from a Claude response that might contain markdown fences. */
function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a JSON object directly
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return text;
}

// ---------------------------------------------------------------------------
// Core: Inference
// ---------------------------------------------------------------------------

/**
 * Infer brand voice from scraped content for a given site.
 *
 * 1. Gathers content_audit rows for the site
 * 2. Builds a Claude prompt with extracted content
 * 3. Calls Claude CLI to produce a structured brand profile
 * 4. Stores the result in brand_profiles
 */
export async function inferBrandVoice(siteId: number): Promise<BrandProfile> {
  // --- Validate site exists ---
  const site = db
    .prepare('SELECT id, name, url FROM sites WHERE id = ?')
    .get(siteId) as { id: number; name: string; url: string } | undefined;

  if (!site) {
    throw new Error(`Site with id ${siteId} not found`);
  }

  // --- Gather content audit data ---
  const auditRows = db
    .prepare(
      `SELECT ca.extracted_content, ca.sections, ca.ctas, ssm.url
       FROM content_audit ca
       JOIN site_structure_map ssm ON ssm.id = ca.structure_map_id
       WHERE ca.site_id = ?`
    )
    .all(siteId) as ContentAuditRow[];

  if (auditRows.length === 0) {
    throw new Error(
      `No content audit data found for site ${siteId}. ` +
        'Run content scraping first (POST /api/content-scrape/:siteId).'
    );
  }

  const sourcePageCount = auditRows.length;
  const inferenceConfidence = Math.min(1.0, sourcePageCount / FULL_CONFIDENCE_PAGE_COUNT);

  // --- Build page excerpts ---
  const pageExcerpts = auditRows
    .filter((row) => row.extracted_content)
    .map((row, i) => {
      const content = truncateToWords(row.extracted_content!, MAX_WORDS_PER_PAGE);
      const sections = safeJsonParse<unknown[]>(row.sections, []);
      const ctas = safeJsonParse<unknown[]>(row.ctas, []);

      let excerpt = `--- Page ${i + 1}: ${row.url || 'Unknown URL'} ---\n${content}`;
      if (sections.length > 0) {
        excerpt += `\n\nSections: ${JSON.stringify(sections)}`;
      }
      if (ctas.length > 0) {
        excerpt += `\nCTAs: ${JSON.stringify(ctas)}`;
      }
      return excerpt;
    });

  // --- Build Claude prompt ---
  const prompt = `Analyze the following content from "${site.name}" (${site.url}) and extract a brand voice profile.

Content from ${sourcePageCount} pages:

${pageExcerpts.join('\n\n')}

Analyze this content and produce a JSON object with these fields:
- voiceDescription: 1-2 sentence summary of the brand's voice
- toneKeywords: array of 5-10 adjectives describing the tone
- terminologyPatterns: array of {use, avoid} pairs for brand-specific terminology
- sentenceStyle: description of typical sentence structure
- recurringPhrases: array of phrases that appear frequently
- antiPatterns: array of things the brand avoids (e.g., "never uses slang")
- targetAudience: who the content is written for (1 sentence)
- keyDifferentiators: what makes this brand's voice unique (1 sentence)
- brandPersonality: the brand's personality in 1-2 sentences

Respond with ONLY the JSON object, no other text.`;

  // --- Call Claude ---
  const result = await callClaude(prompt, {
    timeoutMs: 180_000, // 3 minutes — analysis can be lengthy
    maxRetries: 2,
  });

  if (!result.success) {
    throw new Error(`Claude CLI call failed: ${result.error || 'unknown error'}`);
  }

  // --- Parse response ---
  const jsonText = extractJson(result.response);
  let parsed: ClaudeProfileResponse;
  try {
    parsed = JSON.parse(jsonText) as ClaudeProfileResponse;
  } catch {
    throw new Error(
      `Failed to parse Claude response as JSON. Raw response (first 500 chars): ${result.response.slice(0, 500)}`
    );
  }

  // --- Build profile ---
  const profile: BrandProfile = {
    siteId,
    voiceDescription: parsed.voiceDescription || '',
    toneKeywords: Array.isArray(parsed.toneKeywords) ? parsed.toneKeywords : [],
    terminologyPatterns: Array.isArray(parsed.terminologyPatterns)
      ? parsed.terminologyPatterns
      : [],
    sentenceStyle: parsed.sentenceStyle || '',
    recurringPhrases: Array.isArray(parsed.recurringPhrases) ? parsed.recurringPhrases : [],
    antiPatterns: Array.isArray(parsed.antiPatterns) ? parsed.antiPatterns : [],
    targetAudience: parsed.targetAudience || undefined,
    keyDifferentiators: parsed.keyDifferentiators || undefined,
    brandPersonality: parsed.brandPersonality || undefined,
    inferenceConfidence,
    sourcePageCount,
    userConfirmed: false,
  };

  // --- Store in database (INSERT OR REPLACE for idempotent re-runs) ---
  db.prepare(
    `INSERT OR REPLACE INTO brand_profiles
       (site_id, voice_description, tone_keywords, terminology_patterns,
        sentence_style, recurring_phrases, anti_patterns,
        target_audience, key_differentiators, brand_personality,
        user_confirmed, inference_confidence, source_page_count,
        updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`
  ).run(
    siteId,
    profile.voiceDescription,
    JSON.stringify(profile.toneKeywords),
    JSON.stringify(profile.terminologyPatterns),
    profile.sentenceStyle,
    JSON.stringify(profile.recurringPhrases),
    JSON.stringify(profile.antiPatterns),
    profile.targetAudience || null,
    profile.keyDifferentiators || null,
    profile.brandPersonality || null,
    profile.inferenceConfidence,
    profile.sourcePageCount
  );

  // --- Log AI session ---
  const sessionResult = db
    .prepare(
      `INSERT INTO ai_sessions (site_id, session_type, status, created_at)
       VALUES (?, 'brand_inference', 'completed', datetime('now'))`
    )
    .run(siteId);

  db.prepare(
    `INSERT INTO ai_turns
       (session_id, turn_number, prompt_text, response_text, duration_ms, status, created_at)
     VALUES (?, 1, ?, ?, ?, 'complete', datetime('now'))`
  ).run(
    sessionResult.lastInsertRowid,
    prompt.slice(0, 10000), // Truncate very long prompts for storage
    result.response.slice(0, 10000),
    result.durationMs
  );

  return profile;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Retrieve the current brand profile for a site, or null if none exists.
 */
export function getBrandProfile(siteId: number): BrandProfile | null {
  const row = db
    .prepare('SELECT * FROM brand_profiles WHERE site_id = ?')
    .get(siteId) as BrandProfileRow | undefined;

  if (!row) return null;

  return {
    siteId: row.site_id,
    voiceDescription: row.voice_description || '',
    toneKeywords: safeJsonParse<string[]>(row.tone_keywords, []),
    terminologyPatterns: safeJsonParse<Array<{ use: string; avoid: string }>>(
      row.terminology_patterns,
      []
    ),
    sentenceStyle: row.sentence_style || '',
    recurringPhrases: safeJsonParse<string[]>(row.recurring_phrases, []),
    antiPatterns: safeJsonParse<string[]>(row.anti_patterns, []),
    targetAudience: row.target_audience || undefined,
    keyDifferentiators: row.key_differentiators || undefined,
    brandPersonality: row.brand_personality || undefined,
    inferenceConfidence: row.inference_confidence ?? 0,
    sourcePageCount: row.source_page_count ?? 0,
    userConfirmed: row.user_confirmed === 1,
  };
}

/**
 * Update specific fields of a brand profile (operator edits).
 */
export function updateBrandProfile(
  siteId: number,
  updates: Partial<BrandProfile>
): void {
  const existing = getBrandProfile(siteId);
  if (!existing) {
    throw new Error(`No brand profile exists for site ${siteId}`);
  }

  // --- Snapshot current state before update ---
  const profileRow = db
    .prepare('SELECT id FROM brand_profiles WHERE site_id = ?')
    .get(siteId) as { id: number } | undefined;

  if (profileRow) {
    db.prepare(
      `INSERT INTO brand_profile_history
         (brand_profile_id, snapshot, change_reason, changed_by, created_at)
       VALUES (?, ?, 'user_edit', 'user_edit', datetime('now'))`
    ).run(profileRow.id, JSON.stringify(existing));
  }

  // --- Merge updates ---
  const merged: BrandProfile = { ...existing, ...updates, siteId };

  db.prepare(
    `UPDATE brand_profiles
     SET voice_description = ?,
         tone_keywords = ?,
         terminology_patterns = ?,
         sentence_style = ?,
         recurring_phrases = ?,
         anti_patterns = ?,
         target_audience = ?,
         key_differentiators = ?,
         brand_personality = ?,
         updated_at = datetime('now')
     WHERE site_id = ?`
  ).run(
    merged.voiceDescription,
    JSON.stringify(merged.toneKeywords),
    JSON.stringify(merged.terminologyPatterns),
    merged.sentenceStyle,
    JSON.stringify(merged.recurringPhrases),
    JSON.stringify(merged.antiPatterns),
    merged.targetAudience || null,
    merged.keyDifferentiators || null,
    merged.brandPersonality || null,
    siteId
  );
}

/**
 * Mark a brand profile as confirmed by the operator.
 */
export function confirmBrandProfile(siteId: number): void {
  const existing = getBrandProfile(siteId);
  if (!existing) {
    throw new Error(`No brand profile exists for site ${siteId}`);
  }

  // Snapshot before confirmation
  const profileRow = db
    .prepare('SELECT id FROM brand_profiles WHERE site_id = ?')
    .get(siteId) as { id: number } | undefined;

  if (profileRow) {
    db.prepare(
      `INSERT INTO brand_profile_history
         (brand_profile_id, snapshot, change_reason, changed_by, created_at)
       VALUES (?, ?, 'profile_confirmed', 'approval', datetime('now'))`
    ).run(profileRow.id, JSON.stringify(existing));
  }

  db.prepare(
    `UPDATE brand_profiles
     SET user_confirmed = 1, updated_at = datetime('now')
     WHERE site_id = ?`
  ).run(siteId);
}
