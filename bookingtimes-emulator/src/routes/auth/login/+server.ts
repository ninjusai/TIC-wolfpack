import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { generatePKCE, storePKCE, buildAuthorizationUrl } from '$lib/server/oauth';

export const GET: RequestHandler = async () => {
	// Generate PKCE pair
	const { codeVerifier, codeChallenge } = generatePKCE();

	// Generate random state for CSRF protection
	const state = randomBytes(16).toString('base64url');

	// Store code verifier keyed by state (in-memory)
	storePKCE(state, codeVerifier);

	// Build authorization URL and redirect
	const authUrl = buildAuthorizationUrl(codeChallenge, state);

	throw redirect(302, authUrl);
};
