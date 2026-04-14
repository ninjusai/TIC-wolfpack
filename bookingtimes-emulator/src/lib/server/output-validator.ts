/**
 * AI Output Validation Layer (WRK-021)
 *
 * Validates AI-generated HTML against bookingtimes.com platform constraints.
 * Pure module — receives allowed classes as a parameter, no D1 access.
 *
 * Designed for speed — runs on every AI response before displaying to the user.
 * No heavy dependencies — regex-based parsing only.
 */

import { extractClassesFromHTML } from '$lib/server/css-parser';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ValidationResult {
	valid: boolean;
	errors: ValidationIssue[];
	warnings: ValidationIssue[];
	stats: {
		total_classes: number;
		valid_classes: number;
		unknown_classes: number;
		disallowed_elements: number;
	};
}

export interface ValidationIssue {
	type:
		| 'unknown_class'
		| 'disallowed_element'
		| 'bare_selector'
		| 'malformed_html'
		| 'inline_style'
		| 'script_tag';
	severity: 'error' | 'warning';
	message: string;
	context?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Elements that must never appear in generated content */
const DISALLOWED_ELEMENTS = ['script', 'style', 'iframe', 'form', 'link'];

/** Regex to match disallowed elements (opening tags) */
const DISALLOWED_TAG_REGEX = /<(script|style|iframe|form|link)\b[^>]*>/gi;

/** Regex to match inline style attributes */
const INLINE_STYLE_REGEX = /\bstyle\s*=\s*["'][^"']*["']/gi;

/** Regex to detect document-level tags that should not be in body-level HTML */
const DOCUMENT_LEVEL_REGEX = /<(!DOCTYPE|html|head|body)\b[^>]*>/gi;

// ── Validation checks ─────────────────────────────────────────────────────

/**
 * Check for disallowed HTML elements.
 */
function checkDisallowedElements(html: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	DISALLOWED_TAG_REGEX.lastIndex = 0;

	while ((match = DISALLOWED_TAG_REGEX.exec(html)) !== null) {
		const tagName = match[1].toLowerCase();
		issues.push({
			type: tagName === 'script' ? 'script_tag' : 'disallowed_element',
			severity: 'error',
			message: `Disallowed <${tagName}> element found`,
			context: match[0].slice(0, 100)
		});
	}

	// Also check for document-level tags
	DOCUMENT_LEVEL_REGEX.lastIndex = 0;

	while ((match = DOCUMENT_LEVEL_REGEX.exec(html)) !== null) {
		const tagName = match[1].toLowerCase();
		issues.push({
			type: 'disallowed_element',
			severity: 'error',
			message: `Document-level <${tagName}> tag found — only body-level HTML is allowed`,
			context: match[0].slice(0, 100)
		});
	}

	return issues;
}

/**
 * Check for inline style attributes.
 */
function checkInlineStyles(html: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	let match: RegExpExecArray | null;

	INLINE_STYLE_REGEX.lastIndex = 0;

	while ((match = INLINE_STYLE_REGEX.exec(html)) !== null) {
		issues.push({
			type: 'inline_style',
			severity: 'warning',
			message: 'Inline style attribute found — prefer using CSS classes',
			context: match[0].slice(0, 100)
		});
	}

	return issues;
}

/**
 * Check for bare element selectors inside inline <style> blocks.
 * This catches cases where the AI generates a <style> block with selectors
 * like `p { ... }` or `h2 { ... }`.
 */
function checkBareSelectors(html: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// Extract <style> block contents
	const styleBlockRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
	let blockMatch: RegExpExecArray | null;

	while ((blockMatch = styleBlockRegex.exec(html)) !== null) {
		const styleContent = blockMatch[1];

		// Check for bare element selectors (not prefixed with . # or [)
		// Match things like: p {, h2 {, div {, a:hover {
		const bareSelectorRegex = /(?:^|[,}])\s*([a-zA-Z][a-zA-Z0-9]*)\s*[:{[,]/gm;
		let selectorMatch: RegExpExecArray | null;

		while ((selectorMatch = bareSelectorRegex.exec(styleContent)) !== null) {
			const selector = selectorMatch[1].toLowerCase();
			// Skip CSS at-rule keywords
			if (['media', 'keyframes', 'import', 'charset', 'font'].includes(selector)) continue;

			issues.push({
				type: 'bare_selector',
				severity: 'error',
				message: `Bare element selector "${selector}" found in <style> block — this will affect elements outside the content area`,
				context: selectorMatch[0].trim().slice(0, 80)
			});
		}
	}

	return issues;
}

/**
 * Basic HTML well-formedness check.
 * Verifies that common structural tags have matching open/close pairs.
 */
function checkWellFormedness(html: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// Tags we want to check for balance (skip void elements)
	const VOID_ELEMENTS = new Set([
		'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
		'link', 'meta', 'param', 'source', 'track', 'wbr'
	]);

	// Extract all tags
	const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
	const stack: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = tagRegex.exec(html)) !== null) {
		const fullTag = match[0];
		const tagName = match[1].toLowerCase();

		// Skip void elements and self-closing tags
		if (VOID_ELEMENTS.has(tagName)) continue;
		if (fullTag.endsWith('/>')) continue;

		if (fullTag.startsWith('</')) {
			// Closing tag
			if (stack.length === 0) {
				issues.push({
					type: 'malformed_html',
					severity: 'warning',
					message: `Unexpected closing </${tagName}> tag with no matching opening tag`,
					context: fullTag
				});
			} else if (stack[stack.length - 1] !== tagName) {
				// Mismatched tag — try to find it in the stack
				const idx = stack.lastIndexOf(tagName);
				if (idx === -1) {
					issues.push({
						type: 'malformed_html',
						severity: 'warning',
						message: `Unexpected closing </${tagName}> tag — expected </${stack[stack.length - 1]}>`,
						context: fullTag
					});
				} else {
					// Pop everything up to and including the matching tag
					const unclosed = stack.splice(idx);
					for (let i = 1; i < unclosed.length; i++) {
						issues.push({
							type: 'malformed_html',
							severity: 'warning',
							message: `Unclosed <${unclosed[i]}> tag`,
							context: `<${unclosed[i]}>`
						});
					}
				}
			} else {
				stack.pop();
			}
		} else {
			// Opening tag
			stack.push(tagName);
		}
	}

	// Any remaining tags in the stack are unclosed
	for (const tag of stack) {
		issues.push({
			type: 'malformed_html',
			severity: 'warning',
			message: `Unclosed <${tag}> tag at end of content`,
			context: `<${tag}>`
		});
	}

	// Cap well-formedness warnings to avoid flooding
	if (issues.length > 10) {
		const count = issues.length;
		issues.length = 10;
		issues.push({
			type: 'malformed_html',
			severity: 'warning',
			message: `${count - 10} additional HTML structure issues found (truncated)`,
		});
	}

	return issues;
}

/**
 * Validate classes used in the HTML against the allowed set.
 */
function checkClasses(
	html: string,
	allowedClasses: Set<string>
): { issues: ValidationIssue[]; stats: ValidationResult['stats'] } {
	const usedClasses = extractClassesFromHTML(html);
	const issues: ValidationIssue[] = [];

	let validCount = 0;
	let unknownCount = 0;

	for (const cls of usedClasses) {
		if (allowedClasses.has(cls)) {
			validCount++;
		} else {
			unknownCount++;
			issues.push({
				type: 'unknown_class',
				severity: 'warning',
				message: `Unknown CSS class "${cls}" — not in the allowed catalogue`,
				context: cls
			});
		}
	}

	// Cap unknown class warnings
	if (issues.length > 20) {
		const count = issues.length;
		issues.length = 20;
		issues.push({
			type: 'unknown_class',
			severity: 'warning',
			message: `${count - 20} additional unknown classes found (truncated)`
		});
	}

	return {
		issues,
		stats: {
			total_classes: usedClasses.length,
			valid_classes: validCount,
			unknown_classes: unknownCount,
			disallowed_elements: 0 // filled in later
		}
	};
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Validate AI-generated HTML against platform constraints.
 *
 * - Unknown classes are WARNINGS (flagged but don't block)
 * - Disallowed elements are ERRORS (block the output)
 * - HTML well-formedness issues are WARNINGS
 * - Inline styles are WARNINGS
 *
 * Returns quickly — designed to run on every AI response.
 */
export function validateOutput(html: string, allowedClasses: Set<string>): ValidationResult {
	const errors: ValidationIssue[] = [];
	const warnings: ValidationIssue[] = [];

	// 1. Disallowed elements (errors)
	const elementIssues = checkDisallowedElements(html);
	for (const issue of elementIssues) {
		errors.push(issue);
	}

	// 2. Bare selectors in <style> blocks (errors)
	const bareSelectorIssues = checkBareSelectors(html);
	for (const issue of bareSelectorIssues) {
		errors.push(issue);
	}

	// 3. Class validation (warnings)
	const { issues: classIssues, stats } = checkClasses(html, allowedClasses);
	for (const issue of classIssues) {
		warnings.push(issue);
	}

	// 4. Inline style detection (warnings)
	const styleIssues = checkInlineStyles(html);
	for (const issue of styleIssues) {
		warnings.push(issue);
	}

	// 5. HTML well-formedness (warnings)
	const htmlIssues = checkWellFormedness(html);
	for (const issue of htmlIssues) {
		warnings.push(issue);
	}

	// Fill in disallowed element count
	stats.disallowed_elements = elementIssues.length;

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		stats
	};
}
