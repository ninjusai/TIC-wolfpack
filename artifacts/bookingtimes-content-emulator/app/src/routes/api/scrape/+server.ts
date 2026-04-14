import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeSiteCSS } from '$lib/server/css-scraper';

export const POST: RequestHandler = async ({ request }) => {
	let body: { siteUrl?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { siteUrl } = body;
	if (!siteUrl || typeof siteUrl !== 'string') {
		throw error(400, 'Missing or invalid "siteUrl" field');
	}

	// Basic URL validation
	try {
		new URL(siteUrl);
	} catch {
		throw error(400, 'Invalid URL format');
	}

	const result = await scrapeSiteCSS(siteUrl);
	return json(result);
};
