---
title: "Problem Definition: Bookingtimes Content Emulator V2.1 Rebuild"
version: "1.0.0"
status: complete
last-updated: "2026-04-02"
author: framer
project: bookingtimes-content-emulator
problem-id: PRB-bookingtimes-content-emulator-002
source: intake-brief-v2.json
supersedes: problem.md (PRB-bookingtimes-content-emulator-001)
---

# Problem Definition: Bookingtimes Content Emulator V2.1 Rebuild

## 1. Problem Statement

A single operator manages content across 5 Australian driving school websites hosted on the BookingTimes SaaS platform. The current content lifecycle is entirely manual: writing, reviewing, and pasting HTML into a WYSIWYG code view editor, one page at a time, across all 5 sites. There is no tooling to:

1. **Understand what exists.** No way to systematically audit existing content, SEO health, structured data, or design quality across all 5 sites. The operator cannot answer "what's missing?" or "what's weak?" without manually inspecting every page.

2. **Understand what should exist.** No benchmark or standard for what a high-quality driving school website looks like from an SEO, GEO (Generative Engine Optimization), schema markup, or content architecture perspective. Decisions about what to build are based on intuition rather than gap analysis.

3. **Generate content that matches each site's identity.** Each of the 5 sites has a distinct brand voice, but there is no mechanism to capture, codify, or enforce that voice during content creation. Previous template-based batch generation produced content that was generic and failed quality standards.

4. **Optimize for AI-driven search.** As AI search engines (Google AI Overviews, Perplexity, ChatGPT) grow in importance, content must be structured for AI citation — direct answer blocks, FAQ schema, statistics density, freshness signals. No current tooling addresses this.

5. **Improve over time.** There is no feedback loop. Every content creation session starts from zero. Corrections made on one page do not carry forward to subsequent pages. The operator's accumulated knowledge about what works for each site is not captured by any system.

6. **Maintain content freshness.** With roughly 2-month update cycles and no alerting, stale content goes unnoticed until manually discovered.

### What Changed From V1

The V1 problem (PRB-bookingtimes-content-emulator-001) focused on CSS visibility, preview rendering, and batch template generation. V2.1 reframes the problem entirely:

| V1 Problem Focus | V2.1 Problem Focus |
|---|---|
| Cannot see available CSS classes | Cannot understand site health holistically (SEO, GEO, schema, design, voice) |
| Cannot preview content before deploying | Cannot generate content that sounds like it belongs on a specific site |
| Template-based batch generation is low quality | No pipeline from audit to research to gap analysis to generation |
| No version control | No learning loop — quality does not compound over time |
| Single concern: CSS fidelity | Multiple concerns: quality, SEO, GEO, brand voice, internal linking, schema |

V1 treated content creation as a rendering problem. V2.1 treats it as an intelligence problem — understanding what exists, what should exist, what the gap is, and filling that gap with content that improves with each iteration.

## 2. Users

### Primary User: Site Manager (Single Operator)

- **Role:** Sole manager of all 5 BookingTimes driving school websites
- **Goal:** Audit, generate, review, approve, and paste high-quality SEO/GEO-optimized content across all 5 sites with minimal manual effort
- **Context:** Handles the entire content lifecycle end-to-end. No other users. No delegation. Pastes approved HTML directly into BookingTimes' code view editor. Operates on an ad hoc schedule with no external deadlines.
- **Key behavior:** Reviews and refines generated content section by section. Provides feedback that should persist and improve future generations.

**There is one user. No authentication system is required.** (DEC-030)

## 3. Scope

### 3.1 In Scope

1. **Multi-dimensional site auditing** — Systematic assessment of each site's current state across SEO, GEO readiness, schema markup, visual design/CSS, and brand voice/content quality
2. **Competitive and domain benchmarking** — Establishing what a high-quality driving school website should look like based on industry research, SEO best practices, and GEO optimization standards
3. **Gap analysis** — Overlaying audit findings against benchmark standards to produce a prioritized backlog of content work per site
4. **Homepage-first content strategy** — Homepage is generated first per site as the foundational template; all subsequent pages inherit patterns established there (DEC-031)
5. **Section-based content generation** — Content produced section by section with per-section validation, not as whole pages in a single pass (DEC-017)
6. **Brand voice inference** — System infers each site's unique voice from existing content rather than requiring manual brand profile entry (DEC-016)
7. **SEO-optimized content** — Target suburb + service keywords, proper heading hierarchy, internal linking, E-E-A-T signals, 40-50% content uniqueness per suburb page
8. **GEO-optimized content** — Direct answer blocks, TLDR-first structure, FAQ schema, statistics density, freshness signals, named authorship for AI citation readiness
9. **Content architecture planning** — Site-wide link graph, content silos, and page taxonomy defined before any content generation
10. **CSS generation targeting Bootstrap 5.0.2** — Three-tier approach: Bootstrap base, existing site custom CSS, new custom CSS additions (DEC-028)
11. **Paste-ready HTML output** — All generated content must be directly pasteable into BookingTimes' WYSIWYG code view editor with no build steps
12. **Content freshness alerting** — System alerts when content becomes stale, targeting approximately 2-month review cycles (DEC-033)
13. **Interactive JavaScript elements** — Exploration and implementation of custom JS for clicks, engagement, and time on site, pending platform capability confirmation (DEC-034)
14. **Learning and feedback loop** — System captures per-site preferences and corrections from human review; subsequent generations for the same site reflect prior feedback
15. **All 5 target driving school sites**
16. **Structured data (schema markup)** — JSON-LD with @graph/@id pattern, AutomotiveBusiness type, FAQPage, BreadcrumbList, per-page specifications

### 3.2 Out of Scope

1. **Multi-user access or authentication** — Single user, no auth needed (DEC-030)
2. **Automated deployment to BookingTimes** — Manual paste is the confirmed workflow; no API exists
3. **Real-time collaboration features** — Single user
4. **URL structure changes** — Platform-controlled, not modifiable
5. **UIKit CSS framework** — Ignored entirely; Bootstrap 5.0.2 only (DEC-029, DEC-028)
6. **Cloud hosting for the tool itself** — Local deployment only (DEC-011)

## 4. Constraints

### 4.1 Platform Constraints (BookingTimes SaaS)

| Constraint | Detail |
|---|---|
| **Deployment mechanism** | Code view paste in WYSIWYG editor. No programmatic write path. |
| **Body-only HTML** | Generated content goes into the page body. No access to `<head>`. JSON-LD must be placed in `<body>` (supported by Google). |
| **Fixed sidebars** | Platform-controlled sidebar elements on long-tail pages only. Cannot be removed. Can be repositioned vertically (e.g., pushed below hero) via CSS but not eliminated. Other page types (homepage, service pages) have full viewport width. (DEC-032) |
| **URL patterns enforced** | Limited control over URL structure. Sitemap is the source of truth. |
| **SaaS updates are global** | Platform updates affect all 5 sites simultaneously. Content and CSS must be resilient to minor platform changes. |
| **Custom CSS files exist** | Each site has custom CSS files that can be identified among scraped assets. New CSS can be added to these files — not limited to what currently exists. (DEC-023) |
| **JavaScript capability unconfirmed** | Whether BookingTimes allows custom JS in page content has not been tested. This must be explored before interactive elements can be relied upon. |

### 4.2 Technology Constraints

| Constraint | Detail |
|---|---|
| **Local deployment** | Runs on the operator's machine. No cloud hosting for the tool itself. (DEC-011) |
| **SvelteKit frontend** | Locked technology choice. (DEC-001, modified by DEC-011) |
| **better-sqlite3** | Local SQLite for all structured data. (DEC-011) |
| **Claude CLI subprocess** | AI calls via `claude -p` CLI subprocess on Max subscription. No separate API key management. (DEC-014) |
| **Bootstrap 5.0.2** | Confirmed version on live sites. (DEC-028) |
| **Font Awesome 6 Pro** | Icon framework available on the platform. |

### 4.3 Process Constraints

| Constraint | Detail |
|---|---|
| **No deadlines** | Quality over speed. "It comes together when it comes together." |
| **Ad hoc update cadence** | Roughly every couple of months per site. |
| **Always scrape first** | Content is never generated from scratch. Existing content is always scraped for context before enhancement. |
| **Homepage first** | Per-site content strategy starts with the homepage and trickles down. (DEC-031) |

## 5. Success Criteria

Ordered by priority (1 = highest).

| Priority | Criterion | Measurement | Testable |
|---|---|---|---|
| 1 | Generated content passes human review with minimal edits most of the time | Track edit distance between generated and final approved versions. Edit rates decrease over time as the system learns from feedback. | Yes |
| 2 | Pages rank for target suburb + service keywords | Google Search Console position data for target keyword clusters. Pages appear in relevant local search results. | Yes |
| 2 | Content structured for AI citation (GEO optimization) | Validate direct answer blocks, TLDR-first structure, and FAQ schema markup on all generated pages. Content surfaces in AI-generated answers. | Yes |
| 3 | Per-site brand voice consistency | Human review confirms generated content is tonally consistent with existing site content. Each site maintains its own distinct identity. | Yes |
| 4 | System learns and improves from feedback over time | Feedback persists per-site preferences and corrections. Subsequent generations reflect prior feedback. Edit rates decrease across sessions. | Yes |
| 5 | Interactive elements drive user engagement | Pages with interactive JS elements show increased clicks, engagement, and time on site compared to static equivalents. | Yes (contingent on JS capability confirmation — see OQ-1) |
| 6 | System alerts when content becomes stale | Freshness alerts trigger approximately every 2 months for unreviewed content. No stale content goes unnoticed. | Yes |

## 6. Assumptions

| # | Assumption | Impact If Wrong |
|---|---|---|
| A-1 | BookingTimes WYSIWYG code view accepts pasted HTML without stripping significant markup, classes, or inline styles. | **Critical.** If the editor sanitizes HTML aggressively, the entire paste-ready output approach must be reconsidered. Partially validated by prior V1 work but not systematically tested for all element types. |
| A-2 | The 5 sites share the same BookingTimes platform version and have substantially overlapping Bootstrap base CSS, differing primarily in custom CSS files. | **High.** If sites run different platform versions or have fundamentally different CSS foundations, per-site CSS analysis becomes more complex. |
| A-3 | Claude CLI subprocess (`claude -p`) on a Max subscription provides sufficient throughput for section-based generation without hitting rate limits that block the workflow. | **High.** If rate limits throttle generation significantly, the section-by-section approach (which makes more, smaller calls) may need batching or queuing strategies. |
| A-4 | Existing site content provides sufficient signal for brand voice inference. Sites have enough published content to extract meaningful voice patterns. | **Medium.** If a site has very little content, the inferred voice profile will be thin and the operator will need to provide more manual guidance for that site. |
| A-5 | The operator will provide feedback consistently enough to drive the learning loop. | **Medium.** If feedback is sparse or inconsistent, the compounding quality improvement will be slow. The system must still produce acceptable quality from inference alone. |
| A-6 | Google Search Console access is available for all 5 sites for traffic-based prioritization. | **Low.** If GSC is unavailable for some sites, prioritization falls back to hierarchy-based ordering (homepage > services > locations) rather than data-driven ordering. Confirmed available per DEC-024. |
| A-7 | JSON-LD `<script>` tags placed in `<body>` are not stripped by the BookingTimes WYSIWYG editor. | **High.** If the editor strips `<script>` tags regardless of type, all schema markup must find an alternative delivery mechanism or be abandoned. |

## 7. Background & Prior Art

### 7.1 Project Evolution

This project has gone through three design iterations:

1. **V1 (PRB-001):** Focused on CSS scraping, iframe preview, and template-based batch generation. Treated content creation as a rendering/CSS problem. Assumed cloud deployment (Cloudflare). Assumed direct API access to Claude.

2. **V2 (Design V2):** Introduced "Brand Knowledge Amplifier" concept with manually-authored brand profiles, learnable rules, and example-driven prompts. Still cloud-deployed. Superseded after human review identified that manual profile entry was friction-heavy and didn't capture brand voice nuances.

3. **V2.1 (Design V2.1):** Current iteration. Reframed as "Infer-First Brand Intelligence Pipeline." Brand voice inferred from existing content. Multi-agent site audit as Stage 1. Section-based generation. 5-stage pipeline. Local deployment. Claude CLI subprocess. Bootstrap 5.0.2 only.

### 7.2 Key Decisions Already Made

34 decisions (DEC-001 through DEC-034) have been made across the project's evolution. The following are active and directly constrain the problem space:

- **DEC-011:** Local deployment (SvelteKit + better-sqlite3 + filesystem). Supersedes cloud deployment.
- **DEC-014:** Claude CLI subprocess (`claude -p`) for AI integration. Supersedes OAuth/API approaches.
- **DEC-016:** Infer-first brand voice. No manual profile entry.
- **DEC-017:** Section-based generation, not whole-page.
- **DEC-018:** Multi-agent site audit as Stage 1.
- **DEC-019:** Two-page content model (service pages + location pages).
- **DEC-023:** Custom CSS files can be identified and extended.
- **DEC-026:** Dynamic section count per page and per site.
- **DEC-028:** Bootstrap 5.0.2 only, unified CSS.
- **DEC-029:** UIKit ignored entirely.
- **DEC-030:** Single user, no auth.
- **DEC-031:** Top-down homepage-first approach.
- **DEC-032:** Sidebar only constrains long-tail pages.
- **DEC-033:** Content freshness alerts (~2-month cycles).
- **DEC-034:** Interactive JS elements as a priority (pending platform confirmation).

### 7.3 Superseded Decisions

Several early decisions are no longer active:

- **DEC-002** (Cloudflare deployment) — superseded by DEC-011 (local deployment)
- **DEC-004** (Claude API via OAuth proxy) — superseded by DEC-014 (CLI subprocess)
- **DEC-008** (Bootstrap 5.3.3) — superseded by DEC-028 (Bootstrap 5.0.2)
- **DEC-012, DEC-013** (OAuth credential approaches) — superseded by DEC-014
- **DEC-015** (Brand Knowledge Amplifier with manual profiles) — superseded by DEC-016 (infer-first)

### 7.4 Existing Assets

- 5 live driving school websites on BookingTimes — production content serves as the baseline for scraping and voice inference
- CSS scraper that captures site CSS files including custom CSS (from V1 work)
- Extensive SEO, GEO, and schema research by Scout agents
- Content siloing and internal linking research
- Specialist agent definitions (SEO, GEO, Schema, Pixel)
- V2.1 design document with full pipeline specification

## 8. Open Questions

| # | Question | Why It Matters | Related |
|---|---|---|---|
| OQ-1 | Does BookingTimes allow custom JavaScript in page content pasted through the code view editor? Specifically: inline `<script>` tags, event handlers (onclick, etc.), and/or external script references? | Interactive JS elements are a stated priority (DEC-034) but the entire interactive element strategy depends on whether the platform permits JS execution in page content. If JS is stripped or blocked, interactivity must be achieved through CSS-only techniques or abandoned entirely. | DEC-034, SC-5 |
| OQ-2 | How does the learning/feedback loop persist across sessions? If the tool runs locally and sessions end, what is the concrete mechanism for storing, retrieving, and applying accumulated per-site preferences, corrections, and approved examples when a new session begins days or weeks later? | The learning loop is central to success criterion SC-4 (system improves over time). If feedback data lives only in SQLite, persistence is straightforward. But if any feedback context lives in Claude conversation state (which is ephemeral), cross-session learning breaks. The boundary between database-persisted knowledge and prompt-assembled context must be explicit. | SC-4, A-5 |
| OQ-3 | What does "minimal edits" mean concretely for success criterion SC-1? Is there a target edit distance, a percentage threshold (e.g., <10% of content changed), a categorical measure (e.g., only copy edits, no structural changes), or a subjective "feels right" standard? | SC-1 is the highest-priority success criterion. Without a concrete definition of "minimal," it cannot be objectively measured or used as a gate for pipeline maturity. The progressive enrichment model (design doc section 5.6) implies edit effort should decrease from HIGH to LOW over 50 pages — but the thresholds for each level are undefined. | SC-1 |
| OQ-4 | The live sites use Bootstrap 5.0.2 (confirmed by inspection), but the V2 design document (DEC-008) assumed Bootstrap 5.3.3. DEC-028 corrected this to 5.0.2. Are there any features or class names from Bootstrap 5.1-5.3 that the design doc references or assumes that do not exist in 5.0.2? | Bootstrap 5.0.2 is a relatively early 5.x release (May 2021). Later versions added CSS custom properties, new utility classes, and component changes. If the design assumes classes or features only available in 5.1+, generated content could reference non-existent CSS and break visually. A gap analysis between 5.0.2 and 5.3.3 feature sets may be needed. | DEC-008, DEC-028, A-2 |
| OQ-5 | Does the BookingTimes WYSIWYG editor strip or modify `<script type="application/ld+json">` tags when HTML is pasted through code view? | All schema markup (AutomotiveBusiness, FAQPage, BreadcrumbList, etc.) depends on JSON-LD script tags surviving the paste. If the editor strips script tags of any kind, the entire structured data strategy must find an alternative or be abandoned. This is separate from OQ-1 (executable JS) because JSON-LD is a data format, not executable code — but editors may not distinguish. | A-7, SC-2, SC-3 |
| OQ-6 | What is the concrete inventory of pages across all 5 sites? How many pages does each site currently have, broken down by type (homepage, service, location/suburb, about, contact, FAQ, other)? | The scale of the problem directly affects effort estimation, pipeline design, and batching strategy. If site A has 80 suburb pages and site B has 5, the approach to each site differs substantially. The sitemap crawl in Stage 1 will answer this, but an approximate count now would help scope the overall effort. | SC-1, A-4 |
| OQ-7 | How will content freshness be tracked given the manual paste deployment model? If generated content is pasted into BookingTimes manually, how does the system know when content was last actually deployed (as opposed to last generated or last approved)? | Freshness alerts (DEC-033) need a "last deployed" timestamp. Since there is no API and no automated deployment, the system has no way to confirm deployment happened unless the operator manually marks it. The gap between "approved in tool" and "pasted to live site" could be days or weeks. | DEC-033, SC-6 |
| OQ-8 | For the 5-stage pipeline, is there an expectation that all 5 sites progress through stages together, or can each site be at a different stage independently? | Stages 1 and 2 have different scope: Stage 1 is per-site, Stage 2 is domain-wide (shared across all sites). If sites can be at different stages, the tool needs to track per-site pipeline state. If they must progress together, the slowest site gates all others. | DEC-027 |
| OQ-9 | What subset of the 5 sites should be the pilot? Is there a preferred order for onboarding sites to the new pipeline? | Starting with one site reduces risk and builds the learning loop faster. The choice of pilot site (most content? least content? best existing quality? worst?) affects how quickly the feedback loop reaches maturity and whether early learnings transfer to other sites. | SC-4, DEC-031 |
| OQ-10 | Does the operator have direct access to modify the custom CSS files on each BookingTimes site, or is CSS deployment also constrained to a specific mechanism? | Tier 3 CSS (new custom styles generated by the system) needs to reach the live site. If CSS can be edited directly, new styles can be deployed independently of content. If CSS changes require a different workflow (e.g., support ticket to BookingTimes), the turnaround time for CSS changes becomes a bottleneck for content that depends on new styles. | DEC-023 |

## 9. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | BookingTimes WYSIWYG strips critical HTML elements (script tags, specific classes, data attributes) | Medium | Critical | Test paste behavior early with representative HTML samples including JSON-LD, Bootstrap classes, and custom attributes. Document what survives and what doesn't before any pipeline design is finalized. |
| R-2 | Bootstrap 5.0.2 lacks classes or features assumed by the design | Medium | High | Conduct a feature comparison between 5.0.2 and 5.3.3. Maintain a validated class catalogue from the actual live site CSS, not from Bootstrap documentation for a different version. |
| R-3 | Claude CLI subprocess rate limits throttle section-based generation | Low | High | Monitor throughput during initial pilot. If rate-limited, implement queuing with backoff. The section-based approach makes more calls than whole-page, increasing rate limit exposure. |
| R-4 | Brand voice inference produces inaccurate profiles for sites with limited existing content | Medium | Medium | Allow manual override of inferred profiles. Track inference confidence. Flag sites where content volume is too low for reliable inference. |
| R-5 | Learning loop does not compound meaningfully because feedback is too sparse or too inconsistent | Medium | Medium | Design the system to produce acceptable quality from inference alone (no feedback). Treat the feedback loop as an enhancement, not a requirement for baseline quality. |
| R-6 | Scope creep from the larger platform vision (unified comms, email, GSC consolidation) delays the content tool | Medium | Medium | The content tool is designed with clean boundaries (site_id foreign keys, GSC as an interface). Do not implement platform features until the content pipeline is complete and validated. |

## 10. Success Priority Order

As stated by the operator, in order of importance:

1. **Quality** — Content passes human review with minimal edits
2. **SEO/GEO** — Pages rank for target keywords and are structured for AI citation
3. **Per-site consistency** — Each site maintains its own distinct brand voice
4. **Learning** — System improves from feedback over time
5. **Engagement** — Interactive elements drive user engagement
6. **Speed** — Fast generation is a nice-to-have, not a requirement
