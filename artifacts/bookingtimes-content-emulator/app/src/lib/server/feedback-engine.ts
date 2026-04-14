/**
 * Feedback Engine — WRK-BCE2-041
 *
 * Human-in-the-loop feedback system that learns from operator approvals,
 * refinements, and rejections to improve brand profiles over time.
 *
 * Three actions:
 *   approve  — marks section as approved, stores positive example, boosts confidence
 *   reject   — marks section as rejected, stores negative example, creates anti-pattern rule
 *   refine   — stores feedback, creates brand rule, resets section for regeneration
 *
 * Brand evolution is tracked via brand_profile_history snapshots.
 * Per-site isolation: voice NEVER transfers between sites.
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SectionSpecRow {
  id: number;
  blueprint_id: number;
  section_type: string;
  generated_html: string | null;
  status: string;
}

interface BlueprintRow {
  id: number;
  site_id: number;
}

interface BrandProfileRow {
  id: number;
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
}

interface PageBlueprintRow {
  page_type: string | null;
}

export interface BrandEvolutionEntry {
  date: string;
  change: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve sectionSpecId → SectionSpecRow, or throw. */
function getSectionSpec(sectionSpecId: number): SectionSpecRow {
  const row = db
    .prepare('SELECT id, blueprint_id, section_type, generated_html, status FROM section_specs WHERE id = ?')
    .get(sectionSpecId) as SectionSpecRow | undefined;

  if (!row) {
    throw new Error(`Section spec ${sectionSpecId} not found`);
  }
  return row;
}

/** Resolve blueprint → site_id. */
function getSiteIdFromBlueprint(blueprintId: number): number {
  const row = db
    .prepare('SELECT site_id FROM page_blueprints WHERE id = ?')
    .get(blueprintId) as BlueprintRow | undefined;

  if (!row) {
    throw new Error(`Blueprint ${blueprintId} not found`);
  }
  return row.site_id;
}

/** Get page_type for a blueprint. */
function getPageTypeFromBlueprint(blueprintId: number): string | null {
  const row = db
    .prepare(
      `SELECT wb.page_type FROM work_backlog wb
       JOIN page_blueprints pb ON pb.backlog_id = wb.id
       WHERE pb.id = ?`
    )
    .get(blueprintId) as PageBlueprintRow | undefined;

  return row?.page_type ?? null;
}

/** Get brand profile row for a site, or null. */
function getBrandProfileRow(siteId: number): BrandProfileRow | null {
  return (
    (db
      .prepare('SELECT * FROM brand_profiles WHERE site_id = ?')
      .get(siteId) as BrandProfileRow | undefined) ?? null
  );
}

/** Snapshot the current brand profile before modification. */
function snapshotBrandProfile(siteId: number, changeReason: string, changedBy: string): void {
  const profile = getBrandProfileRow(siteId);
  if (!profile) return;

  const snapshot = JSON.stringify({
    voice_description: profile.voice_description,
    tone_keywords: profile.tone_keywords,
    terminology_patterns: profile.terminology_patterns,
    sentence_style: profile.sentence_style,
    recurring_phrases: profile.recurring_phrases,
    anti_patterns: profile.anti_patterns,
    target_audience: profile.target_audience,
    key_differentiators: profile.key_differentiators,
    brand_personality: profile.brand_personality,
    inference_confidence: profile.inference_confidence,
  });

  db.prepare(
    `INSERT INTO brand_profile_history (brand_profile_id, snapshot, change_reason, changed_by)
     VALUES (?, ?, ?, ?)`
  ).run(profile.id, snapshot, changeReason, changedBy);
}

/** Extract CSS class names from an HTML string. */
function extractCssClasses(html: string): string[] {
  const classRegex = /class="([^"]*)"/g;
  const classes = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(html)) !== null) {
    match[1].split(/\s+/).forEach((c) => {
      if (c) classes.add(c);
    });
  }
  return Array.from(classes);
}

/** Classify feedback text into a brand_rules category. */
function classifyFeedbackCategory(
  feedback: string
): 'voice' | 'structure' | 'terminology' | 'visual' | 'seo' | 'geo' {
  const lower = feedback.toLowerCase();

  if (/\b(tone|voice|personality|formal|informal|friendly|professional)\b/.test(lower)) {
    return 'voice';
  }
  if (/\b(heading|layout|order|section|structure|paragraph|format)\b/.test(lower)) {
    return 'structure';
  }
  if (/\b(word|term|phrase|jargon|language|wording|terminology|call it|say)\b/.test(lower)) {
    return 'terminology';
  }
  if (/\b(color|font|style|css|spacing|margin|padding|design|visual)\b/.test(lower)) {
    return 'visual';
  }
  if (/\b(seo|keyword|meta|title tag|search)\b/.test(lower)) {
    return 'seo';
  }
  if (/\b(geo|local|location|city|region|address)\b/.test(lower)) {
    return 'geo';
  }

  // Default to voice — the most common feedback type
  return 'voice';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Approve a generated section.
 *
 * 1. Sets section_specs.status = 'approved'
 * 2. Stores HTML as a positive brand_example
 * 3. Records CSS patterns used
 * 4. Increments brand_profiles.inference_confidence by +0.02 (capped at 1.0)
 * 5. Snapshots brand profile history
 */
export function approveSection(sectionSpecId: number, qualityRating?: number): void {
  const spec = getSectionSpec(sectionSpecId);
  const siteId = getSiteIdFromBlueprint(spec.blueprint_id);
  const pageType = getPageTypeFromBlueprint(spec.blueprint_id);

  const run = db.transaction(() => {
    // 1. Update status
    db.prepare('UPDATE section_specs SET status = ? WHERE id = ?').run('approved', sectionSpecId);

    // 2. Store as positive brand example
    if (spec.generated_html) {
      db.prepare(
        `INSERT INTO brand_examples (site_id, section_type, page_type, html_content, quality_rating, is_negative, source)
         VALUES (?, ?, ?, ?, ?, 0, 'generated_approved')`
      ).run(
        siteId,
        spec.section_type,
        pageType,
        spec.generated_html,
        qualityRating ?? null
      );

      // 3. Record CSS patterns
      const classes = extractCssClasses(spec.generated_html);
      if (classes.length > 0) {
        // Upsert: try to increment usage_count for existing pattern, or insert new
        const existingPattern = db
          .prepare(
            `SELECT id, usage_count FROM css_patterns
             WHERE site_id = ? AND section_types LIKE ? AND classes_used = ?`
          )
          .get(siteId, `%${spec.section_type}%`, JSON.stringify(classes)) as
          | { id: number; usage_count: number }
          | undefined;

        if (existingPattern) {
          db.prepare('UPDATE css_patterns SET usage_count = ? WHERE id = ?').run(
            existingPattern.usage_count + 1,
            existingPattern.id
          );
        } else {
          db.prepare(
            `INSERT INTO css_patterns (site_id, pattern_name, description, classes_used, section_types, page_types, quality_rating, usage_count, html_snippet)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
          ).run(
            siteId,
            `${spec.section_type}-approved`,
            `CSS pattern from approved ${spec.section_type} section`,
            JSON.stringify(classes),
            JSON.stringify([spec.section_type]),
            pageType ? JSON.stringify([pageType]) : null,
            qualityRating ?? null,
            spec.generated_html.substring(0, 500)
          );
        }
      }
    }

    // 4. Increment confidence
    const profile = getBrandProfileRow(siteId);
    if (profile) {
      // Snapshot before modification
      snapshotBrandProfile(siteId, `Section ${sectionSpecId} approved`, 'feedback');

      const newConfidence = Math.min(1.0, (profile.inference_confidence ?? 0) + 0.02);
      db.prepare(
        `UPDATE brand_profiles SET inference_confidence = ?, updated_at = datetime('now') WHERE site_id = ?`
      ).run(newConfidence, siteId);
    }
  });

  run();
}

/**
 * Reject a generated section.
 *
 * 1. Sets section_specs.status = 'rejected'
 * 2. Stores HTML as a negative brand_example
 * 3. Creates anti-pattern rule in brand_rules
 * 4. Snapshots brand profile history
 */
export function rejectSection(sectionSpecId: number, reason: string): void {
  const spec = getSectionSpec(sectionSpecId);
  const siteId = getSiteIdFromBlueprint(spec.blueprint_id);
  const pageType = getPageTypeFromBlueprint(spec.blueprint_id);

  const run = db.transaction(() => {
    // 1. Update status
    db.prepare('UPDATE section_specs SET status = ? WHERE id = ?').run('rejected', sectionSpecId);

    // 2. Store as negative example
    if (spec.generated_html) {
      db.prepare(
        `INSERT INTO brand_examples (site_id, section_type, page_type, html_content, quality_rating, is_negative, notes, source)
         VALUES (?, ?, ?, ?, 1, 1, ?, 'generated_rejected')`
      ).run(siteId, spec.section_type, pageType, spec.generated_html, reason);
    }

    // 3. Create anti-pattern rule
    db.prepare(
      `INSERT INTO brand_rules (site_id, category, rule_text, source, scope, section_type, active)
       VALUES (?, 'anti-pattern', ?, 'feedback', 'section_type', ?, 1)`
    ).run(siteId, reason, spec.section_type);

    // 4. Snapshot
    snapshotBrandProfile(siteId, `Section ${sectionSpecId} rejected: ${reason}`, 'feedback');
  });

  run();
}

/**
 * Refine a generated section (request regeneration with feedback).
 *
 * 1. Stores feedback in section_specs.last_feedback
 * 2. Classifies feedback and creates a brand_rules entry
 * 3. Resets status to 'pending' for regeneration
 * 4. Snapshots brand profile history
 */
export function refineSection(sectionSpecId: number, feedback: string): void {
  const spec = getSectionSpec(sectionSpecId);
  const siteId = getSiteIdFromBlueprint(spec.blueprint_id);

  const category = classifyFeedbackCategory(feedback);

  const run = db.transaction(() => {
    // 1. Store feedback and reset status
    db.prepare(
      `UPDATE section_specs SET last_feedback = ?, status = 'pending' WHERE id = ?`
    ).run(feedback, sectionSpecId);

    // 2. Create brand rule from feedback
    db.prepare(
      `INSERT INTO brand_rules (site_id, category, rule_text, source, scope, section_type, active)
       VALUES (?, ?, ?, 'feedback', 'section_type', ?, 1)`
    ).run(siteId, category, feedback, spec.section_type);

    // 3. Snapshot
    snapshotBrandProfile(siteId, `Section ${sectionSpecId} refinement: ${feedback}`, 'feedback');
  });

  run();
}

/**
 * Get brand profile evolution history for a site.
 *
 * Returns chronological list of changes made to the brand profile,
 * derived from brand_profile_history snapshots.
 */
export function getBrandEvolution(siteId: number): BrandEvolutionEntry[] {
  const profile = getBrandProfileRow(siteId);
  if (!profile) return [];

  const rows = db
    .prepare(
      `SELECT created_at, change_reason, snapshot
       FROM brand_profile_history
       WHERE brand_profile_id = ?
       ORDER BY created_at ASC`
    )
    .all(profile.id) as Array<{
    created_at: string;
    change_reason: string | null;
    snapshot: string;
  }>;

  return rows.map((row) => ({
    date: row.created_at,
    change: summarizeSnapshotChange(row.snapshot),
    reason: row.change_reason ?? 'unknown',
  }));
}

// ---------------------------------------------------------------------------
// Snapshot diff helper
// ---------------------------------------------------------------------------

/** Produce a human-readable summary of what a profile snapshot contains. */
function summarizeSnapshotChange(snapshotJson: string): string {
  try {
    const snapshot = JSON.parse(snapshotJson);
    const fields = Object.keys(snapshot).filter(
      (k) => snapshot[k] !== null && snapshot[k] !== ''
    );
    return `Profile state captured (${fields.length} fields populated, confidence: ${snapshot.inference_confidence ?? 'N/A'})`;
  } catch {
    return 'Profile snapshot recorded';
  }
}
