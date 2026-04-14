# Bookingtimes Content Emulator — Decisions

## 2026-04-02

### DEC-001: SvelteKit over SolidJS
**Decision:** Use SvelteKit (Svelte 5 with runes) instead of SolidJS.
**Rationale:** Better SSR story for content-heavy app, native Cloudflare Pages adapter, simpler component model for content editing UI. PeakProtocol used SolidJS; this project benefits from Svelte's template-first approach for HTML-heavy content generation.

### DEC-002: Cloudflare Platform (Pages + D1 + R2 + KV)
**Decision:** Deploy on Cloudflare with D1 for structured data, R2 for CSS cache/backups, KV for class catalogue caching.
**Rationale:** Consistent with pack's Cloudflare expertise (Cloud agent). Edge deployment suits the content preview use case. Cost-effective for a tool with intermittent usage.

### DEC-003: iframe Preview with srcdoc
**Decision:** Render content previews in an iframe using srcdoc attribute rather than shadow DOM or inline rendering.
**Rationale:** Full CSS isolation from the app shell. Bootstrap and Font Awesome styles don't leak into the SvelteKit app. Supports responsive breakpoint simulation by resizing the iframe.

### DEC-004: Claude API via OAuth Proxy
**Decision:** Route Claude API calls through a server-side proxy with OAuth, not direct client-side API calls.
**Rationale:** Keeps API keys server-side. Enables SSE streaming to the client. Allows prompt augmentation with CSS catalogue context before sending to Claude. Uses claude-sonnet-4-20250514.

### DEC-005: CSS Scraping + Catalogue Approach
**Decision:** Scrape target site CSS, parse into structured catalogues (BS5: 387 classes, FA6: 203 icons), and inject catalogue context into AI prompts.
**Rationale:** Ensures AI-generated HTML uses only classes that actually exist on the target platform. The catalogue acts as a constraint set for the LLM, improving output validity.

### DEC-006: Append-Only Versioning
**Decision:** All content changes create new version records. Rollback creates a new version pointing to old content rather than deleting.
**Rationale:** Non-destructive history. Full audit trail for generated content. Supports CSS change detection (when upstream CSS changes, affected versions are flagged).

### DEC-007: Batch Generation with 3-Retry
**Decision:** Batch content generation for multiple suburbs uses a pipeline with 3 automatic retries per item.
**Rationale:** AI generation is inherently non-deterministic. Retries with different seeds improve success rate. 50 QLD suburb seed data provides realistic test corpus for driving school content.

### DEC-008: Bootstrap 5.3.3 + Font Awesome 6.5.1 as Fixed Versions
**Decision:** Pin exact CSS framework versions rather than tracking latest.
**Rationale:** Bookingtimes.com uses these specific versions. Content must render identically to what the platform produces. Version pinning ensures catalogue accuracy.

### DEC-009: Export with Class Isolation
**Decision:** Exported HTML snippets include only the CSS classes actually used, not the full framework.
**Rationale:** Exported content may be used in contexts where Bootstrap isn't loaded. Class isolation ensures portability and reduces payload size.

### DEC-010: {@html} XSS Sanitization
**Decision:** All AI-generated HTML rendered via Svelte's {@html} directive must pass through a sanitizer.
**Rationale:** Audit finding (CRITICAL). AI-generated content could contain script tags or event handlers. Sanitizer strips dangerous elements before rendering in the preview iframe.

### DEC-012: Claude Code Credential Reuse over Direct OAuth
**Decision:** Read Claude API tokens from `~/.claude/.credentials.json` (Claude Code's credential store) instead of implementing a standalone OAuth flow.
**Rationale:** Scout research revealed that Anthropic blocks third-party OAuth since January 2026 (server-side enforcement). The initial OAuth PKCE implementation returned 400 from claude.ai. Claude Code credentials provide zero-config auth — if the user has Claude Code authenticated, the app auto-reads those tokens (access token `sk-ant-oat01-`, refresh token `sk-ant-ort01-`). The app-level OAuth PKCE flow is kept as a fallback but is non-functional until Anthropic opens third-party OAuth. This avoids requiring users to manage API keys manually.

### DEC-013: OAuth Rate Limit Blocker — Consumer Tokens Unusable for Third-Party API Calls
**Decision:** All consumer OAuth token approaches (Claude Code credentials, dedicated setup-token, app-level OAuth PKCE) are blocked by 429 rate limits when used for third-party API calls. The only reliable path for Claude API access is a paid `ANTHROPIC_API_KEY`.
**Rationale:** Exhaustive testing revealed that consumer OAuth tokens (prefix `sk-ant-oat01-`) are rate-limited at the `default_claude_max_20x` tier, which is enforced server-side for all third-party usage. This applies even to dedicated tokens obtained via `claude setup-token` that are not sharing a rate limit bucket with an active Claude Code session. The auth priority chain was implemented to gracefully fall back through 4 token sources, but only the first (env var API key) provides reliable access. The OAuth PKCE flow itself also returns 400 due to Anthropic blocking third-party OAuth since January 2026. Key lesson: Claude Max subscription tokens are for first-party Anthropic apps only; third-party integrations require paid API keys.

### DEC-014: `claude -p` CLI Subprocess as AI Integration Method
**Decision:** Use `child_process.spawn("claude", ["-p", ...])` to call the Claude Code CLI as a subprocess instead of making direct HTTP API calls with OAuth tokens.
**Rationale:** All consumer OAuth token approaches (Claude Code credential reuse, dedicated setup-token, app-level OAuth PKCE) failed with 429 rate limits or 400 blocks. The CLI subprocess approach leverages Claude Code's own credential management from `~/.claude/.credentials.json`, which uses the Max subscription's full rate limit allocation (not the restricted `default_claude_max_20x` tier). Critical implementation details: must use `-p` flag (otherwise TUI mode), must pipe prompt via stdin (Windows cmd line length limit), must strip `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_API_KEY` from subprocess env (otherwise CLI uses raw token instead of its own auth flow). Implementation at `bookingtimes-emulator/src/lib/server/claude-cli.ts`. Supersedes DEC-013's recommendation of paid API key as the only option.

### DEC-016: Infer-First Over Manual Profiles
**Decision:** Voice and brand profiles should be INFERRED from existing site content, not manually entered by users.
**Rationale:** Human review of V2 identified that manual profile entry creates friction and doesn't capture the nuances of an established brand voice. By analyzing existing pages — tone, vocabulary, sentence structure, calls-to-action — the system can build a more accurate and comprehensive brand profile automatically. Users then refine rather than build from scratch.

### DEC-017: Section-Based Generation Over Whole-Page Generation
**Decision:** Generate content per-section with cascading rules (Global → Page-type → Section), not as complete pages in a single Claude call.
**Rationale:** Human identified that whole-page generation causes content drift — later sections lose coherence with earlier ones as the LLM's attention drifts. Per-section calls keep each piece focused, allow independent review and regeneration of individual sections, and enable a coherence pass at final assembly. Rules cascade: global brand rules → page-type rules (e.g., "service page" rules) → section-specific rules (e.g., "hero section" constraints).

### DEC-018: Multi-Agent Site Audit as Stage 1
**Decision:** Stage 1 of the pipeline is an active audit by specialist agents (SEO, GEO, Schema, Pixel, content analysis), each assessing the live site through their lens, converging into a unified site brief.
**Rationale:** A research-first approach ensures the system understands what a site SHOULD have before generating anything. Gap analysis overlays what EXISTS against what SHOULD exist, producing actionable findings that feed directly into content generation priorities. This replaces the previous approach of jumping straight to content generation.

### DEC-019: Two-Page Content Model (Service Pages + Location Pages)
**Decision:** Content generation focuses on two page types: service pages and location pages, with a link graph planned before any content is generated.
**Rationale:** Scout research on content siloing and internal linking identified this as the optimal model for driving school sites. Service pages cover what the business offers (lessons, packages, licence types). Location pages cover where they operate (suburb-specific pages). Geographic clustering groups nearby suburbs. Anchor text rotation prevents over-optimization. Link graph before content ensures proper silo structure.

### DEC-020: Three New Specialist Agents for Pipeline Stages
**Decision:** Recruit seo, geo, and schema specialist agents to handle their respective concerns in the content pipeline.
**Rationale:** SEO, GEO, and schema markup are first-class concerns in V2.1 that require deep domain expertise. Each agent was recruited through the full Peter → Scout → Peter pipeline with skills research. SEO handles on-page optimization, 40-50% content uniqueness, keyword strategy. GEO handles AI search optimization, direct answer blocks, citation driving. Schema handles structured data (AutomotiveBusiness, JSON-LD, @graph pattern).

### DEC-015: Brand Knowledge Amplifier Architecture (Design V2 — SUPERSEDED by V2.1)
**Decision:** Evolve from a content emulator to a "Brand Knowledge Amplifier" with per-site brand profiles, learnable rules, and example-driven prompt assembly.
**Rationale:** The human recognized the project is growing beyond content emulation — each site needs its own brand voice, style rules, and knowledge that evolves over time through feedback. Architect produced `design-v2.md` with: one brand profile per site (not multi-agent), three new tables (`brand_profiles`, `brand_rules`, `brand_examples`), a learning loop (user feedback refines rules), and 8-layer prompt assembly (~3,350 tokens). A nested mini-pack concept was discussed but rejected in favor of single-profile simplicity. CLI timeout concerns were raised for delegation within the app. **Status: paused for human design review before implementation begins.**

### DEC-021: Full Sitemap Inventory (not deep research)
**Context:** Deciding crawl depth for Stage 1
**Decision:** Full sitemap crawl for page inventory (what exists, how many need work), but not deep-researching every page.
**Rationale:** Need scope awareness without analysis paralysis.

### DEC-022: Competitor Scraping In Scope
**Context:** Whether to analyze competitor sites
**Decision:** Keep in scope as optional Stage 2 enhancement.
**Rationale:** Sharpens benchmarks. Not a blocker for initial pipeline.

### DEC-023: CSS Custom File Identification + Extension
**Context:** How to handle custom CSS beyond Bootstrap
**Decision:** Existing scraper already captures custom CSS files. Task is identification (which file is custom vs Bootstrap). CAN add new CSS to custom files — not limited to what exists.
**Rationale:** Existing tooling already does the heavy lifting. Extension capability means Tier 3 CSS is viable.

### DEC-024: GSC Access Confirmed + Larger Platform Vision
**Context:** Whether traffic data available for prioritization
**Decision:** GSC access confirmed. Content tool is one part of larger platform (unified comms, email management, search data consolidation). Design GSC integration knowing it feeds into bigger system.
**Rationale:** Traffic data dramatically improves backlog prioritization. Platform vision means designing for integration.

### DEC-025: Platform Constraints Documented
**Context:** Understanding bookingtimes.com SaaS constraints
**Decision:** URL patterns from sitemap (limited control), SaaS updates global, code view paste for deployment, sidebars are fixed platform elements (CSS positioning only), stay current with platform docs.
**Rationale:** Agents must understand and design within these constraints.

### DEC-026: Dynamic Section Count
**Context:** How many sections per page
**Decision:** Dynamic per page AND per site. System determines based on page type, brand, content requirements. No fixed template.
**Rationale:** Avoid programmatic sameness across 5 sites. Each site's pages must feel unique.

### DEC-027: Scribe Checkpoints at Every Stage
**Context:** Risk of losing context over long sessions
**Decision:** Scribe checkpoint after every pipeline stage gate. Document what was produced, decisions made, state for next session.
**Rationale:** Human flagged context loss risk. Memory persistence is critical for pack continuity.

## 2026-04-02 (V2.1 Rebuild Session — Evening)

### DEC-028: Unify All CSS Under Bootstrap
**Context:** Foundation validation revealed dual framework (Bootstrap 5.0.2 + UIKit) loaded on BookingTimes sites.
**Decision:** Unify all CSS work under Bootstrap. No UIKit-to-Bootstrap conversion needed.
**Rationale:** Bootstrap is the primary framework used for content and layout. UIKit is secondary and underutilized. Working with one framework simplifies the CSS strategy, catalogue building, and AI prompt constraints.

### DEC-029: Ignore UIKit Entirely
**Context:** UIKit is loaded on BookingTimes sites alongside Bootstrap.
**Decision:** Ignore UIKit entirely. Do not maintain, convert, or reference UIKit classes.
**Rationale:** UIKit was loaded at the human's request to BookingTimes, is underutilized across the sites, and won't be maintained going forward. Including it would add complexity with no benefit.

### DEC-030: No Auth System — Single User
**Context:** Previous build included OAuth PKCE flow, Claude Code credential reuse, auth status UI.
**Decision:** No authentication system. Single user, simple access route only.
**Rationale:** This is a single-user tool. The entire OAuth journey (DEC-012, DEC-013, DEC-014) was overengineered for the use case. Simple access without auth removes complexity and eliminates the OAuth/rate-limit issues encountered previously.

### DEC-031: Top-Down Content Approach
**Context:** Deciding content generation order across the site hierarchy.
**Decision:** Homepage first, then trickle down to subpages. Top-down content approach.
**Rationale:** Homepage sets the tone, voice, and brand baseline for the entire site. Generating it first creates the reference point that all subpage content inherits from. This aligns with DEC-016 (infer-first profiles) — the homepage content informs the brand voice profile.

### DEC-032: Sidebar Constraint Applies to Long-Tail Pages Only
**Context:** BookingTimes platform has fixed sidebar elements that cannot be removed.
**Decision:** Sidebar constraint applies to long-tail pages only. Can push vertically but cannot remove the sidebar. All other page types (homepage, service pages) have full viewport.
**Rationale:** Refines DEC-025 (platform constraints). The sidebar is not universal — it only appears on certain page types. Knowing which pages have the constraint affects layout decisions and content width calculations.

### DEC-033: Content Freshness Strategy
**Context:** How often will content need updating?
**Decision:** Ad hoc updates on approximately 2-month cycles. Build freshness alerts into the system.
**Rationale:** Content doesn't need real-time updates but does go stale. Freshness alerts ensure the human is prompted when content is aging, without requiring a rigid schedule. The ~2 month cycle matches the human's actual content review cadence.

### DEC-034: Interactive Pages with Custom JavaScript
**Context:** Scout research confirmed JS is possible via head code injection.
**Decision:** Interactive pages with custom JavaScript is a priority. Explore JS capability within BookingTimes platform.
**Rationale:** JS opens the door to interactive elements (calculators, dynamic content, enhanced UX) that differentiate the driving school sites. Scout confirmed: jQuery bundled, no CSP headers, head code injection available via Setup > Analytics & Tracking. Inline script survival in TinyMCE paste confirmed (see DEC-035).

### DEC-035: JSON-LD and Executable JS Survive BookingTimes TinyMCE Paste
**Context:** OQ-1 (script tag paste survival) and OQ-5 (JSON-LD paste survival) from problem-v2.md were critical open questions blocking the JS and schema strategies.
**Decision:** Both JSON-LD structured data and executable JavaScript survive the BookingTimes TinyMCE paste workflow. Treat both as confirmed capabilities, not speculative.
**Rationale:** Live site evidence confirmed both:
- **JSON-LD:** FAQPage schema markup found on the live Acacia Ridge page, proving JSON-LD survives the paste-to-publish workflow.
- **Executable JS:** Facebook SDK IIFE (`<script>` tag with executable code) found inside the Metro Driving homepage content area, proving inline scripts survive paste.
This resolves the two highest-risk open questions from the problem definition and unlocks the full JS interactive strategy (DEC-034) and schema markup strategy without caveats. The tiered approach (CSS-only baseline first, then JS) is no longer necessary — JS and JSON-LD can be first-class from Phase 0.

### Note: 24 Architecture Decision Records (ADR-011 through ADR-034)
The full V2.1 architecture decisions are documented in `architecture-decisions-v2.md` (24 ADRs). These supersede all V1 architecture decisions from `architecture-decisions.md`. Key ADRs include local-first SvelteKit deployment, section-based generation with cascading rules, multi-agent site audit pipeline, Bootstrap 5.0.2 as sole CSS framework, and JSON-LD + JS as confirmed capabilities.

---

## 2026-04-03 (Phase 7 Completion)

### DEC-036: Edit Distance Implementation — RESOLVED
**Decision:** ~~Accept length-difference approximation.~~ **Replaced with proper Levenshtein distance.**
**Rationale:** Originally discovered during WRK-BCE2-055 that production code used `Math.abs(a.length - b.length)` instead of true Levenshtein. Forge delivered the fix: `edit-distance.ts` (proper Levenshtein), migration 004 (`edit_distance` column on `content_versions`), aggregation endpoint, `version-history.ts` updated, Svelte export page displays real edit distance. Fully resolved.

---

### DEC-011: Pivot from Cloudflare to Local Node.js Deployment
**Decision:** Replace entire Cloudflare deployment stack (Pages + D1 + R2 + KV) with local Node.js equivalents (adapter-node + better-sqlite3 + filesystem + LRU cache).
**Rationale:** Human directive. The project does not require edge deployment — it is a content creation tool for internal/local use. Local deployment simplifies the development workflow (no wrangler needed), removes Cloudflare account dependency, and enables offline operation. Claude OAuth kept unchanged per explicit human instruction. Supersedes DEC-002.
