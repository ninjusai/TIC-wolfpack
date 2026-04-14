/**
 * CSS Scraper — Manual Verification Tests
 *
 * Run with:  npx tsx src/lib/server/css-scraper.test.ts
 *
 * These are structured smoke tests for manual verification against
 * the live BookingTimes sites.  They are NOT unit tests with mocks;
 * they hit the network.
 */

import { scrapeSiteCSS } from './css-scraper.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function header(msg: string) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`  ${msg}`);
	console.log('='.repeat(60));
}

function assert(condition: boolean, label: string) {
	if (condition) {
		console.log(`  [PASS] ${label}`);
	} else {
		console.error(`  [FAIL] ${label}`);
		process.exitCode = 1;
	}
}

// ---------------------------------------------------------------------------
// Test: Metro Driving (known BookingTimes site)
// ---------------------------------------------------------------------------

async function testMetroDriving() {
	header('Test: Metro Driving — https://metrodriving.com.au');

	const result = await scrapeSiteCSS('https://metrodriving.com.au');

	console.log(`  Scraped at:      ${result.scrapedAt}`);
	console.log(`  Stylesheets:     ${result.stylesheets.length}`);
	console.log(`  Total size:      ${(result.totalSize / 1024).toFixed(1)} KB`);
	console.log(`  Errors:          ${result.errors.length}`);

	if (result.errors.length > 0) {
		result.errors.forEach((e) => console.log(`    - ${e}`));
	}

	assert(result.stylesheets.length > 0, 'Found at least one stylesheet');
	assert(result.totalSize > 0, 'Total size > 0');

	// LoadCSS detection
	const loadCSS = result.stylesheets.filter((s) => s.isLoadCSS);
	console.log(`\n  LoadCSS sheets:  ${loadCSS.length}`);
	loadCSS.forEach((s) => console.log(`    key=${s.loadCSSKey}  size=${s.fileSize}`));
	assert(loadCSS.length > 0, 'Found at least one LoadCSS stylesheet');
	assert(loadCSS.some((s) => s.loadCSSKey === '874264'), 'Metro LoadCSS key is 874264');

	// Bootstrap detection
	const bootstrap = result.stylesheets.filter((s) => s.isBootstrap);
	console.log(`\n  Bootstrap sheets: ${bootstrap.length}`);
	assert(bootstrap.length > 0, 'Detected Bootstrap CSS');

	// Font Awesome detection
	const fa = result.stylesheets.filter((s) => s.isFontAwesome);
	console.log(`  FA sheets:        ${fa.length}`);
	assert(fa.length > 0, 'Detected Font Awesome CSS');

	// Summary table
	header('Stylesheet summary');
	for (const s of result.stylesheets) {
		const flags = [
			s.isBootstrap ? 'BS' : '',
			s.isUIKit ? 'UK' : '',
			s.isFontAwesome ? 'FA' : '',
			s.isLoadCSS ? `LoadCSS(${s.loadCSSKey})` : ''
		]
			.filter(Boolean)
			.join(', ');
		const sizeKb = (s.fileSize / 1024).toFixed(1);
		const label = s.sourceType === 'inline' ? '[inline]' : s.url;
		console.log(`  ${sizeKb.padStart(8)} KB  ${flags.padEnd(20)}  ${label}`);
	}
}

// ---------------------------------------------------------------------------
// Test: Invalid URL
// ---------------------------------------------------------------------------

async function testInvalidUrl() {
	header('Test: Invalid / unreachable URL');

	const result = await scrapeSiteCSS('https://this-domain-definitely-does-not-exist-xyz123.com');

	assert(result.errors.length > 0, 'Reports an error for unreachable URL');
	assert(result.stylesheets.length === 0, 'No stylesheets for unreachable URL');
	console.log(`  Error: ${result.errors[0]}`);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
	console.log('CSS Scraper — Manual Verification Suite');
	await testInvalidUrl();
	await testMetroDriving();
	console.log('\nDone.');
}

main().catch(console.error);
