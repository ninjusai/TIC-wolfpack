import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStoredTokens, isAuthenticated, isTokenExpired, getTokenSource } from '$lib/server/oauth';

export const GET: RequestHandler = async () => {
	const authenticated = isAuthenticated();
	const source = getTokenSource();
	const tokens = getStoredTokens();

	return json({
		authenticated,
		expired: authenticated ? isTokenExpired() : null,
		expiresAt: tokens?.expiresAt ?? null,
		scopes: tokens?.scopes ?? [],
		source,
		// Human-readable label for the active auth source
		sourceLabel: source === 'api_key'
			? 'API Key (ANTHROPIC_API_KEY)'
			: source === 'auth_token'
				? 'Dedicated OAuth Token (ANTHROPIC_AUTH_TOKEN)'
				: source === 'claude_code'
					? 'Claude Code CLI credentials'
					: source === 'oauth'
						? 'OAuth sign-in'
						: 'Not authenticated'
	});
};
