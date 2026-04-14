import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// ── Constants ─────────────────────────────────────────────────────────────

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTHORIZATION_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://claude.ai/v1/oauth/token';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';
const SCOPES = 'user:inference user:profile';
const TOKEN_FILE = join(process.cwd(), 'data', 'oauth-tokens.json');

// Claude Code credentials file (auto-detected from ~/.claude/.credentials.json)
const CLAUDE_CODE_CREDENTIALS_FILE = join(homedir(), '.claude', '.credentials.json');

// ── Types ─────────────────────────────────────────────────────────────────

export type TokenSource = 'api_key' | 'auth_token' | 'claude_code' | 'oauth' | 'none';

export interface OAuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // Unix timestamp (seconds)
	scopes: string[];
	source?: TokenSource;
}

// ── In-memory PKCE storage (single user, local app) ───────────────────────

const pkceStore = new Map<string, string>(); // state -> codeVerifier

export function storePKCE(state: string, codeVerifier: string): void {
	pkceStore.set(state, codeVerifier);
}

export function retrievePKCE(state: string): string | null {
	const verifier = pkceStore.get(state) ?? null;
	if (verifier) pkceStore.delete(state);
	return verifier;
}

// ── Claude Code credentials ───────────────────────────────────────────────

/**
 * Read OAuth tokens from Claude Code's local credentials file.
 * Claude Code stores tokens at ~/.claude/.credentials.json after the user
 * authenticates via `claude` CLI. We piggyback on those tokens so users
 * don't need a separate OAuth dance.
 */
export function getClaudeCodeTokens(): OAuthTokens | null {
	try {
		if (!existsSync(CLAUDE_CODE_CREDENTIALS_FILE)) return null;
		const raw = readFileSync(CLAUDE_CODE_CREDENTIALS_FILE, 'utf-8');
		const data = JSON.parse(raw);

		const oauth = data?.claudeAiOauth;
		if (!oauth?.accessToken) return null;

		return {
			accessToken: oauth.accessToken,
			refreshToken: oauth.refreshToken ?? '',
			// Claude Code stores expiresAt in milliseconds; we normalize to seconds
			expiresAt: typeof oauth.expiresAt === 'number'
				? (oauth.expiresAt > 1e12 ? Math.floor(oauth.expiresAt / 1000) : oauth.expiresAt)
				: 0,
			scopes: Array.isArray(oauth.scopes) ? oauth.scopes : [],
			source: 'claude_code' as TokenSource
		};
	} catch {
		return null;
	}
}

// ── Token storage ─────────────────────────────────────────────────────────

/**
 * Check for ANTHROPIC_AUTH_TOKEN env var (dedicated OAuth token from `claude setup-token`).
 * This provides a separate token that doesn't share rate limits with Claude Code CLI.
 */
export function getAuthTokenFromEnv(): OAuthTokens | null {
	const token = process.env.ANTHROPIC_AUTH_TOKEN;
	if (!token) return null;

	return {
		accessToken: token,
		refreshToken: '',
		expiresAt: 0, // env-var tokens are managed externally; skip expiry checks
		scopes: [],
		source: 'auth_token' as TokenSource
	};
}

/**
 * Check for ANTHROPIC_API_KEY env var (standard API key).
 */
export function hasApiKey(): boolean {
	return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Returns tokens from the best available source (priority order):
 *   1. ANTHROPIC_API_KEY env var (not returned here — handled separately via x-api-key header)
 *   2. ANTHROPIC_AUTH_TOKEN env var (dedicated OAuth token from `claude setup-token`)
 *   3. Local app OAuth tokens (if the user completed our OAuth flow)
 *   4. Claude Code credentials (zero-config if Claude Code is installed)
 */
export function getStoredTokens(): OAuthTokens | null {
	// 1. ANTHROPIC_API_KEY is handled separately (not as OAuthTokens)

	// 2. ANTHROPIC_AUTH_TOKEN env var — dedicated OAuth token
	const authToken = getAuthTokenFromEnv();
	if (authToken) return authToken;

	// 3. Try app-level tokens
	try {
		if (existsSync(TOKEN_FILE)) {
			const raw = readFileSync(TOKEN_FILE, 'utf-8');
			const data = JSON.parse(raw);
			if (data.accessToken && data.refreshToken) {
				return { ...data, source: 'oauth' as TokenSource } as OAuthTokens;
			}
		}
	} catch {
		// fall through
	}

	// 4. Fall back to Claude Code credentials
	return getClaudeCodeTokens();
}

export function storeTokens(tokens: OAuthTokens): void {
	const dir = dirname(TOKEN_FILE);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
}

export function deleteTokens(): void {
	try {
		if (existsSync(TOKEN_FILE)) {
			unlinkSync(TOKEN_FILE);
		}
	} catch {
		// Ignore errors on delete
	}
}

export function isAuthenticated(): boolean {
	if (hasApiKey()) return true;
	const tokens = getStoredTokens();
	return tokens !== null;
}

export function getTokenSource(): TokenSource {
	if (hasApiKey()) return 'api_key';
	const tokens = getStoredTokens();
	return tokens?.source ?? 'none';
}

export function isTokenExpired(): boolean {
	if (hasApiKey()) return false; // API keys don't expire
	const tokens = getStoredTokens();
	if (!tokens) return true;
	if (tokens.source === 'auth_token') return false; // env var tokens managed externally
	// Consider expired 60 seconds early to avoid edge cases
	return Date.now() / 1000 >= tokens.expiresAt - 60;
}

// ── PKCE ──────────────────────────────────────────────────────────────────

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
	// code_verifier: 43-128 chars, base64url-encoded random bytes
	const codeVerifier = randomBytes(32)
		.toString('base64url')
		.slice(0, 64);

	// code_challenge: SHA256(code_verifier) base64url-encoded
	const codeChallenge = createHash('sha256')
		.update(codeVerifier)
		.digest('base64url');

	return { codeVerifier, codeChallenge };
}

// ── Authorization URL ─────────────────────────────────────────────────────

export function buildAuthorizationUrl(codeChallenge: string, state: string): string {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: CLIENT_ID,
		redirect_uri: REDIRECT_URI,
		scope: SCOPES,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
		state
	});
	return `${AUTHORIZATION_URL}?${params.toString()}`;
}

// ── Token exchange ────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
	code: string,
	codeVerifier: string
): Promise<OAuthTokens> {
	const response = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: REDIRECT_URI,
			client_id: CLIENT_ID,
			code_verifier: codeVerifier
		}).toString()
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Token exchange failed (${response.status}): ${errText}`);
	}

	const data = await response.json();

	const tokens: OAuthTokens = {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 28800),
		scopes: (data.scope ?? SCOPES).split(' ')
	};

	storeTokens(tokens);
	return tokens;
}

// ── Token refresh ─────────────────────────────────────────────────────────

export async function refreshAccessToken(): Promise<OAuthTokens> {
	const current = getStoredTokens();
	if (!current?.refreshToken) {
		throw new Error('No refresh token available — please sign in again');
	}

	const response = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: current.refreshToken,
			client_id: CLIENT_ID
		}).toString()
	});

	if (!response.ok) {
		const errText = await response.text();
		// If refresh fails, clear tokens so user can re-authenticate
		deleteTokens();
		throw new Error(`Token refresh failed (${response.status}): ${errText}`);
	}

	const data = await response.json();

	const tokens: OAuthTokens = {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? current.refreshToken,
		expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 28800),
		scopes: (data.scope ?? current.scopes.join(' ')).split(' ')
	};

	storeTokens(tokens);
	return tokens;
}

// ── Helper: get valid access token (auto-refresh if expired) ──────────────

export async function getValidAccessToken(): Promise<string> {
	if (!isAuthenticated()) {
		throw new Error('Not authenticated');
	}

	const tokens = getStoredTokens()!;

	// For env-var auth tokens, just return the value directly
	if (tokens.source === 'auth_token') {
		return tokens.accessToken;
	}

	// For Claude Code tokens, always re-read fresh from disk (Claude Code
	// manages its own refresh cycle). If the token looks expired, re-read
	// the file in case Claude Code has refreshed it.
	if (tokens.source === 'claude_code') {
		if (isTokenExpired()) {
			// Re-read in case Claude Code refreshed the token since we last checked
			const fresh = getClaudeCodeTokens();
			if (!fresh) {
				throw new Error('Claude Code credentials are no longer available — please re-authenticate via Claude Code CLI');
			}
			return fresh.accessToken;
		}
		return tokens.accessToken;
	}

	// Standard OAuth flow — use our own refresh
	if (isTokenExpired()) {
		const refreshed = await refreshAccessToken();
		return refreshed.accessToken;
	}

	return tokens.accessToken;
}
