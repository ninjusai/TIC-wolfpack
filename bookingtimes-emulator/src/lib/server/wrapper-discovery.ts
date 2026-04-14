/**
 * Content-Area Wrapper Discovery (WRK-016)
 *
 * Analyzes scraped HTML to discover the DOM wrapper structure around the
 * main content area. Bookingtimes.com sites typically use Bootstrap 5
 * container/row/col patterns.
 *
 * The discovered wrapper is used by the preview iframe to correctly frame
 * generated page content within the site's layout structure.
 */

export interface ContentWrapper {
	/** Opening wrapper HTML, e.g. '<div class="container"><div class="row"><div class="col-lg-12">' */
	opening_html: string;
	/** Closing tags, e.g. '</div></div></div>' */
	closing_html: string;
	/** Classes found on wrapper elements */
	wrapper_classes: string[];
}

/** Default fallback wrapper using standard Bootstrap 5 layout */
const DEFAULT_WRAPPER: ContentWrapper = {
	opening_html: '<div class="container"><div class="row"><div class="col-lg-12">',
	closing_html: '</div></div></div>',
	wrapper_classes: ['container', 'row', 'col-lg-12']
};

/**
 * Content wrapper detection strategies, ordered by specificity.
 * Each strategy looks for a known pattern and extracts the ancestor chain.
 */
interface WrapperCandidate {
	opening_html: string;
	closing_html: string;
	wrapper_classes: string[];
	confidence: number;
}

/**
 * Extract class attribute value from a tag string.
 */
function extractClasses(tag: string): string[] {
	const match = tag.match(/class\s*=\s*["']([^"']+)["']/i);
	if (!match) return [];
	return match[1].split(/\s+/).filter(Boolean);
}

/**
 * Build an opening tag string from tag name and classes.
 */
function buildTag(tagName: string, classes: string[]): string {
	if (classes.length === 0) return `<${tagName}>`;
	return `<${tagName} class="${classes.join(' ')}">`;
}

/**
 * Strategy 1: Look for <main> element with ancestor containers.
 */
function findMainElement(html: string): WrapperCandidate | null {
	const mainMatch = html.match(/<main\b[^>]*>/i);
	if (!mainMatch) return null;

	const mainTag = mainMatch[0];
	const mainClasses = extractClasses(mainTag);

	// Look for a container div before <main>
	const beforeMain = html.slice(0, mainMatch.index);
	const containerMatch = beforeMain.match(
		/<div\b[^>]*class\s*=\s*["'][^"']*\b(container(?:-fluid)?)\b[^"']*["'][^>]*>\s*$/i
	);

	const allClasses = [...mainClasses];
	const parts: string[] = [];
	const closingParts: string[] = [];

	if (containerMatch) {
		const containerClasses = extractClasses(containerMatch[0]);
		allClasses.push(...containerClasses);
		parts.push(buildTag('div', containerClasses));
		closingParts.push('</div>');
	}

	parts.push(mainClasses.length > 0 ? buildTag('main', mainClasses) : '<main>');
	closingParts.push('</main>');

	return {
		opening_html: parts.join(''),
		closing_html: closingParts.reverse().join(''),
		wrapper_classes: allClasses,
		confidence: 0.9
	};
}

/**
 * Strategy 2: Look for Bootstrap container > row > col pattern.
 */
function findBootstrapPattern(html: string): WrapperCandidate | null {
	// Match container > row > col chain
	const pattern =
		/<div\b[^>]*class\s*=\s*["'][^"']*\b(container(?:-fluid)?)\b[^"']*["'][^>]*>\s*<div\b[^>]*class\s*=\s*["'][^"']*\b(row)\b[^"']*["'][^>]*>\s*<div\b[^>]*class\s*=\s*["'][^"']*\b(col(?:-(?:sm|md|lg|xl|xxl))?(?:-\d{1,2})?)\b[^"']*["'][^>]*>/i;

	const match = html.match(pattern);
	if (!match) return null;

	// Re-extract the full tags to get all classes
	const fullMatch = match[0];
	const tagRegex = /<div\b[^>]*>/gi;
	const tags: string[] = [];
	let tagMatch: RegExpExecArray | null;
	while ((tagMatch = tagRegex.exec(fullMatch)) !== null) {
		tags.push(tagMatch[0]);
	}

	const allClasses: string[] = [];
	const openParts: string[] = [];

	for (const tag of tags) {
		const classes = extractClasses(tag);
		allClasses.push(...classes);
		openParts.push(buildTag('div', classes));
	}

	return {
		opening_html: openParts.join(''),
		closing_html: tags.map(() => '</div>').join(''),
		wrapper_classes: allClasses,
		confidence: 0.85
	};
}

/**
 * Strategy 3: Look for content/article semantic wrappers.
 */
function findSemanticWrapper(html: string): WrapperCandidate | null {
	// Look for <article>, <section>, or div#content / div.content
	const patterns = [
		{ regex: /<article\b[^>]*>/i, tagName: 'article', closingTag: '</article>' },
		{
			regex: /<div\b[^>]*id\s*=\s*["']content["'][^>]*>/i,
			tagName: 'div',
			closingTag: '</div>'
		},
		{
			regex: /<div\b[^>]*class\s*=\s*["'][^"']*\bcontent\b[^"']*["'][^>]*>/i,
			tagName: 'div',
			closingTag: '</div>'
		},
		{
			regex: /<section\b[^>]*class\s*=\s*["'][^"']*\b(?:content|main)\b[^"']*["'][^>]*>/i,
			tagName: 'section',
			closingTag: '</section>'
		}
	];

	for (const { regex, tagName, closingTag } of patterns) {
		const match = html.match(regex);
		if (match) {
			const classes = extractClasses(match[0]);
			const idMatch = match[0].match(/id\s*=\s*["']([^"']+)["']/i);

			let tag: string;
			if (idMatch && classes.length > 0) {
				tag = `<${tagName} id="${idMatch[1]}" class="${classes.join(' ')}">`;
			} else if (idMatch) {
				tag = `<${tagName} id="${idMatch[1]}">`;
			} else {
				tag = buildTag(tagName, classes);
			}

			return {
				opening_html: tag,
				closing_html: closingTag,
				wrapper_classes: classes,
				confidence: 0.7
			};
		}
	}

	return null;
}

/**
 * Strategy 4: Look for any container div (weakest signal).
 */
function findContainerDiv(html: string): WrapperCandidate | null {
	const match = html.match(
		/<div\b[^>]*class\s*=\s*["'][^"']*\b(container(?:-fluid)?)\b[^"']*["'][^>]*>/i
	);
	if (!match) return null;

	const classes = extractClasses(match[0]);

	return {
		opening_html: buildTag('div', classes),
		closing_html: '</div>',
		wrapper_classes: classes,
		confidence: 0.5
	};
}

/**
 * Discover the content wrapper structure from page HTML.
 *
 * Runs multiple detection strategies in order of confidence and returns
 * the best match. Falls back to a standard Bootstrap container/row/col
 * wrapper if nothing is detected.
 */
export function discoverContentWrapper(html: string): ContentWrapper {
	const strategies = [
		findMainElement,
		findBootstrapPattern,
		findSemanticWrapper,
		findContainerDiv
	];

	let best: WrapperCandidate | null = null;

	for (const strategy of strategies) {
		const candidate = strategy(html);
		if (candidate && (!best || candidate.confidence > best.confidence)) {
			best = candidate;
		}
	}

	if (best) {
		return {
			opening_html: best.opening_html,
			closing_html: best.closing_html,
			wrapper_classes: best.wrapper_classes
		};
	}

	return DEFAULT_WRAPPER;
}
