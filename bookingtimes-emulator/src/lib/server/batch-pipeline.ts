/**
 * Batch Generation Pipeline (WRK-035 + WRK-036)
 *
 * Processes batch jobs: loads suburb data + template, builds prompts,
 * calls Claude API (non-streaming), validates output, stores results.
 *
 * WRK-036: Handles empty/null suburb fields gracefully — conditionally
 * includes suburb sections only when data exists. Never outputs
 * placeholder text like {{landmark}} or [MISSING].
 */

import type { D1CompatDatabase, D1CompatStatement } from '$lib/server/db';
import type { LocalCache } from '$lib/server/cache';
import { loadSiteCatalogue, loadTemplateSectionRules } from '$lib/server/catalogue-loader';
import { buildSystemPrompt, buildUserPrompt, type PromptContext, type SuburbData } from '$lib/server/prompt-builder';
import { validateOutput, type ValidationResult } from '$lib/server/output-validator';
import { selectVariant } from '$lib/server/variant-selector';
import type { TemplateSectionRow, Variant } from '$lib/types/template';
import { parseSectionRow } from '$lib/types/template';
import { claudeGenerate } from '$lib/server/claude-cli';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BatchConfig {
	template_id: string;
	site_id: string;
	suburb_ids: string[];
}

export interface BatchResult {
	suburb: string;
	status: 'complete' | 'failed';
	page_id?: string;
	validation?: ValidationResult;
	error?: string;
}

interface BatchJobRow {
	id: string;
	template_id: string;
	site_id: string;
	suburb: string;
	status: string;
	page_id: string | null;
	error_message: string | null;
	retry_count: number;
	created_at: string;
	updated_at: string;
}

interface SuburbRow {
	id: string;
	suburb_name: string;
	postcode: string | null;
	region: string | null;
	state: string | null;
	distance_to_cbd_km: number | null;
	landmarks: string | null;
	population: number | null;
	extra_data: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * WRK-036: Build SuburbData for prompt-builder, omitting null/empty fields.
 * This ensures the prompt builder never generates placeholder text for
 * missing data — it only includes sections with actual values.
 */
function buildSuburbData(row: SuburbRow): SuburbData {
	const data: SuburbData = {
		suburb_name: row.suburb_name
	};

	if (row.postcode) data.postcode = row.postcode;
	if (row.region) data.region = row.region;
	if (row.state) data.state = row.state;
	if (row.distance_to_cbd_km != null) data.distance_to_cbd_km = row.distance_to_cbd_km;
	if (row.population != null) data.population = row.population;

	// Only include landmarks if the JSON array is non-empty
	if (row.landmarks) {
		try {
			const parsed = JSON.parse(row.landmarks) as string[];
			if (Array.isArray(parsed) && parsed.length > 0) {
				data.landmarks = parsed;
			}
		} catch {
			// Malformed JSON — skip landmarks, log warning
			console.warn(`[batch] Malformed landmarks JSON for suburb "${row.suburb_name}"`);
		}
	}

	return data;
}

/**
 * Log warnings for missing suburb data fields (WRK-036).
 */
function logMissingFields(suburbName: string, row: SuburbRow): void {
	const missing: string[] = [];
	if (!row.postcode) missing.push('postcode');
	if (!row.region) missing.push('region');
	if (row.distance_to_cbd_km == null) missing.push('distance_to_cbd_km');
	if (!row.landmarks) missing.push('landmarks');
	if (row.population == null) missing.push('population');

	if (missing.length > 0) {
		console.warn(
			`[batch] Suburb "${suburbName}" has missing fields: ${missing.join(', ')}. Content will be generated without these fields.`
		);
	}
}

/**
 * Call Claude CLI (non-streaming) and return the text response.
 */
async function callClaude(
	systemPrompt: string,
	userPrompt: string,
	_apiKey: string
): Promise<string> {
	const result = await claudeGenerate({
		prompt: userPrompt,
		systemPrompt,
		model: CLAUDE_MODEL,
		maxTokens: MAX_TOKENS
	});

	return result.content;
}

/**
 * Build a stricter retry prompt that includes validation errors.
 */
function buildRetryPrompt(
	originalPrompt: string,
	validation: ValidationResult,
	attempt: number
): string {
	const errorList = validation.errors
		.map((e) => `- ${e.message}`)
		.join('\n');

	return `${originalPrompt}

IMPORTANT — Previous attempt ${attempt} had validation errors. Fix ALL of these:
${errorList}

Do NOT use any disallowed HTML elements (<script>, <style>, <iframe>, <form>, <link>).
Do NOT use document-level tags (<!DOCTYPE>, <html>, <head>, <body>).
Output ONLY valid body-level HTML using the allowed CSS classes.`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Process a single batch job by ID.
 *
 * 1. Load suburb data from D1
 * 2. Load template with sections
 * 3. Select variant for each section using suburb name as seed
 * 4. Build prompt with suburb data and template rules
 * 5. Call Claude API (non-streaming)
 * 6. Validate output
 * 7. If valid: create page + page_version, mark complete
 * 8. If invalid: retry up to 3 times, then mark failed/needs_review
 */
export async function processBatchJob(
	jobId: string,
	db: D1CompatDatabase,
	kv: LocalCache,
	anthropicKey: string
): Promise<BatchResult> {
	// Load the batch job
	const job = await db
		.prepare('SELECT * FROM batch_jobs WHERE id = ?')
		.bind(jobId)
		.first<BatchJobRow>();

	if (!job) {
		return { suburb: '(unknown)', status: 'failed', error: `Batch job not found: ${jobId}` };
	}

	if (job.status !== 'pending' && job.status !== 'processing') {
		return {
			suburb: job.suburb,
			status: job.status === 'complete' ? 'complete' : 'failed',
			page_id: job.page_id ?? undefined,
			error: job.status === 'complete' ? undefined : `Job already in status: ${job.status}`
		};
	}

	const now = new Date().toISOString();

	// Mark as processing
	await db
		.prepare("UPDATE batch_jobs SET status = 'processing', updated_at = ? WHERE id = ?")
		.bind(now, jobId)
		.run();

	// Load suburb data
	const suburbRow = await db
		.prepare('SELECT * FROM suburb_data WHERE suburb_name = ? COLLATE NOCASE LIMIT 1')
		.bind(job.suburb)
		.first<SuburbRow>();

	if (!suburbRow) {
		await db
			.prepare("UPDATE batch_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
			.bind(`Suburb not found: ${job.suburb}`, new Date().toISOString(), jobId)
			.run();
		return { suburb: job.suburb, status: 'failed', error: `Suburb not found: ${job.suburb}` };
	}

	// WRK-036: Log warnings for missing fields
	logMissingFields(suburbRow.suburb_name, suburbRow);

	// WRK-036: Build suburb data, omitting null fields
	const suburbData = buildSuburbData(suburbRow);

	// Load site catalogue
	const catalogue = await loadSiteCatalogue(job.site_id, db, kv);
	const allowedClassSet = new Set(catalogue.classes);

	// Load template sections
	const sectionResult = await db
		.prepare(
			'SELECT * FROM template_sections WHERE template_id = ? ORDER BY sort_order ASC'
		)
		.bind(job.template_id)
		.all<TemplateSectionRow>();

	const sections = (sectionResult.results ?? []).map(parseSectionRow);

	if (sections.length === 0) {
		await db
			.prepare("UPDATE batch_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
			.bind('No template sections found', new Date().toISOString(), jobId)
			.run();
		return { suburb: job.suburb, status: 'failed', error: 'No template sections found' };
	}

	// Generate content for each section, combined into one page
	const sectionOutputs: string[] = [];
	let lastValidation: ValidationResult | undefined;

	for (const section of sections) {
		// Select variant using suburb name as seed
		let variantBrief: string | undefined;
		if (section.variant_pool.length > 0) {
			const variant = selectVariant(section.variant_pool, suburbRow.suburb_name);
			variantBrief = variant.brief;
		}

		// Build template rules for this section
		const templateRules = {
			section_name: section.name,
			html_skeleton: section.html_skeleton ?? undefined,
			required_classes: section.required_classes.length > 0 ? section.required_classes : undefined,
			content_rules: section.content_rules ?? undefined,
			variant_brief: variantBrief
		};

		// Build prompt context
		const promptContext: PromptContext = {
			site_id: job.site_id,
			available_classes: catalogue.classes,
			platform_constraints: [],
			...(catalogue.content_wrapper && { content_wrapper: catalogue.content_wrapper }),
			template_rules: templateRules,
			suburb_data: suburbData
		};

		const systemPrompt = buildSystemPrompt(promptContext);
		const userPrompt = buildUserPrompt(
			'generate',
			`Generate the "${section.name}" section for a driving school page targeting ${suburbRow.suburb_name}.`,
			promptContext
		);

		// Call Claude with retry logic
		let sectionHtml = '';
		let validation: ValidationResult | undefined;
		let attempts = 0;

		while (attempts < MAX_RETRIES) {
			attempts++;

			try {
				const prompt = attempts === 1
					? userPrompt
					: buildRetryPrompt(userPrompt, validation!, attempts - 1);

				sectionHtml = await callClaude(systemPrompt, prompt, anthropicKey);

				// Validate
				validation = validateOutput(sectionHtml, allowedClassSet);

				if (validation.valid) {
					break; // Success
				}

				// Has errors — retry if attempts remain
				if (attempts < MAX_RETRIES) {
					console.warn(
						`[batch] Section "${section.name}" for ${suburbRow.suburb_name} failed validation (attempt ${attempts}/${MAX_RETRIES}): ${validation.errors.length} errors`
					);
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`[batch] Claude API error for section "${section.name}", attempt ${attempts}: ${message}`);

				if (attempts >= MAX_RETRIES) {
					await db
						.prepare(
							"UPDATE batch_jobs SET status = 'failed', error_message = ?, retry_count = ?, updated_at = ? WHERE id = ?"
						)
						.bind(`Claude API error: ${message}`, attempts, new Date().toISOString(), jobId)
						.run();
					return { suburb: job.suburb, status: 'failed', error: message };
				}
			}
		}

		lastValidation = validation;
		sectionOutputs.push(sectionHtml);
	}

	// Combine all section outputs
	const fullHtml = sectionOutputs.join('\n\n');

	// Final validation on combined output
	const finalValidation = validateOutput(fullHtml, allowedClassSet);

	if (!finalValidation.valid) {
		// Mark as needs_review rather than failed — content was generated but has issues
		await db
			.prepare(
				"UPDATE batch_jobs SET status = 'needs_review', error_message = ?, retry_count = ?, updated_at = ? WHERE id = ?"
			)
			.bind(
				`Combined output has ${finalValidation.errors.length} validation errors`,
				MAX_RETRIES,
				new Date().toISOString(),
				jobId
			)
			.run();

		return {
			suburb: job.suburb,
			status: 'failed',
			validation: finalValidation,
			error: `Combined output has ${finalValidation.errors.length} validation errors`
		};
	}

	// Create page + page_version in D1
	const pageId = crypto.randomUUID();
	const versionId = crypto.randomUUID();
	const timestamp = new Date().toISOString();

	await db.batch([
		db
			.prepare(
				`INSERT INTO pages (id, title, site_id, template_id, suburb, status, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
			)
			.bind(
				pageId,
				`${suburbRow.suburb_name} Driving School`,
				job.site_id,
				job.template_id,
				suburbRow.suburb_name,
				timestamp,
				timestamp
			),
		db
			.prepare(
				`INSERT INTO page_versions (id, page_id, version_number, html_content, source, change_summary, created_at)
				 VALUES (?, ?, 1, ?, 'batch', ?, ?)`
			)
			.bind(
				versionId,
				pageId,
				fullHtml,
				`Batch generated for ${suburbRow.suburb_name}`,
				timestamp
			),
		db
			.prepare(
				"UPDATE batch_jobs SET status = 'complete', page_id = ?, updated_at = ? WHERE id = ?"
			)
			.bind(pageId, timestamp, jobId)
	]);

	return {
		suburb: job.suburb,
		status: 'complete',
		page_id: pageId,
		validation: finalValidation
	};
}

/**
 * Create batch jobs for a set of suburbs. Returns the created job IDs.
 */
export async function createBatchJobs(
	db: D1CompatDatabase,
	config: BatchConfig
): Promise<{ jobs: Array<{ id: string; suburb: string; status: string }> }> {
	const now = new Date().toISOString();
	const statements: D1CompatStatement[] = [];
	const jobs: Array<{ id: string; suburb: string; status: string }> = [];

	// Look up suburb names by ID
	for (const suburbId of config.suburb_ids) {
		const row = await db
			.prepare('SELECT suburb_name FROM suburb_data WHERE id = ?')
			.bind(suburbId)
			.first<{ suburb_name: string }>();

		if (!row) {
			console.warn(`[batch] Suburb ID not found: ${suburbId}, skipping`);
			continue;
		}

		const jobId = crypto.randomUUID();

		statements.push(
			db
				.prepare(
					`INSERT INTO batch_jobs (id, template_id, site_id, suburb, status, retry_count, created_at, updated_at)
					 VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`
				)
				.bind(jobId, config.template_id, config.site_id, row.suburb_name, now, now)
		);

		jobs.push({ id: jobId, suburb: row.suburb_name, status: 'pending' });
	}

	if (statements.length > 0) {
		// Chunk to respect D1 batch limits
		const CHUNK_SIZE = 50;
		for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
			await db.batch(statements.slice(i, i + CHUNK_SIZE));
		}
	}

	return { jobs };
}

/**
 * Get the next pending batch job and process it.
 * Returns null if no pending jobs exist.
 */
export async function processNextPendingJob(
	db: D1CompatDatabase,
	kv: LocalCache,
	anthropicKey: string
): Promise<BatchResult | null> {
	const job = await db
		.prepare(
			"SELECT id FROM batch_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
		)
		.first<{ id: string }>();

	if (!job) return null;

	return processBatchJob(job.id, db, kv, anthropicKey);
}
