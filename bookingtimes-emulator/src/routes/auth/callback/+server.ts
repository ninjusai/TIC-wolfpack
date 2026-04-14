import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { retrievePKCE, exchangeCodeForTokens } from '$lib/server/oauth';

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errorParam = url.searchParams.get('error');
	const errorDesc = url.searchParams.get('error_description');

	// Handle OAuth errors
	if (errorParam) {
		throw error(400, `OAuth error: ${errorParam} — ${errorDesc ?? 'No description'}`);
	}

	if (!code || !state) {
		throw error(400, 'Missing code or state parameter');
	}

	// Retrieve and validate PKCE code verifier
	const codeVerifier = retrievePKCE(state);
	if (!codeVerifier) {
		throw error(400, 'Invalid or expired state parameter — please try signing in again');
	}

	// Exchange authorization code for tokens
	try {
		await exchangeCodeForTokens(code, codeVerifier);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Token exchange failed: ${message}`);
	}

	// Redirect to auth page with success
	throw redirect(302, '/auth?success=true');
};
