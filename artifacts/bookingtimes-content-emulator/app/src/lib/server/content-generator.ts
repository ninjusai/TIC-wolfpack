/**
 * Section-Based Content Generation Service — WRK-BCE2-035
 *
 * Generates HTML content section-by-section via Claude CLI calls,
 * using the 12-layer prompt assembler. Sequential within a page —
 * each section needs previous sections as context (Layer 9).
 *
 * Flow per section:
 *   1. assembleSectionPrompt(sectionSpecId)
 *   2. callClaude(prompt)
 *   3. Store result in section_specs.generated_html
 *   4. Update status + attempt count
 *   5. Log to ai_sessions + ai_turns
 *   6. Wait configurable delay (default 2s)
 */

import db from '$lib/db';
import { assembleSectionPrompt } from '$lib/server/prompt-assembler';
import { callClaude } from '$lib/server/claude-cli';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SectionResult {
  sectionSpecId: number;
  sectionType: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface GenerationResult {
  blueprintId: number;
  sectionsGenerated: number;
  sectionsFailed: number;
  sections: SectionResult[];
  totalDurationMs: number;
}

export interface CoherenceResult {
  passed: boolean;
  issues: string[];
}

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  /** Get all section specs for a blueprint, ordered by section_order. */
  getSectionSpecs: db.prepare(
    `SELECT id, section_type, section_order, status
     FROM section_specs
     WHERE blueprint_id = ?
     ORDER BY section_order ASC`
  ),

  /** Get a single section spec. */
  getSectionSpec: db.prepare(
    `SELECT id, blueprint_id, section_type, section_order, status, generation_attempt_count
     FROM section_specs
     WHERE id = ?`
  ),

  /** Update a section spec with generated HTML. */
  updateSectionGenerated: db.prepare(
    `UPDATE section_specs
     SET generated_html = ?,
         status = 'generated',
         generation_attempt_count = generation_attempt_count + 1
     WHERE id = ?`
  ),

  /** Increment attempt count and leave status unchanged on failure. */
  updateSectionFailed: db.prepare(
    `UPDATE section_specs
     SET generation_attempt_count = generation_attempt_count + 1
     WHERE id = ?`
  ),

  /** Get blueprint with site_id for session logging. */
  getBlueprint: db.prepare(
    `SELECT id, site_id FROM page_blueprints WHERE id = ?`
  ),

  /** Create an ai_sessions record. */
  insertSession: db.prepare(
    `INSERT INTO ai_sessions (site_id, section_spec_id, session_type, status)
     VALUES (?, ?, ?, 'active')`
  ),

  /** Mark a session completed or failed. */
  updateSessionStatus: db.prepare(
    `UPDATE ai_sessions SET status = ? WHERE id = ?`
  ),

  /** Get current max turn_number for a session. */
  getMaxTurn: db.prepare(
    `SELECT COALESCE(MAX(turn_number), 0) AS max_turn FROM ai_turns WHERE session_id = ?`
  ),

  /** Create an ai_turns record. */
  insertTurn: db.prepare(
    `INSERT INTO ai_turns (session_id, turn_number, prompt_text, response_text, duration_ms, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),

  /** Get all generated sections for a blueprint (for coherence pass). */
  getGeneratedSections: db.prepare(
    `SELECT id, section_type, section_order, heading_text, generated_html
     FROM section_specs
     WHERE blueprint_id = ?
       AND status IN ('generated', 'approved')
       AND generated_html IS NOT NULL
     ORDER BY section_order ASC`
  ),
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Sleep for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Generate a single section.
 *
 * Assembles the prompt, calls Claude, stores the result, and logs the turn.
 * Does NOT create its own ai_session — the caller should provide a sessionId
 * (or use the public wrapper which creates one).
 */
async function generateSectionInternal(
  sectionSpecId: number,
  sessionId: number
): Promise<{ success: boolean; html: string; durationMs: number; error?: string }> {
  // 1. Assemble prompt
  let prompt: string;
  try {
    const assembled = assembleSectionPrompt(sectionSpecId);
    prompt = assembled.prompt;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, html: '', durationMs: 0, error: `Prompt assembly failed: ${errorMsg}` };
  }

  // 2. Call Claude
  const result = await callClaude(prompt, { timeoutMs: 180_000 });

  // 3. Determine next turn number
  const { max_turn } = stmts.getMaxTurn.get(sessionId) as { max_turn: number };
  const turnNumber = max_turn + 1;

  // 4. Log the turn
  stmts.insertTurn.run(
    sessionId,
    turnNumber,
    prompt,
    result.response || null,
    result.durationMs,
    result.success ? 'complete' : 'error',
    result.error || null
  );

  // 5. Update section_specs
  if (result.success) {
    stmts.updateSectionGenerated.run(result.response, sectionSpecId);
  } else {
    stmts.updateSectionFailed.run(sectionSpecId);
  }

  return {
    success: result.success,
    html: result.response,
    durationMs: result.durationMs,
    error: result.error,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate all pending sections for a blueprint, sequentially.
 *
 * Creates a single ai_session for the entire page generation run.
 * Each section becomes an ai_turn within that session.
 */
export async function generatePageContent(
  blueprintId: number,
  options?: { delayMs?: number; skipCompleted?: boolean }
): Promise<GenerationResult> {
  const delayMs = options?.delayMs ?? 2000;
  const skipCompleted = options?.skipCompleted ?? true;
  const totalStart = Date.now();

  // Validate blueprint exists and get site_id
  const blueprint = stmts.getBlueprint.get(blueprintId) as
    | { id: number; site_id: number }
    | undefined;
  if (!blueprint) {
    throw new Error(`Blueprint not found: ${blueprintId}`);
  }

  // Get all section specs for this blueprint
  const allSpecs = stmts.getSectionSpecs.all(blueprintId) as Array<{
    id: number;
    section_type: string;
    section_order: number;
    status: string;
  }>;

  if (allSpecs.length === 0) {
    return {
      blueprintId,
      sectionsGenerated: 0,
      sectionsFailed: 0,
      sections: [],
      totalDurationMs: Date.now() - totalStart,
    };
  }

  // Filter to pending sections if skipCompleted
  const specs = skipCompleted
    ? allSpecs.filter((s) => s.status === 'pending')
    : allSpecs;

  // Create an ai_session for this generation run
  const sessionInfo = stmts.insertSession.run(
    blueprint.site_id,
    null, // section_spec_id — null for page-level session
    'section_generation'
  );
  const sessionId = Number(sessionInfo.lastInsertRowid);

  const sectionResults: SectionResult[] = [];
  let generated = 0;
  let failed = 0;

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];

    const result = await generateSectionInternal(spec.id, sessionId);

    sectionResults.push({
      sectionSpecId: spec.id,
      sectionType: spec.section_type,
      success: result.success,
      durationMs: result.durationMs,
      error: result.error,
    });

    if (result.success) {
      generated++;
    } else {
      failed++;
    }

    // Delay between calls (skip after the last one)
    if (i < specs.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  // Update session status
  const finalStatus = failed === specs.length ? 'failed' : 'completed';
  stmts.updateSessionStatus.run(finalStatus, sessionId);

  return {
    blueprintId,
    sectionsGenerated: generated,
    sectionsFailed: failed,
    sections: sectionResults,
    totalDurationMs: Date.now() - totalStart,
  };
}

/**
 * Generate a single section (standalone).
 *
 * Creates its own ai_session with session_type='section_generation'.
 */
export async function generateSection(sectionSpecId: number): Promise<{
  success: boolean;
  html: string;
  durationMs: number;
  error?: string;
}> {
  // Look up section spec to get blueprint → site_id
  const spec = stmts.getSectionSpec.get(sectionSpecId) as
    | { id: number; blueprint_id: number; section_type: string; section_order: number; status: string; generation_attempt_count: number }
    | undefined;
  if (!spec) {
    throw new Error(`Section spec not found: ${sectionSpecId}`);
  }

  const blueprint = stmts.getBlueprint.get(spec.blueprint_id) as
    | { id: number; site_id: number }
    | undefined;
  if (!blueprint) {
    throw new Error(`Blueprint not found: ${spec.blueprint_id}`);
  }

  // Create session for this single-section generation
  const sessionInfo = stmts.insertSession.run(
    blueprint.site_id,
    sectionSpecId,
    'section_generation'
  );
  const sessionId = Number(sessionInfo.lastInsertRowid);

  const result = await generateSectionInternal(sectionSpecId, sessionId);

  // Update session status
  stmts.updateSessionStatus.run(result.success ? 'completed' : 'failed', sessionId);

  return result;
}

/**
 * Run coherence pass after all sections generated.
 *
 * Checks for voice consistency, transition smoothness, no repetition.
 * Creates an ai_session with session_type='coherence_pass'.
 */
export async function runCoherencePass(blueprintId: number): Promise<CoherenceResult> {
  const blueprint = stmts.getBlueprint.get(blueprintId) as
    | { id: number; site_id: number }
    | undefined;
  if (!blueprint) {
    throw new Error(`Blueprint not found: ${blueprintId}`);
  }

  // Get all generated sections
  const sections = stmts.getGeneratedSections.all(blueprintId) as Array<{
    id: number;
    section_type: string;
    section_order: number;
    heading_text: string | null;
    generated_html: string;
  }>;

  if (sections.length === 0) {
    return { passed: false, issues: ['No generated sections found for coherence review.'] };
  }

  // Assemble all section HTML in order
  const fullContent = sections
    .map(
      (s) =>
        `<!-- Section ${s.section_order}: ${s.section_type}${s.heading_text ? ` — ${s.heading_text}` : ''} -->\n${s.generated_html}`
    )
    .join('\n\n');

  // Build coherence review prompt
  const prompt = [
    '=== COHERENCE REVIEW ===',
    'You are reviewing the full set of generated HTML sections for a single page.',
    'Evaluate the following and report any issues:',
    '',
    '1. **Voice consistency**: Do all sections use a consistent tone and voice?',
    '2. **Transitions**: Do sections flow smoothly from one to the next?',
    '3. **Repetition**: Is any content, phrasing, or idea repeated across sections?',
    '4. **Overall coherence**: Does the page read as a unified piece of content?',
    '',
    'Respond in this exact JSON format (no markdown, no code fences):',
    '{"passed": true/false, "issues": ["issue 1", "issue 2", ...]}',
    '',
    'If everything is good, respond with: {"passed": true, "issues": []}',
    '',
    '=== PAGE CONTENT ===',
    fullContent,
  ].join('\n');

  // Create session
  const sessionInfo = stmts.insertSession.run(
    blueprint.site_id,
    null,
    'coherence_pass'
  );
  const sessionId = Number(sessionInfo.lastInsertRowid);

  // Call Claude
  const result = await callClaude(prompt, { timeoutMs: 180_000 });

  // Log turn
  stmts.insertTurn.run(
    sessionId,
    1,
    prompt,
    result.response || null,
    result.durationMs,
    result.success ? 'complete' : 'error',
    result.error || null
  );

  // Update session
  stmts.updateSessionStatus.run(result.success ? 'completed' : 'failed', sessionId);

  if (!result.success) {
    return { passed: false, issues: [`Coherence check failed: ${result.error}`] };
  }

  // Parse Claude's JSON response
  try {
    const parsed = JSON.parse(result.response) as { passed: boolean; issues: string[] };
    return {
      passed: !!parsed.passed,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    // If Claude didn't return valid JSON, treat as failed with the raw response as an issue
    return {
      passed: false,
      issues: [`Could not parse coherence response. Raw: ${result.response.slice(0, 500)}`],
    };
  }
}
