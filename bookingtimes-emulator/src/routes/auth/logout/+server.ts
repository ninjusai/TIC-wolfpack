import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTokens } from '$lib/server/oauth';

export const POST: RequestHandler = async () => {
	deleteTokens();
	throw redirect(302, '/auth?logout=true');
};
