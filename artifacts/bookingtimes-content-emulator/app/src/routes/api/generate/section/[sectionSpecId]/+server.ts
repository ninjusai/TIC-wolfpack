import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSection } from '$lib/server/content-generator';

export const POST: RequestHandler = async ({ params }) => {
	const sectionSpecId = Number(params.sectionSpecId);
	if (!Number.isInteger(sectionSpecId) || sectionSpecId <= 0) {
		throw error(400, 'Invalid sectionSpecId — must be a positive integer');
	}

	try {
		const result = await generateSection(sectionSpecId);
		return json(result);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('not found')) {
			throw error(404, msg);
		}
		throw error(500, `Generation failed: ${msg}`);
	}
};
