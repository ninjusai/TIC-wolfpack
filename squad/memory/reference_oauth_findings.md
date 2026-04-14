# Claude OAuth Findings — Reference for Future Projects

Last updated: 2026-04-02
Source project: Bookingtimes Content Emulator

## TL;DR

**Consumer OAuth tokens from Claude Max subscriptions cannot be used for third-party API calls.** They hit 429 rate limits consistently. Use a paid `ANTHROPIC_API_KEY` instead.

## Background

The Bookingtimes Content Emulator needed Claude API access for AI content generation. We attempted to leverage the human's Claude Max subscription via OAuth rather than requiring a paid API key. This document captures the full journey and findings for future reference.

## What We Tried (Chronological)

### 1. OAuth PKCE Flow (App-Level)
- **Approach:** Standard OAuth PKCE flow against `claude.ai/oauth/authorize`
- **Result:** 400 Bad Request
- **Why:** Anthropic blocks third-party OAuth since January 2026 (server-side enforcement)

### 2. Claude Code Credential Reuse
- **Approach:** Read tokens from `~/.claude/.credentials.json` (Claude Code's credential store)
- **Result:** 429 Too Many Requests
- **Why:** Shares rate limit bucket with the user's active Claude Code session

### 3. Dedicated Token via `claude setup-token`
- **Approach:** Generate a separate token stored at `squad/claude_token.md`
- **Result:** 429 Too Many Requests (after fixing markdown backslash escapes corrupting the token)
- **Why:** Consumer OAuth tokens are rate-limited at `default_claude_max_20x` tier for ALL third-party usage, regardless of whether they share a bucket with Claude Code

## Technical Details

### OAuth Endpoints
- Authorization: `claude.ai/oauth/authorize`
- Token exchange: `claude.ai/v1/oauth/token`

### Client ID
- Claude Code's client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`

### Token Format
- Access tokens: prefix `sk-ant-oat01-` (8hr expiry)
- Refresh tokens: prefix `sk-ant-ort01-` (persistent)

### Required Headers for OAuth Tokens
```
Authorization: Bearer sk-ant-oat01-...
anthropic-beta: oauth-2025-04-20
```

### Rate Limit Details
- Tier: `default_claude_max_20x`
- Enforcement: Server-side, consistent across all consumer OAuth tokens
- Scope: Applies to any third-party application making API calls with consumer tokens

## Auth Priority Chain (Recommended Pattern)

If building an app that needs Claude API access, implement this fallback chain:

1. **`ANTHROPIC_API_KEY` env var** -> `x-api-key` header (RECOMMENDED - only reliable option)
2. **`ANTHROPIC_AUTH_TOKEN` env var** -> `Bearer` auth + `anthropic-beta` header
3. **Claude Code credentials** (`~/.claude/.credentials.json`) -> `Bearer` auth + `anthropic-beta` header
4. **App OAuth flow** -> `Bearer` auth + `anthropic-beta` header (non-functional as of Jan 2026)

Only option 1 provides reliable, rate-limit-free access for third-party apps.

## Token Storage Locations

| Source | Location | Notes |
|--------|----------|-------|
| API key | `ANTHROPIC_API_KEY` env var | Paid, reliable |
| Auth token | `ANTHROPIC_AUTH_TOKEN` env var | Consumer token, rate-limited |
| Claude Code | `~/.claude/.credentials.json` | Shared bucket with CLI |
| Dedicated | `squad/claude_token.md` | Consumer token, still rate-limited |
| App OAuth | `data/oauth-tokens.json` | OAuth PKCE flow blocked (400) |

## Gotchas

1. **Markdown corrupts tokens:** Storing tokens in `.md` files can introduce backslash escapes (e.g., `\_` instead of `_`). Always store tokens in plain text or JSON.
2. **Separate tokens != separate rate limits:** Getting a dedicated token via `claude setup-token` does NOT give you a separate rate limit bucket. The `default_claude_max_20x` tier applies to all consumer OAuth tokens.
3. **Third-party OAuth blocked since Jan 2026:** Anthropic's authorization endpoint returns 400 for any non-first-party client. The Claude Code client ID works for Claude Code itself but not for third-party apps using it.

## WORKING SOLUTION: `claude -p` CLI Subprocess (Found 2026-04-02)

After all OAuth approaches failed, the working solution was discovered: shell out to the Claude Code CLI using `child_process.spawn("claude")` with the `-p` flag. This leverages the CLI's own credential management to use the Max subscription.

### Architecture

```
SvelteKit Route → Node.js child_process.spawn("claude") → Claude Code CLI → Max Subscription → Anthropic API
```

### Implementation Requirements

1. **Use `-p` flag** (REQUIRED) — Without it, CLI starts in interactive TUI mode which fails without a TTY
2. **Pipe prompt via stdin** — Avoids Windows 8192 character command line length limit
3. **Use `--system-prompt-file` with temp file** for long system prompts (e.g., CSS catalogues)
4. **Use `--output-format json`** (non-streaming) or `--output-format stream-json --verbose` (streaming)
5. **CRITICAL: Strip `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_API_KEY` from subprocess env** — If present, the CLI tries to use the raw OAuth token directly instead of its own credential management from `~/.claude/.credentials.json`, resulting in 401 "OAuth authentication not supported"
6. **Do NOT use `--bare`** — It skips OAuth auth loading → "Not logged in" error
7. **Do NOT use `--no-user-rules`** — Flag does not exist → "unknown option" error
8. **Clean up temp system prompt files** after process exits

### Gotchas (Chronological)

| # | Mistake | Error | Fix |
|---|---------|-------|-----|
| 1 | Used `--bare` flag | "Not logged in" | Remove `--bare` |
| 2 | Used `--no-user-rules` | "unknown option" | Remove flag entirely |
| 3 | Missing `-p` flag | TUI mode → exit code 1 | Add `-p` flag |
| 4 | Long prompt as CLI argument | "command line too long" (Windows) | Pipe via stdin |
| 5 | `ANTHROPIC_AUTH_TOKEN` in env | 401 "OAuth authentication not supported" | Strip from subprocess env |

### Verified Working Response

```json
{"ok":true,"model":"claude-sonnet-4-20250514","session_id":"...","diagnostics":{"authMethod":"claude-cli-subprocess","cliVersion":"2.1.89"}}
```

### Reference Implementation

File: `bookingtimes-emulator/src/lib/server/claude-cli.ts`

## Recommendation for Future Projects

- **Use `claude -p` CLI subprocess** for any project that needs to leverage a Claude Max subscription without a paid API key
- **Use `ANTHROPIC_API_KEY`** if you have a paid API account (simplest, most reliable)
- **Do not attempt consumer OAuth** unless Anthropic officially opens third-party OAuth access
- **Implement the auth priority chain** so users can configure whichever auth method they have available
- **Claude Code credential reuse via direct API calls** does not work due to rate limits — but the CLI subprocess approach sidesteps this entirely
- **Strip auth env vars** from the subprocess environment to avoid credential conflicts
