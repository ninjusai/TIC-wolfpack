import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createSession,
	getSession,
	getSessionHistory,
	addTurn,
	deleteLastTurn
} from '$lib/server/ai-sessions';
import {
	buildSystemPrompt,
	buildUserPrompt,
	summarizeHistory,
	type PromptContext
} from '$lib/server/prompt-builder';
import { validateOutput, type ValidationResult } from '$lib/server/output-validator';
import {
	loadSiteCatalogue,
	loadSuburbData,
	loadTemplateSectionRules
} from '$lib/server/catalogue-loader';
import { claudeStream } from '$lib/server/claude-cli';

// ── Types ──────────────────────────────────────────────────────────────────

interface GenerateRequest {
	session_id?: string;
	site_id: string;
	action: 'generate' | 'refine' | 'regenerate';
	prompt: string;
	template_id?: string;
	section_id?: string;
	suburb?: string;
}

// ── SSE Helpers ────────────────────────────────────────────────────────────

function sseEvent(data: object): string {
	return `data: ${JSON.stringify(data)}\n\n`;
}

// ── History turn limit before summarization ───────────────────────────────

const MAX_HISTORY_TURNS = 10;

// ── POST Handler ───────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;
	const kv = locals.cache;

	// Parse & validate request body
	let body: GenerateRequest;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { site_id, action, prompt, session_id, template_id, section_id, suburb } = body;

	if (!site_id || !action || !prompt) {
		throw error(400, 'Missing required fields: site_id, action, prompt');
	}

	if (!['generate', 'refine', 'regenerate'].includes(action)) {
		throw error(400, 'Invalid action. Must be: generate, refine, or regenerate');
	}

	// ── Session management ─────────────────────────────────────────────────

	let sessionId: string;

	if (session_id) {
		// Validate existing session
		const session = await getSession(db, session_id);
		if (session.status !== 'active') {
			throw error(400, `Session ${session_id} is ${session.status}, not active`);
		}
		sessionId = session_id;
	} else {
		// Create new session
		sessionId = await createSession(db, site_id);
	}

	// ── Handle regenerate: discard last assistant turn ──────────────────────

	if (action === 'regenerate' && session_id) {
		await deleteLastTurn(db, sessionId, 'assistant');
	}

	// ── Load site catalogue, suburb data, and template rules ───────────────

	const [catalogue, suburbData, templateRules] = await Promise.all([
		loadSiteCatalogue(site_id, db, kv),
		suburb ? loadSuburbData(suburb, db) : Promise.resolve(null),
		template_id && section_id
			? loadTemplateSectionRules(template_id, section_id, db)
			: Promise.resolve(null)
	]);

	// ── Build prompt context ───────────────────────────────────────────────

	const promptContext: PromptContext = {
		site_id,
		available_classes: catalogue.classes,
		platform_constraints: [],
		...(catalogue.content_wrapper && { content_wrapper: catalogue.content_wrapper }),
		...(templateRules && { template_rules: templateRules }),
		...(suburbData && { suburb_data: suburbData })
	};

	// Build system prompt via prompt builder
	const systemPrompt = buildSystemPrompt(promptContext);

	// ── Load and prepare conversation history ──────────────────────────────

	const rawHistory = await getSessionHistory(db, sessionId);

	// Summarize if history is too long — keep original brief visible
	const history = rawHistory.length > MAX_HISTORY_TURNS + 1
		? summarizeHistory(rawHistory as Parameters<typeof summarizeHistory>[0], MAX_HISTORY_TURNS)
		: rawHistory;

	// Build messages array for Claude
	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

	for (const turn of history) {
		messages.push({ role: turn.role, content: turn.content });
	}

	// Build the user message via prompt builder
	const userMessage = buildUserPrompt(action, prompt, promptContext);

	messages.push({ role: 'user', content: userMessage });

	// Save the user turn to D1
	await addTurn(db, sessionId, 'user', userMessage);

	// ── Allowed classes set for validation ─────────────────────────────────

	const allowedClassSet = new Set(catalogue.classes);

	// ── Call Claude CLI with streaming ─────────────────────────────────────

	// Build combined prompt: include conversation history context
	const historyContext = messages.slice(0, -1).map(
		(m) => `[${m.role}]: ${m.content}`
	).join('\n\n');

	const cliPrompt = historyContext
		? `[Conversation History]\n${historyContext}\n\n[Current Request]\n${userMessage}`
		: userMessage;

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			try {
				let fullResponse = '';

				const chunks = claudeStream({
					prompt: cliPrompt,
					systemPrompt,
					maxTokens: 4096
				});

				for await (const chunk of chunks) {
					if (chunk.type === 'content' && chunk.text) {
						fullResponse += chunk.text;
						controller.enqueue(
							encoder.encode(sseEvent({ type: 'content', text: chunk.text }))
						);
					}
				}

				// ── Validate the generated output ──────────────────────────────

				let validation: ValidationResult | null = null;
				if (fullResponse.trim()) {
					validation = validateOutput(fullResponse, allowedClassSet);
				}

				// Save assistant turn to D1, including validation report
				const turnId = await addTurn(
					db,
					sessionId,
					'assistant',
					fullResponse,
					validation ?? undefined
				);

				// Send completion event with validation results
				controller.enqueue(
					encoder.encode(
						sseEvent({
							type: 'done',
							turn_id: turnId,
							session_id: sessionId,
							validation: validation
								? {
										valid: validation.valid,
										errors: validation.errors,
										warnings: validation.warnings,
										stats: validation.stats
									}
								: null
						})
					)
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				controller.enqueue(
					encoder.encode(sseEvent({ type: 'error', message }))
				);
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
