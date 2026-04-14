/**
 * Prompt Builder Module (WRK-020)
 *
 * Builds system and user prompts that constrain Claude to generate
 * valid bookingtimes.com content. Pure module — receives all data
 * as parameters, no D1 access.
 *
 * Designed to run on Cloudflare Workers — lightweight, no heavy deps.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface TemplateSectionRule {
	section_name: string;
	html_skeleton?: string;
	required_classes?: string[];
	content_rules?: {
		min_words?: number;
		max_words?: number;
		tone?: string;
		structure?: string;
	};
	variant_brief?: string;
}

export interface SuburbData {
	suburb_name: string;
	postcode?: string;
	region?: string;
	state?: string;
	distance_to_cbd_km?: number;
	landmarks?: string[];
	population?: number;
}

export interface PromptContext {
	site_id: string;
	available_classes: string[];
	template_rules?: TemplateSectionRule;
	suburb_data?: SuburbData;
	content_wrapper?: string;
	platform_constraints: string[];
}

export interface AITurn {
	id: string;
	session_id: string;
	turn_number: number;
	role: 'user' | 'assistant';
	content: string;
	validation_report?: object | null;
	created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Approximate max tokens for class listings in the system prompt */
const MAX_CLASS_LISTING_TOKENS = 2000;

/** Approximate characters per token for class names */
const CHARS_PER_TOKEN = 4;

const MAX_CLASS_LISTING_CHARS = MAX_CLASS_LISTING_TOKENS * CHARS_PER_TOKEN;

/** Default platform constraints — always included */
const DEFAULT_PLATFORM_CONSTRAINTS: string[] = [
	'Generate body-level HTML only — no <!DOCTYPE>, <html>, <head>, or <body> tags',
	'Use ONLY CSS classes from the provided allowed list',
	'Never use bare element selectors or inline <style> tags',
	'No <script>, <iframe>, <form>, or <link> tags',
	'Use Bootstrap 5 grid system for layout (container, row, col-*)',
	'Avoid inline style="" attributes — use the provided CSS classes instead',
	'Content should be professional and relevant to driving schools in Queensland, Australia'
];

// ── Class categorization ───────────────────────────────────────────────────

interface CategorizedClasses {
	layout: string[];
	typography: string[];
	components: string[];
	utilities: string[];
	other: string[];
}

/** Categorize CSS classes by type for organized prompt inclusion */
function categorizeClasses(classes: string[]): CategorizedClasses {
	const result: CategorizedClasses = {
		layout: [],
		typography: [],
		components: [],
		utilities: [],
		other: []
	};

	for (const cls of classes) {
		if (isLayoutClass(cls)) {
			result.layout.push(cls);
		} else if (isTypographyClass(cls)) {
			result.typography.push(cls);
		} else if (isComponentClass(cls)) {
			result.components.push(cls);
		} else if (isUtilityClass(cls)) {
			result.utilities.push(cls);
		} else {
			result.other.push(cls);
		}
	}

	return result;
}

function isLayoutClass(cls: string): boolean {
	return /^(container|row|col|g-|gx-|gy-|offset-|order-|d-|flex-|justify-|align-|float-|position-|w-|h-|m[trblxyse]?-|p[trblxyse]?-)/.test(cls) ||
		/^(container-fluid|container-sm|container-md|container-lg|container-xl|container-xxl)$/.test(cls);
}

function isTypographyClass(cls: string): boolean {
	return /^(h[1-6]|display-|lead|small|mark|text-|font-|fw-|fst-|lh-|fs-|blockquote|list-)/.test(cls);
}

function isComponentClass(cls: string): boolean {
	return /^(btn|card|nav|navbar|badge|alert|modal|accordion|carousel|dropdown|tab|table|form|input|breadcrumb|pagination|progress|spinner|toast|tooltip|popover|offcanvas|list-group|placeholder)/.test(cls);
}

function isUtilityClass(cls: string): boolean {
	return /^(bg-|border|rounded|shadow|opacity-|overflow-|visible|invisible|clearfix|stretched-link|ratio|vstack|hstack|visually-)/.test(cls);
}

// ── Class budget management ────────────────────────────────────────────────

/**
 * Select a subset of classes that fits within the token budget.
 * Prioritizes: layout > typography > components > utilities > other.
 */
function selectClassSubset(classes: string[]): CategorizedClasses {
	const categorized = categorizeClasses(classes);
	let remaining = MAX_CLASS_LISTING_CHARS;

	const budget: CategorizedClasses = {
		layout: [],
		typography: [],
		components: [],
		utilities: [],
		other: []
	};

	// Priority order for inclusion
	const categories: (keyof CategorizedClasses)[] = [
		'layout',
		'typography',
		'components',
		'utilities',
		'other'
	];

	for (const cat of categories) {
		for (const cls of categorized[cat]) {
			// +2 for ", " separator
			const cost = cls.length + 2;
			if (remaining - cost < 0) break;
			budget[cat].push(cls);
			remaining -= cost;
		}
		if (remaining <= 0) break;
	}

	return budget;
}

// ── Prompt formatting helpers ──────────────────────────────────────────────

function formatClassListing(classes: CategorizedClasses): string {
	const sections: string[] = [];

	if (classes.layout.length > 0) {
		sections.push(`**Layout:** ${classes.layout.join(', ')}`);
	}
	if (classes.typography.length > 0) {
		sections.push(`**Typography:** ${classes.typography.join(', ')}`);
	}
	if (classes.components.length > 0) {
		sections.push(`**Components:** ${classes.components.join(', ')}`);
	}
	if (classes.utilities.length > 0) {
		sections.push(`**Utilities:** ${classes.utilities.join(', ')}`);
	}
	if (classes.other.length > 0) {
		sections.push(`**Other:** ${classes.other.join(', ')}`);
	}

	return sections.join('\n');
}

function formatTemplateSectionRules(rules: TemplateSectionRule): string {
	const parts: string[] = [`\n## Template Section: ${rules.section_name}\n`];

	if (rules.html_skeleton) {
		parts.push(`**HTML Structure:** Follow this skeleton:\n\`\`\`html\n${rules.html_skeleton}\n\`\`\``);
	}

	if (rules.required_classes && rules.required_classes.length > 0) {
		parts.push(`**Required Classes:** You MUST use these classes: ${rules.required_classes.join(', ')}`);
	}

	if (rules.content_rules) {
		const cr = rules.content_rules;
		if (cr.min_words || cr.max_words) {
			const range = cr.min_words && cr.max_words
				? `${cr.min_words}–${cr.max_words} words`
				: cr.min_words
					? `at least ${cr.min_words} words`
					: `at most ${cr.max_words} words`;
			parts.push(`**Word Count:** ${range}`);
		}
		if (cr.tone) {
			parts.push(`**Tone:** ${cr.tone}`);
		}
		if (cr.structure) {
			parts.push(`**Structure:** ${cr.structure}`);
		}
	}

	if (rules.variant_brief) {
		parts.push(`\n**Content Variant Brief:** ${rules.variant_brief}`);
		parts.push('Follow the above brief to guide the angle and focus of the content for this section.');
	}

	return parts.join('\n');
}

function formatSuburbData(suburb: SuburbData): string {
	const parts: string[] = ['\n## Location Context\n'];

	parts.push(`**Suburb:** ${suburb.suburb_name}`);
	if (suburb.postcode) parts.push(`**Postcode:** ${suburb.postcode}`);
	if (suburb.region) parts.push(`**Region:** ${suburb.region}`);
	if (suburb.state) parts.push(`**State:** ${suburb.state}`);
	if (suburb.distance_to_cbd_km != null) {
		parts.push(`**Distance to CBD:** ${suburb.distance_to_cbd_km} km`);
	}
	if (suburb.landmarks && suburb.landmarks.length > 0) {
		parts.push(`**Local Landmarks:** ${suburb.landmarks.join(', ')}`);
	}
	if (suburb.population != null) {
		parts.push(`**Population:** ${suburb.population.toLocaleString()}`);
	}

	parts.push('');
	parts.push('Use this location data to make the content locally relevant — mention the suburb name, nearby landmarks, and regional context where appropriate.');

	return parts.join('\n');
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Build the system prompt that constrains Claude to generate valid
 * bookingtimes.com content.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
	const parts: string[] = [];

	// Role
	parts.push('You are a content creation assistant for a driving school website hosted on the bookingtimes.com platform.\n');

	// Platform constraints
	const constraints = ctx.platform_constraints.length > 0
		? ctx.platform_constraints
		: DEFAULT_PLATFORM_CONSTRAINTS;

	parts.push('## Platform Constraints\n');
	for (const c of constraints) {
		parts.push(`- ${c}`);
	}
	parts.push('');

	// Available CSS classes
	const classSubset = selectClassSubset(ctx.available_classes);
	const totalIncluded = Object.values(classSubset).reduce((sum, arr) => sum + arr.length, 0);
	const totalAvailable = ctx.available_classes.length;

	parts.push('## Available CSS Classes\n');
	if (totalIncluded < totalAvailable) {
		parts.push(`(Showing ${totalIncluded} of ${totalAvailable} available classes — most relevant subset)\n`);
	}
	parts.push(formatClassListing(classSubset));
	parts.push('');

	// Content wrapper
	if (ctx.content_wrapper) {
		parts.push('## Content Wrapper\n');
		parts.push(`Your generated HTML will be placed inside this wrapper structure:\n\`\`\`html\n${ctx.content_wrapper}\n\`\`\``);
		parts.push('Do not repeat the wrapper in your output — generate only the inner content.\n');
	}

	// Template section rules
	if (ctx.template_rules) {
		parts.push(formatTemplateSectionRules(ctx.template_rules));
		parts.push('');
	}

	// Suburb data
	if (ctx.suburb_data) {
		parts.push(formatSuburbData(ctx.suburb_data));
		parts.push('');
	}

	// Output format instruction
	parts.push('## Output Format\n');
	parts.push('Respond with ONLY the HTML content. No markdown code fences, no explanations before or after. Just the raw HTML.');

	return parts.join('\n');
}

/**
 * Build the user prompt for a specific action + user input.
 */
export function buildUserPrompt(action: string, userInput: string, ctx: PromptContext): string {
	const parts: string[] = [];

	switch (action) {
		case 'generate':
			parts.push(`Create new content based on these instructions:\n\n${userInput}`);
			break;

		case 'refine':
			parts.push(`Refine the existing content based on this feedback:\n\n${userInput}`);
			parts.push('\nMake targeted changes while preserving the overall structure and any parts not mentioned in the feedback.');
			break;

		case 'expand':
			parts.push(`Expand the existing content:\n\n${userInput}`);
			parts.push('\nAdd more detail and substance while maintaining the current style and class usage.');
			break;

		case 'simplify':
			parts.push(`Simplify the existing content:\n\n${userInput}`);
			parts.push('\nReduce complexity and length while keeping the essential information and layout.');
			break;

		case 'localize':
			if (ctx.suburb_data) {
				parts.push(`Localize this content for ${ctx.suburb_data.suburb_name}:\n\n${userInput}`);
				parts.push('\nAdapt the content to be specific to this suburb — mention local landmarks, distances, and relevant details.');
			} else {
				parts.push(`Localize this content:\n\n${userInput}`);
			}
			break;

		default:
			parts.push(userInput);
			break;
	}

	return parts.join('\n');
}

/**
 * Summarize conversation history for long sessions.
 *
 * Keeps the first turn (original brief) + the last `maxTurns` turns.
 * If truncating, inserts a summary turn to maintain context.
 */
export function summarizeHistory(turns: AITurn[], maxTurns: number): AITurn[] {
	if (turns.length <= maxTurns + 1) {
		return turns;
	}

	const firstTurn = turns[0];
	const recentTurns = turns.slice(-maxTurns);
	const skippedCount = turns.length - maxTurns - 1;

	// Build a summary of skipped turns
	const skippedTurns = turns.slice(1, turns.length - maxTurns);
	const userRequests = skippedTurns
		.filter((t) => t.role === 'user')
		.map((t) => t.content.slice(0, 80))
		.join('; ');

	const summaryTurn: AITurn = {
		id: 'summary',
		session_id: firstTurn.session_id,
		turn_number: 1,
		role: 'assistant',
		content: `[${skippedCount} earlier turns summarized] The conversation covered: ${userRequests || 'multiple refinements'}. The most recent content is shown in the following turns.`,
		created_at: firstTurn.created_at
	};

	return [firstTurn, summaryTurn, ...recentTurns];
}
