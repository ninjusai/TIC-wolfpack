---
title: "Product Requirements Document: Bookingtimes Content Emulator V2.1 Rebuild"
version: "2.0.0"
status: complete
last-updated: "2026-04-02"
author: quill
project: bookingtimes-content-emulator
references:
  - PRB-bookingtimes-content-emulator-002
  - EVL-bookingtimes-content-emulator-002
  - ARCH-bookingtimes-content-emulator-002
  - INT-bookingtimes-content-emulator-002
  - design-v2.1.md
supersedes: prd.md (V1)
---

# Product Requirements Document: Bookingtimes Content Emulator V2.1 Rebuild

## 1. Problem Statement

A single operator manages content across 5 Australian driving school websites hosted on the BookingTimes SaaS platform. The current content lifecycle is entirely manual: writing, reviewing, and pasting HTML into a WYSIWYG code view editor, one page at a time, across all 5 sites. There is no tooling to:

1. **Understand what exists.** No way to systematically audit existing content, SEO health, structured data, or design quality across all 5 sites. The operator cannot answer "what's missing?" or "what's weak?" without manually inspecting every page.

2. **Understand what should exist.** No benchmark or standard for what a high-quality driving school website looks like from an SEO, GEO (Generative Engine Optimization), schema markup, or content architecture perspective. Decisions about what to build are based on intuition rather than gap analysis.

3. **Generate content that matches each site's identity.** Each of the 5 sites has a distinct brand voice, but there is no mechanism to capture, codify, or enforce that voice during content creation. Previous template-based batch generation produced content that was generic and failed quality standards.

4. **Optimize for AI-driven search.** As AI search engines (Google AI Overviews, Perplexity, ChatGPT) grow in importance, content must be structured for AI citation -- direct answer blocks, FAQ schema, statistics density, freshness signals. No current tooling addresses this.

5. **Improve over time.** There is no feedback loop. Every content creation session starts from zero. Corrections made on one page do not carry forward to subsequent pages. The operator's accumulated knowledge about what works for each site is not captured by any system.

6. **Maintain content freshness.** With roughly 2-month update cycles and no alerting, stale content goes unnoticed until manually discovered.

### What Changed From V1

V1 treated content creation as a rendering problem (CSS visibility, preview, templates). V2.1 treats it as an intelligence problem -- understanding what exists, what should exist, what the gap is, and filling that gap with content that improves with each iteration. The system is rebuilt around a 5-stage pipeline (Audit, Research, Gap Analysis, Design, Build) with section-based generation, brand voice inference, and a persistent learning loop.

---

## 2. Goals

| # | Goal | Type | Measurable Target | Timeframe |
|---|------|------|-------------------|-----------|
| G-1 | Reduce human editing effort on generated content over time | Quality | Edit distance decreases from 30-50% (pages 1-5) to <5% (pages 16+) per site (EVAL-BCE2-021) | Per-site progressive improvement |
| G-2 | Produce SEO-optimized content that ranks for target suburb + service keywords | SEO | Correct heading hierarchy, keyword placement in H1 + first 200 words, 40-50% unique content per suburb page (EVAL-BCE2-022, 023, 025) | Per page generation |
| G-3 | Structure all content for AI citation (GEO optimization) | GEO | Every page has >= 1 direct answer block, TLDR-first structure, FAQ schema, >= 1 statistic per 200 words (EVAL-BCE2-028, 029, 030) | Per page generation |
| G-4 | Infer and maintain distinct brand voice per site without manual profile entry | Quality | AI-rubric brand voice score >= 7/10 cold start, >= 8/10 proficient (EVAL-BCE2-019) | Per site, improving over time |
| G-5 | Produce paste-ready HTML with valid structured data for all 5 sites | Export | Zero HTML validation errors, zero unknown CSS classes, valid JSON-LD per page (EVAL-BCE2-017, 018, 032) | Per export |
| G-6 | Alert when content becomes stale, targeting ~2-month review cycles | Freshness | Correct freshness classification (fresh/aging/stale) with actionable alerts (EVAL-BCE2-049, 050) | Continuous |

---

## 3. Users

### Primary User: Site Manager (Single Operator)

- **Role:** Sole manager of all 5 BookingTimes driving school websites
- **Goal:** Audit, generate, review, approve, and paste high-quality SEO/GEO-optimized content across all 5 sites with minimal manual effort
- **Context:** Handles the entire content lifecycle end-to-end. No other users. No delegation. Pastes approved HTML directly into BookingTimes' code view editor. Operates on an ad hoc schedule with no external deadlines.
- **Key behavior:** Reviews and refines generated content section by section. Provides feedback that should persist and improve future generations.

**There is one user. No authentication system is required.** (DEC-030)

---

## 4. Requirements

### 4.1 Stage 1: Site Audit & Inventory

#### REQ-BCE2-001: CSS Scraping and Three-Tier Classification [P0]

**Description:** The system scrapes all stylesheets from a target BookingTimes site and classifies them into three tiers: Tier 1 (Bootstrap 5.0.2 base), Tier 2 (site-specific custom CSS), and Tier 3 (platform/third-party CSS). All `<link rel="stylesheet">` and inline `<style>` blocks are captured. Bootstrap 5.0.2 CDN stylesheet is identified as Tier 1, site-specific custom CSS files (e.g., `LoadCSS?k=` patterns) as Tier 2, and platform CSS, Font Awesome 6 Pro, and third-party libraries classified separately.

**Priority:** P0

**Acceptance Criteria:**
- >= 95% of manually-verified CSS files captured
- 100% tier classification accuracy for known files
- Zero content-area CSS files missed
- Font Awesome 6 Pro icon classes catalogued separately

**eval-trace:** EVAL-BCE2-001

---

#### REQ-BCE2-002: Content Scraping and Extraction [P0]

**Description:** The content scraper extracts the correct content sections from each page, distinguishing page content from platform chrome (navigation, sidebar, footer). Heading hierarchy is preserved. Images, lists, and CTAs are captured with their surrounding markup. Sidebar content is identified separately from main content.

**Priority:** P0

**Acceptance Criteria:**
- >= 90% content extraction accuracy against human-verified ground truth per page
- Zero cases where sidebar content is mixed into main content extraction
- Heading hierarchy (H1-H6) preserved intact
- Text content matches live page with no truncation

**eval-trace:** EVAL-BCE2-002

---

#### REQ-BCE2-003: Brand Voice Inference [P0]

**Description:** The system infers each site's unique brand voice from existing content rather than requiring manual brand profile entry (DEC-016). The system scrapes 5-10 representative pages per site and uses a Claude CLI call to produce a structured brand profile containing: `voice_description`, `tone_keywords`, `terminology_patterns`, `sentence_style`, `recurring_phrases`, and `anti_patterns`. Profiles are stored in `brand_profiles` with `inference_confidence` (0.0-1.0) based on `source_page_count`. The operator reviews and confirms/adjusts the inferred profile before it is used for generation.

**Priority:** P0

**Acceptance Criteria:**
- Brand profile produced for each site with all required fields populated
- `inference_confidence` correctly reflects source content volume (< 0.5 for sites with < 5 pages or < 500 words/page)
- Low-confidence profiles surface a warning prompting operator review
- Operator can confirm, adjust, or override any field
- Voice NEVER transfers between sites -- profiles are per-site isolated

**eval-trace:** EVAL-BCE2-019, EVAL-BCE2-057

---

#### REQ-BCE2-004: Existing Schema and Structured Data Detection [P1]

**Description:** The schema agent inspects structured data on every page during audit: which schema types are present, whether JSON-LD is valid, whether required properties are present, whether `@graph`/`@id` patterns are used, and whether `sameAs` disambiguation and `BreadcrumbList` are in place. Detects Microdata and RDFa as well as JSON-LD.

**Priority:** P1

**Acceptance Criteria:**
- All existing schema types on each page identified and catalogued
- Valid vs. malformed JSON-LD distinguished
- Missing required properties flagged per schema type
- Entity graph assessment produced (connected vs. isolated blocks)
- Results stored in `schema_audit` table with per-page records

**eval-trace:** EVAL-BCE2-033, EVAL-BCE2-034

---

#### REQ-BCE2-005: Sitemap-Based Page Inventory [P0]

**Description:** Before specialist agents run, the system performs a full sitemap crawl to establish scope. Every URL is recorded. URL patterns are detected from the sitemap (the sitemap is the source of truth for platform-enforced URL structures). Pages are classified by detected patterns (e.g., `/areas/*` = location pages). Total pages per type are counted.

**Priority:** P0

**Acceptance Criteria:**
- All URLs from the sitemap recorded in `site_structure_map`
- URL patterns correctly detected and classified
- Page type classification (homepage, service, location, about, FAQ, other) applied
- Total page count per type available for gap analysis

**eval-trace:** EVAL-BCE2-051

---

### 4.2 Stage 2: Research & Benchmark

#### REQ-BCE2-006: SEO Benchmark Standards [P0]

**Description:** Establish actionable SEO benchmark standards for driving school websites based on research. Codified as rules: title tag formulas per page type (e.g., `[Service] in [Location] | [Brand Name]`), meta description templates (150-160 chars, CTA + USP + location), header hierarchy templates per page type, content uniqueness thresholds (40-50% per suburb page), canonical tag rules, E-E-A-T signal requirements, image optimization standards, and mobile-first requirements. Stored in `benchmark_standards`.

**Priority:** P0

**Acceptance Criteria:**
- Title tag formula defined per page type, under 60 characters, primary keyword first
- Meta description template defined, 150-160 characters
- Header hierarchy template defined per page type (one H1, no skipped levels)
- Content uniqueness threshold set at 40-50% per suburb page
- E-E-A-T requirements documented (TMR accreditation, instructor qualifications, pricing transparency, reviews, contact methods)

**eval-trace:** EVAL-BCE2-022, EVAL-BCE2-023, EVAL-BCE2-024, EVAL-BCE2-025, EVAL-BCE2-026

---

#### REQ-BCE2-007: GEO Optimization Benchmarks [P0]

**Description:** Establish GEO optimization benchmarks for AI citation readiness based on research. Codified as patterns: direct answer block format (40-60 words, self-contained), TLDR-first structure (primary query answered in first 200 words), FAQ format (3-5 questions phrased as AI assistant queries, answers 40-80 words with specific facts), statistics frequency (1 per 150-200 words), freshness signals (visible last-updated date, current year references), and named authorship requirements.

**Priority:** P0

**Acceptance Criteria:**
- Direct answer block specification defined (40-60 words, self-contained, factual)
- TLDR-first rule defined (first 200 words must answer primary query)
- FAQ format defined (3-5 questions, natural language phrasing, factual answers)
- Statistics density target defined (>= 1 per 200 words)
- Freshness signal requirements defined

**eval-trace:** EVAL-BCE2-028, EVAL-BCE2-029, EVAL-BCE2-030, EVAL-BCE2-031

---

#### REQ-BCE2-008: Schema.org Best Practices for Automotive Businesses [P0]

**Description:** Define per-page-type schema requirements using the `@graph`/`@id` pattern. Critical finding: `DrivingSchool` does not exist in schema.org -- use `AutomotiveBusiness` as primary type. Multi-typing allowed (`["AutomotiveBusiness", "EducationalOrganization"]`). Define mandatory baseline per page (Organization, WebSite, BreadcrumbList) and page-type-specific schemas: Homepage (full AutomotiveBusiness + WebSite with SearchAction), Service pages (Service + Offer + FAQPage), Location pages (AutomotiveBusiness with areaServed + FAQPage), and supporting pages. Define `sameAs` disambiguation linking to Google Maps, Facebook, Instagram.

**Priority:** P0

**Acceptance Criteria:**
- Schema type mapping defined for all page types (homepage, service, location, about, FAQ, resource)
- `AutomotiveBusiness` used instead of nonexistent `DrivingSchool`
- `@graph`/`@id` reference pattern specified as the default
- `BreadcrumbList` required on every page
- `sameAs` disambiguation requirements documented
- JSON-LD placement in `<body>` confirmed (BookingTimes WYSIWYG constraint)

**eval-trace:** EVAL-BCE2-032, EVAL-BCE2-033, EVAL-BCE2-034

---

#### REQ-BCE2-009: Page Taxonomy and Silo Strategy [P1]

**Description:** Define the Hybrid Two-Page Model page taxonomy: Service Pages (3-6, content-heavy, root-level URLs) and Location Pages (50+, lean/conversion-focused, under `/areas/`). No service x location matrix. Define three content silos: Services, Locations, and Trust. Define URL rules that work within platform-enforced patterns detected from sitemaps.

**Priority:** P1

**Acceptance Criteria:**
- Page taxonomy stored in `page_taxonomy` with hierarchy levels and required sections per type
- Three silos defined (Services, Locations, Trust) stored in `silo_definitions`
- No service x location matrix pages in the taxonomy
- URL patterns respect platform-enforced structures from sitemap
- Max 3 levels deep, no regional nesting

**eval-trace:** EVAL-BCE2-048

---

### 4.3 Stage 3: Gap Analysis

#### REQ-BCE2-010: Audit vs. Benchmark Comparison [P0]

**Description:** For each existing page, each specialist scores against their benchmark dimension: SEO score (title, meta, headers, canonicals, keyword placement, internal links, E-E-A-T, images, mobile), GEO score (direct answer blocks, TLDR-first, FAQ content, statistics density, freshness, named authorship), Schema score (correct types, required properties, valid JSON-LD, @graph/@id, sameAs, BreadcrumbList), Design score (layout, CSS usage, responsive, accessibility), and Voice score (brand profile consistency, content depth). Each page receives a weighted composite score and status: Missing, Weak, Adequate, or Strong.

**Priority:** P0

**Acceptance Criteria:**
- Multi-dimensional scoring produced for every existing page
- Each dimension scored against benchmark standards from Stage 2
- Pages classified as Missing/Weak/Adequate/Strong
- Gap analysis records stored in `gap_analysis` table with per-page scores and deficiency lists
- Strong pages identified as exemplars for learning

**eval-trace:** EVAL-BCE2-051

---

#### REQ-BCE2-011: Missing Page Identification [P0]

**Description:** Cross-reference the benchmark page taxonomy against the sitemap inventory to identify page types that should exist but do not. For location pages, identify which suburbs are covered and which are missing. Results feed the work backlog.

**Priority:** P0

**Acceptance Criteria:**
- All page types from benchmark taxonomy compared against sitemap inventory
- Missing page types identified with recommended creation priority
- Missing suburb/location pages identified
- Results stored in `work_backlog` with status and priority

**eval-trace:** EVAL-BCE2-051

---

#### REQ-BCE2-012: Content Quality Gap Scoring [P1]

**Description:** Produce a prioritized work backlog by scoring gaps across all dimensions. Priority driven by hierarchy: Homepage (always first) > Core service pages > Hub pages > Location pages > Long-tail content. Within a level, priority driven by: Missing > Weak > Adequate. GSC traffic data (if available) enriches prioritization: pages with high impressions but low CTR are prioritized. Backlog is reviewed and approved by the operator before proceeding.

**Priority:** P1

**Acceptance Criteria:**
- Work backlog produced with priority ordering by hierarchy then gap severity
- GSC data integrated into prioritization when available (traffic_potential weight = 0.2)
- Operator can review, reprioritize, remove, or add items
- Backlog stored in `work_backlog` with `site_id`, status, and priority

**eval-trace:** EVAL-BCE2-051, EVAL-BCE2-053

---

#### REQ-BCE2-013: Link Graph Construction and Gap Detection [P0]

**Description:** Map existing pages into the silo structure from Stage 2. Identify orphan pages (< 2 incoming links). Plan the full link graph: existing + planned pages with all relationships. Generate anchor text banks for every target page with variant distribution targets. Validate: every planned page has >= 2 incoming links, max 3 clicks from homepage. Identify pages with fewer than 2 incoming links.

**Priority:** P0

**Acceptance Criteria:**
- Complete link graph constructed (existing + planned pages + all edges)
- Zero orphan pages in the planned graph (every page has >= 2 incoming links)
- Every page reachable from homepage within 3 clicks
- Anchor text bank generated per target page with variant classification
- Bidirectional service-location links present per silo strategy
- Geographic clustering links (3-5 adjacent suburbs per location page)

**eval-trace:** EVAL-BCE2-047, EVAL-BCE2-048

---

### 4.4 Stage 4: Design & Architecture

#### REQ-BCE2-014: Page Blueprint Generation with Dynamic Section Count [P0]

**Description:** For each work backlog item, generate a page blueprint with a dynamic number of sections determined by page type, site brand personality, content requirements, and the need to avoid programmatic sameness (DEC-026). Each blueprint includes page-level rules (SEO, GEO, schema, linking, voice, CSS) and per-section specifications (word count range, CTA requirements, heading, linking rules, GEO rules). Blueprints are batch-reviewed by the operator before generation begins.

**Priority:** P0

**Acceptance Criteria:**
- Page blueprint created for each backlog item with page-level and section-level rules
- Section count varies across pages and sites (standard deviation > 0 across 10+ location pages)
- At least 2 distinct section orderings observed across same-type pages
- Blueprints stored in `page_blueprints` and `section_specs` tables
- Operator reviews and approves blueprints before generation proceeds

**eval-trace:** EVAL-BCE2-048c

---

#### REQ-BCE2-015: Silo Structure Design [P1]

**Description:** Implement the Hybrid Two-Page Model with three silos per site: Services (3-6 root-level pages), Locations (50+ flat under `/areas/`), and Trust (About, Contact, FAQ, Resources). Service pages are hubs linking to all location pages. Location pages link back to all service pages. No service x location matrix pages. Cross-silo links follow hub-and-spoke pattern. Content generation order respects silo structure: hubs before children, services before locations.

**Priority:** P1

**Acceptance Criteria:**
- Three silos defined and stored in `silo_definitions` per site
- Service pages at root level for maximum authority
- Location pages flat under `/areas/` (no deep nesting)
- Cross-silo linking rules defined and enforced
- Generation ordering respects silo hierarchy (hubs first)

**eval-trace:** EVAL-BCE2-048

---

#### REQ-BCE2-016: Internal Link Graph with Anchor Text Rotation [P0]

**Description:** The link graph is a first-class data structure with directed edges, types, anchor text, variant classification, and target sections. Anchor text distribution targets: exact match 10-20%, partial match 30-40%, branded 10-15%, natural/contextual 30-40%, generic <5%. Hard constraint: no exact anchor text used more than 3 times site-wide per target. Anchor text length: 2-5 words. Link generation rules codified: Service->Location, Location->Service, Location->Adjacent (3-5 nearest), Contextual (first mention), Breadcrumb, Orphan prevention.

**Priority:** P0

**Acceptance Criteria:**
- Anchor text distribution within target ranges (+/- 5%)
- Zero instances of exact anchor text used > 3 times for the same target URL
- 3-10 contextual internal links per page (excluding nav/footer)
- All links point to valid pages in the link graph (zero broken links)
- No self-referential links

**eval-trace:** EVAL-BCE2-027, EVAL-BCE2-047, EVAL-BCE2-048b

---

#### REQ-BCE2-017: CSS Decision Per Section [P1]

**Description:** For each section in a page blueprint, determine whether it can be built with Tier 1 (Bootstrap 5.0.2) + Tier 2 (existing site custom CSS), or whether new Tier 3 CSS is needed. If Tier 3 is needed, draft CSS rules and queue for operator approval. Tier 3 CSS is added to the site's existing custom CSS file(s). Design quality considerations include whitespace, typography hierarchy, responsive behavior, and sidebar awareness for long-tail pages. Decisions stored in `css_decisions`.

**Priority:** P1

**Acceptance Criteria:**
- Every section has an explicit CSS tier decision
- Tier 3 CSS drafts reviewed and approved by operator before use
- Sidebar-aware layouts specified for long-tail pages (DEC-032)
- All CSS classes in Tier 1 validated against Bootstrap 5.0.2 (not 5.1+)
- CSS decisions stored in `css_decisions` table per section

**eval-trace:** EVAL-BCE2-018, EVAL-BCE2-054

---

### 4.5 Stage 5: Build & Learn

#### REQ-BCE2-018: Section-Based Content Generation with 12-Layer Context Assembly [P0]

**Description:** Each section is generated by a separate `claude -p` CLI call (DEC-017). Context is assembled in 12 layers per call: (1) Platform constraints, (2) Brand profile, (3) Brand rules filtered by scope, (4) Section specification, (5) Page-level SEO context, (6) Internal linking targets for this section, (7) GEO requirements, (8) CSS class palette (tiered, filtered), (9) Previously generated sections from this page, (10) Approved examples from previous pages (few-shot), (11) Suburb/location data, (12) Output format instructions. Total prompt budget: ~3,000-8,500 tokens per call.

**Priority:** P0

**Acceptance Criteria:**
- Each section generated by a separate Claude CLI call with all 12 context layers assembled
- Token budget per call stays within 3,000-8,500 range
- Previously generated sections included as context for continuity (Layer 9)
- Approved examples from prior pages used as few-shot context (Layer 10)
- Prompt assembler queries brand_profiles, brand_rules, section_specs, css_audit, internal_link_graph, anchor_text_bank, and brand_examples

**eval-trace:** EVAL-BCE2-019, EVAL-BCE2-020, EVAL-BCE2-042

---

#### REQ-BCE2-019: Three-Tier CSS Generation [P0]

**Description:** Generated HTML uses only CSS classes from three validated tiers: Tier 1 (Bootstrap 5.0.2 -- use freely, never modify), Tier 2 (site-specific custom CSS -- use where appropriate, extend where needed), Tier 3 (system-generated new CSS -- create when needed, must be approved). Classes from Bootstrap 5.1-5.3 (e.g., `text-bg-primary`, `z-3`, CSS custom properties) must be excluded. Font Awesome 6 Pro icon classes validated against the FA6 catalogue.

**Priority:** P0

**Acceptance Criteria:**
- Every CSS class in generated HTML resolves to Tier 1, Tier 2, or Tier 3
- Zero classes from Bootstrap 5.1+ (e.g., `text-bg-primary` from 5.2, `z-*` from 5.3)
- Zero unknown or hallucinated classes
- FA6 Pro icon classes validated
- No cross-site CSS contamination (Site A's Tier 2 classes never in Site B's output)

**eval-trace:** EVAL-BCE2-018, EVAL-BCE2-045

---

#### REQ-BCE2-020: Three-Tier JavaScript Interactivity [P1]

**Description:** Implement a three-tier interactivity model: Tier 1 (CSS-only, guaranteed -- animations, transitions, `<details>`/`<summary>`, checkbox hack, `:target` selector, CSS scroll-snap), Tier 2 (Head injection + content HTML hooks -- JS added via BookingTimes Analytics & Tracking `<head>` tag, content uses `data-bce-*` attributes and `.bce-interactive-*` classes as hooks, jQuery available globally), Tier 3 (Inline JS -- unconfirmed, needs manual test before relying on it). All interactive elements must have Tier 1 CSS-only fallback. Generated JS must be self-contained, relying only on jQuery and Bootstrap 5.0.2 JS.

**Priority:** P1

**Acceptance Criteria:**
- Every interactive element has a CSS-only (Tier 1) fallback that keeps all content accessible without JS
- Tier 2 JS uses `[data-bce-*]` attributes and `.bce-interactive-*` classes (namespaced, no collisions)
- Generated JS references only jQuery/$ and Bootstrap 5.0.2 JS APIs
- Zero external CDN dependencies
- All code wrapped in IIFE or module scope (no global variable pollution)
- All interactive elements are keyboard navigable with appropriate ARIA attributes

**eval-trace:** EVAL-BCE2-035, EVAL-BCE2-036, EVAL-BCE2-037, EVAL-BCE2-038

---

#### REQ-BCE2-021: JSON-LD Structured Data Generation [P0]

**Description:** Generate valid JSON-LD using the `@graph`/`@id` pattern per page. Schema types per page type: Homepage (AutomotiveBusiness full + WebSite with SearchAction + BreadcrumbList), Service (Service with Offer + FAQPage + BreadcrumbList), Location (AutomotiveBusiness with areaServed + FAQPage + BreadcrumbList), About (AboutPage + BreadcrumbList), FAQ (FAQPage + BreadcrumbList). All entities cross-reference via `@id`. `sameAs` disambiguation links included. JSON-LD placed in `<body>` as `<script type="application/ld+json">` (confirmed surviving TinyMCE paste per DEC-035). FAQ content in JSON-LD must exactly match visible FAQ content in HTML.

**Priority:** P0

**Acceptance Criteria:**
- 100% valid JSON (parseable by `JSON.parse()`)
- Correct `type="application/ld+json"` on all script tags
- `@graph`/`@id` pattern used on all pages
- `BreadcrumbList` on every page
- `AutomotiveBusiness` used (NOT nonexistent `DrivingSchool`)
- All required properties present per schema type (name, address, telephone, geo for AutomotiveBusiness)
- FAQ JSON-LD matches visible FAQ HTML content exactly
- `sameAs` links to Google Maps, Facebook, etc.

**eval-trace:** EVAL-BCE2-032, EVAL-BCE2-033, EVAL-BCE2-034, EVAL-BCE2-034b

---

#### REQ-BCE2-022: Multi-Artifact Export [P0]

**Description:** The export pipeline produces three artifacts per page: (1) Page HTML -- complete body-level HTML fragment with all sections assembled and JSON-LD `<script>` blocks appended, paste target is BookingTimes code view editor, (2) Schema JSON-LD -- included within Page HTML artifact (appended to body), (3) Head JS -- separate `<script>` block for `<head>` injection via BookingTimes Analytics & Tracking (only if Tier 2 interactive elements exist). Each artifact is independently copy-to-clipboard ready. Automated validation checklist runs before copy-to-clipboard and blocks export if critical checks fail.

**Priority:** P0

**Acceptance Criteria:**
- Page HTML artifact is a self-contained body-level fragment (no `<html>`, `<head>`, `<body>` wrapper tags)
- JSON-LD appended to page HTML body
- Head JS is a separate copy-to-clipboard artifact
- No build step required between export and paste
- All CSS classes validated against the site's three-tier catalogue before export
- HTML well-formedness verified
- All internal links resolve to known pages
- JSON-LD structurally valid
- No placeholder tokens remaining
- Export blocked with specific failure messages if critical checks fail

**eval-trace:** EVAL-BCE2-017, EVAL-BCE2-043, EVAL-BCE2-044, EVAL-BCE2-046

---

#### REQ-BCE2-023: Human Feedback Loop and Brand Profile Refinement [P0]

**Description:** The system captures learning from every approval, refinement, and rejection. On approval: full approved HTML stored as `brand_example`, voice patterns analyzed and reinforced in `brand_rules` (confidence++), CSS patterns recorded. On refinement: feedback stored verbatim, classified by category (voice/tone, terminology, structure, CSS/design, SEO, GEO, schema, one-time) and scope (global, brand-level, page-type-level, section-type-level, one-time), relevant rules created in `brand_rules`. On rejection: sections flagged with rejection reason, anti-pattern rules created. Brand profile history tracked via snapshots in `brand_profile_history`. Phase 1 (MVP): manual feedback classification. Phase 2: AI-assisted classification with operator confirmation.

**Priority:** P0

**Acceptance Criteria:**
- All feedback persists in SQLite database and survives tool restart (zero data loss)
- Approved sections appear in `brand_examples` with correct `section_type`, `quality_rating`
- Rejected sections stored with `is_negative = 1` and rejection reason
- Refinement feedback creates `brand_rules` with `source = 'feedback'` and correct scope
- All feedback has correct `site_id` (per-site isolation)
- Subsequent generations for the same site reflect prior feedback (>= 80% of cases)
- Brand profile updates are non-destructive (history snapshots preserved)
- `inference_confidence` increases as more pages are approved

**eval-trace:** EVAL-BCE2-039, EVAL-BCE2-040, EVAL-BCE2-041

---

#### REQ-BCE2-024: Content Freshness Detection and Alerts [P1]

**Description:** Track content freshness using three timestamps per page: `last_generated_at` (auto), `last_approved_at` (auto), `last_deployed_at` (manually marked by operator after paste). Freshness status computed from `last_deployed_at`: Fresh (< 6 weeks), Aging (6-10 weeks, warning), Stale (> 10 weeks, alert), Unknown (never deployed). Alerts surfaced in dashboard UI. "Mark as Deployed" button surfaced after copy-to-clipboard. Alerts include actionable recommendations (update last-updated date, refresh statistics, review FAQ, check for outdated references), page-type-specific and prioritized by page importance.

**Priority:** P1

**Acceptance Criteria:**
- Correct freshness classification based on `last_deployed_at` timestamps
- Aging and stale pages surfaced in dashboard alerts
- `next_review_due` computed correctly
- "Mark as Deployed" action available after copy-to-clipboard
- Every stale alert includes >= 2 actionable, page-type-specific recommendations
- Freshness data stored in `content_freshness` table with site_id foreign key

**eval-trace:** EVAL-BCE2-049, EVAL-BCE2-050

---

### 4.6 Cross-Cutting Requirements

#### REQ-BCE2-025: Database Schema and Migrations [P0]

**Description:** Implement a relational schema of 25+ tables in a single better-sqlite3 database file (ADR-011). Tables organized in five groups: Core (sites, pages, page_versions, ai_sessions, ai_turns), Brand Intelligence (brand_profiles, brand_rules, brand_examples, brand_profile_history), Audit & Benchmark (site_structure_map, content_audit, schema_audit, css_audit, benchmark_standards, page_taxonomy), Planning (gap_analysis, work_backlog, page_blueprints, section_specs, silo_definitions, internal_link_graph, anchor_text_bank, css_patterns, css_decisions), Operations (gsc_metrics, scribe_checkpoints, content_freshness). Foreign keys enforced (`PRAGMA foreign_keys = ON`). Versioned migration system (numbered SQL files applied in order). Indexes on performance-critical columns.

**Priority:** P0

**Acceptance Criteria:**
- All migrations run without error in sequence
- All 25+ tables created with correct columns and types
- Foreign key constraints enforced
- Invalid foreign key inserts rejected (e.g., `section_specs` with nonexistent `blueprint_id`)
- CHECK constraints enforced (`sites.pipeline_stage`, `section_specs.status`)
- Indexes exist on `(site_id, status)` on `work_backlog`, `(site_id, class_name)` on `css_audit`, `(site_id, target_url, anchor_text)` on `anchor_text_bank`

**eval-trace:** EVAL-BCE2-003

---

#### REQ-BCE2-026: Pipeline Stage Gate Enforcement [P0]

**Description:** The pipeline enforces strict stage ordering (ADR-012). Each site progresses independently through stages. Stage 3 requires both Stage 1 (for that site) AND Stage 2 (global). Stages 3-4-5 are strictly sequential per site. Two sites can be at different stages simultaneously. Stage 2 completion unlocks Stage 3 for ALL sites that have completed Stage 1. Invalid stage transitions are rejected.

**Priority:** P0

**Acceptance Criteria:**
- 100% of invalid stage transitions rejected
- 100% of valid transitions accepted
- Sites can progress independently (Site A at Stage 5, Site B at Stage 1)
- Stage 2 (global) marked complete once, shared by all sites
- Per-site `pipeline_stage` tracked in `sites` table
- Scribe checkpoint fires at every stage transition

**eval-trace:** EVAL-BCE2-004, EVAL-BCE2-055

---

#### REQ-BCE2-027: Homepage-First Top-Down Workflow [P0]

**Description:** The homepage must always be the first page generated per site (DEC-031). The system enforces strict hierarchical generation ordering: Homepage > Core service pages > Hub pages ("Areas We Serve") > Location pages > Long-tail content. Non-homepage pages cannot be generated before the homepage is approved for that site. Batch generation of suburb pages is unlocked only after 3-5 individual suburb pages have been approved.

**Priority:** P0

**Acceptance Criteria:**
- Homepage is always first in the work backlog per site
- System rejects or deprioritizes generation of non-homepage pages before homepage approval
- Generation ordering respects hierarchy (homepage > services > locations > long-tail)
- Batch suburb generation requires 3-5 individually approved suburb pages first

**eval-trace:** EVAL-BCE2-053

---

#### REQ-BCE2-028: Per-Site Context Persistence and Learning Loop [P0]

**Description:** All learning persists in the database via three mechanisms: (1) Brand Rules (`brand_rules` with source, scope, confidence, confirmed flag), (2) Brand Examples (`brand_examples` with section_type, page_type, quality_rating, positive/negative), (3) Brand Profile Evolution (`brand_profiles` + `brand_profile_history`). No learning stored in ephemeral session state. Cross-session reconstruction queries brand_profiles, brand_rules, brand_examples, page_versions, and section_specs. Token budget management selects most relevant subset when accumulated rules/examples exceed budget.

**Priority:** P0

**Acceptance Criteria:**
- All feedback persists across tool restarts (zero data loss)
- Approved examples used as few-shot context in new generation prompts
- Brand rules included in generation prompts filtered by relevance
- Token budget for Layers 2+3+10 stays within ~1,500-3,300 tokens
- Rule management UI allows viewing, editing, deactivating, and prioritizing rules
- Site data is completely isolated (Site A's data never used for Site B)

**eval-trace:** EVAL-BCE2-039, EVAL-BCE2-040, EVAL-BCE2-042, EVAL-BCE2-052

---

#### REQ-BCE2-029: Claude CLI Subprocess Integration [P1]

**Description:** AI calls via `claude -p` CLI subprocess on Max subscription (DEC-014). Implementation: `child_process.spawn("claude", ["-p", ...])` with prompt piped via stdin (Windows cmd line length limit). `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_API_KEY` stripped from subprocess environment. Response captured from stdout, errors from stderr. Timeout: 120 seconds per call (configurable). Retry: up to 3 attempts with exponential backoff (2s, 4s, 8s). Single-turn, stateless -- the application is the memory.

**Priority:** P1

**Acceptance Criteria:**
- Prompt delivered via stdin (not command-line argument)
- Response captured and parsed correctly from stdout
- Auth tokens stripped from subprocess environment
- Timeout fires after 120 seconds if no response
- Retry logic executes up to 3 attempts with exponential backoff
- Stderr errors captured and surfaced to the UI

**eval-trace:** EVAL-BCE2-005

---

#### REQ-BCE2-030: Sidebar-Aware Layout Handling [P1]

**Description:** Long-tail pages (location pages) have a fixed platform sidebar that cannot be removed (DEC-032). Generated content for long-tail pages must account for the sidebar -- content layout must work alongside it. CSS may adjust sidebar positioning (e.g., push below hero) but cannot eliminate it. Homepage and service pages have full viewport width (no sidebar constraint). The preview iframe includes simulated sidebar for long-tail page previews.

**Priority:** P1

**Acceptance Criteria:**
- Content layout for long-tail pages uses Bootstrap grid accommodating sidebar
- Zero content-sidebar overlaps
- Homepage and service page layouts correctly use full viewport width
- Preview iframe includes simulated sidebar element for long-tail page previews
- Sidebar CSS adjustments (if any) documented in Tier 3 CSS

**eval-trace:** EVAL-BCE2-054

---

#### REQ-BCE2-031: Preview Iframe with Site CSS Injection [P1]

**Description:** Preview uses a sandboxed `<iframe>` with `srcdoc` loading: Bootstrap 5.0.2 CSS, Font Awesome 6 Pro CSS, site's Tier 2 custom CSS, Tier 3 system-generated CSS, and Tier 2 interactive JS (if applicable). Generated HTML injected into iframe body wrapped in simulated parent structure matching site's content area. Responsive preview at Bootstrap 5.0.2 breakpoints: 576px, 768px, 992px, 1200px. Long-tail page previews include simulated sidebar.

**Priority:** P1

**Acceptance Criteria:**
- Preview renders with all four CSS tiers loaded
- Responsive breakpoint switching functional
- Interactive elements preview correctly when Tier 2 JS is loaded
- CSS files cached locally for offline preview capability
- Content wrapped in simulated parent structure matching live site

**eval-trace:** EVAL-BCE2-054

---

#### REQ-BCE2-032: Session Resumption After Interruption [P1]

**Description:** If the tool is closed mid-pipeline (e.g., during section generation), reopening must allow resumption from exactly where it left off. Previously generated sections preserved in database (`section_specs.generated_html`). Scribe checkpoints store `state_for_next_session` field with concrete next action. Session startup flow reads the latest checkpoint per site to determine resumption state.

**Priority:** P1

**Acceptance Criteria:**
- Zero data loss on interruption
- System correctly identifies resume point (which stage, which page, which section)
- Previously generated sections not regenerated
- Context assembly for the next section includes all prior sections from database
- Scribe checkpoints contain sufficient detail for resumption

**eval-trace:** EVAL-BCE2-006, EVAL-BCE2-056

---

#### REQ-BCE2-033: Multi-Site Data Isolation [P0]

**Description:** Data for different sites must be completely isolated. Brand voice, CSS, feedback, link graphs, and generated content for Site A must never leak into Site B. All per-site tables correctly filtered by `site_id`. Exception: Stage 2 benchmark data is correctly shared (no `site_id`) but applied per-site.

**Priority:** P0

**Acceptance Criteria:**
- Site A's brand profile never used when generating for Site B
- Site A's custom CSS classes never appear in Site B's exports
- Site A's feedback rules not included in Site B's generation prompts
- Site A's brand examples not used as few-shot for Site B
- Link graphs are per-site
- Stage 2 benchmark data is shared but does not violate site isolation

**eval-trace:** EVAL-BCE2-052

---

#### REQ-BCE2-034: HTML Validity and Paste-Readiness [P0]

**Description:** All generated HTML must be well-formed, body-level only (no `<head>`, `<html>`, `<body>` wrapper tags), with no broken tags, no unclosed elements, and no head-only elements (e.g., `<meta>`, `<title>`) in the content. Zero placeholder tokens. Content must be a self-contained HTML fragment suitable for paste into code view editor.

**Priority:** P0

**Acceptance Criteria:**
- HTML parses without errors
- All tags properly nested and closed
- No `<html>`, `<head>`, `<body>`, `<meta>`, `<title>`, `<link>` tags in output
- No placeholder tokens (`{{...}}`, `[TBD]`, `TODO`, `INSERT_`)
- Content is self-contained and paste-ready

**eval-trace:** EVAL-BCE2-017

---

#### REQ-BCE2-035: SEO Compliance in Generated Content [P0]

**Description:** Generated pages must meet SEO benchmark standards: exactly one H1 per page containing the primary target keyword, logical H2-H6 nesting with no skipped levels, primary keyword in H1 and first 200 words, keyword density 1-3%, title tag under 60 characters with keyword first, meta description 150-160 characters with CTA/USP/location, >= 3 E-E-A-T signals per service/location page (>= 5 for homepage), 40-50% unique content per suburb page.

**Priority:** P0

**Acceptance Criteria:**
- Exactly one H1 per page containing primary keyword
- No skipped heading levels
- Primary keyword in first 200 words
- Keyword density 0.5-4%
- Title tag under 60 chars, meta description 150-160 chars, both unique per page
- >= 3 E-E-A-T signals per service/location page
- >= 40% unique content per suburb page (pairwise similarity <= 60%)

**eval-trace:** EVAL-BCE2-022, EVAL-BCE2-023, EVAL-BCE2-024, EVAL-BCE2-025, EVAL-BCE2-026

---

#### REQ-BCE2-036: GEO Compliance in Generated Content [P0]

**Description:** Generated pages must meet GEO benchmark standards: >= 1 direct answer block per page (40-60 words, self-contained, in first 200 words), 3-5 FAQ questions per service/location page with factual answers, >= 1 statistic per 200 words (specific and verifiable), visible "last updated" date, current year reference, named authorship where applicable.

**Priority:** P0

**Acceptance Criteria:**
- >= 1 direct answer block per page (AI-rubric >= 7/10 on completeness/specificity)
- 3-5 FAQ items per service/location page with matching FAQPage JSON-LD
- >= 1 statistic per 200 words (zero pages with no statistics)
- Freshness date present, current year referenced
- No outdated date references

**eval-trace:** EVAL-BCE2-028, EVAL-BCE2-029, EVAL-BCE2-030, EVAL-BCE2-031

---

#### REQ-BCE2-037: Section Coherence Across Assembled Pages [P1]

**Description:** Sections generated individually must read naturally in sequence when assembled into a full page. No abrupt topic shifts, no repeated information across sections, no contradictory statements. The page must read as a unified document, not as separately-written fragments.

**Priority:** P1

**Acceptance Criteria:**
- AI-rubric score >= 7/10 on coherence
- Zero contradictions detected across sections
- Zero exact duplicated sentences across sections
- Transitions between sections feel natural

**eval-trace:** EVAL-BCE2-020

---

#### REQ-BCE2-038: Platform Update Resilience [P2]

**Description:** If the BookingTimes platform updates its CSS, the system detects differences via re-scrape, updates its catalogue, and flags previously generated content that uses removed or changed classes for review. New classes become available for future generation. Existing approved content is not silently broken.

**Priority:** P2

**Acceptance Criteria:**
- Re-scrape detects added, removed, and changed classes
- Diff report produced
- Previously generated content using deprecated classes flagged for review
- New classes available for future generation

**eval-trace:** EVAL-BCE2-058

---

#### REQ-BCE2-039: WYSIWYG Paste Acceptance [P0]

**Description:** Exported HTML, when pasted into BookingTimes WYSIWYG code view editor, must be preserved without significant modification by TinyMCE's HTML sanitizer. Class attributes, Bootstrap grid structure, `<script type="application/ld+json">` blocks (confirmed per DEC-035), and custom `data-bce-*` attributes must survive paste.

**Priority:** P0

**Acceptance Criteria:**
- >= 95% of HTML structure preserved after paste
- Class attributes preserved on all elements
- JSON-LD script tags survive (confirmed by DEC-035)
- Bootstrap grid structure preserved
- Content renders correctly after paste

**eval-trace:** EVAL-BCE2-046

---

#### REQ-BCE2-040: Edit Distance Tracking [P1]

**Description:** Track the normalized Levenshtein edit distance between generated HTML and human-approved HTML (text content, stripping HTML tags). Edit distance should decrease over feedback iterations per site. Target: by page 16+, 80% of generated pages require only copy edits (<5% edit distance). Dashboard view tracks edit distance trends per site.

**Priority:** P1

**Acceptance Criteria:**
- Edit distance computed and stored for every generated-vs-approved pair
- Statistically significant downward trend over 20+ pages per site
- Pages 1-5: edit rates of 30-50% expected (cold start)
- Pages 16+: 80% of pages require <5% edits (target)
- Dashboard displays edit distance trends

**eval-trace:** EVAL-BCE2-021

---

#### REQ-BCE2-041: Version History [P1]

**Description:** Every content edit creates a new version record in `page_versions` with full HTML snapshot, sequential version number, timestamp, source type (`ai_generate`, `ai_refine`, `manual_edit`, `rollback`, `assembly`, `link_cascade`), and change summary. Rolling back creates a new version (N+1 with content from version M), not a destructive overwrite. Section-level tracking via `section_specs.generated_html` and status.

**Priority:** P1

**Acceptance Criteria:**
- New version created on every save
- Previous versions remain accessible and unmodified
- Non-destructive rollback (creates new version)
- Full version history preserved including rollback actions
- `link_cascade` source type tracks auto-regenerated link sections

**eval-trace:** EVAL-BCE2-003

---

#### REQ-BCE2-042: End-to-End Single-Site Pipeline [P0]

**Description:** The complete pipeline must function end-to-end: take one site from Stage 1 through Stage 5, producing at least 3 approved pages (homepage + 1 service + 1 location). All Scribe checkpoints fire at stage transitions. Exported HTML passes all validation checks.

**Priority:** P0

**Acceptance Criteria:**
- All 5 stages complete without errors for one site
- At least 3 pages exported (homepage + service + location)
- Exported pages pass HTML validity, CSS class validation, heading hierarchy, schema validation, and export checklist
- All Scribe checkpoints fire at stage transitions
- Brand profile enriched through the process

**eval-trace:** EVAL-BCE2-051

---

## 5. Traceability Matrix

| Requirement | Priority | Eval Case(s) | Threshold | Scorer Type |
|-------------|----------|--------------|-----------|-------------|
| REQ-BCE2-001 | P0 | EVAL-BCE2-001 | >= 95% CSS file capture; 100% tier classification accuracy | Algorithmic |
| REQ-BCE2-002 | P0 | EVAL-BCE2-002 | >= 90% extraction accuracy; zero sidebar/content mixing | Algorithmic + AI-Rubric |
| REQ-BCE2-003 | P0 | EVAL-BCE2-019, 057 | AI-rubric >= 7/10 cold start, >= 8/10 proficient; confidence reflects volume | AI-Rubric |
| REQ-BCE2-004 | P1 | EVAL-BCE2-033, 034 | 100% correct types; all required properties present | Algorithmic |
| REQ-BCE2-005 | P0 | EVAL-BCE2-051 | All URLs captured; page types classified | Algorithmic |
| REQ-BCE2-006 | P0 | EVAL-BCE2-022, 023, 024, 025, 026 | 100% format compliance; zero duplicates; >= 3 E-E-A-T signals | Algorithmic + AI-Rubric |
| REQ-BCE2-007 | P0 | EVAL-BCE2-028, 029, 030, 031 | >= 1 direct answer block/page; 3-5 FAQ items; >= 1 stat/200 words | Algorithmic + AI-Rubric |
| REQ-BCE2-008 | P0 | EVAL-BCE2-032, 033, 034 | 100% valid JSON; correct types; @graph pattern; all properties | Algorithmic |
| REQ-BCE2-009 | P1 | EVAL-BCE2-048 | Silo links present; cross-silo rules followed | Algorithmic |
| REQ-BCE2-010 | P0 | EVAL-BCE2-051 | Multi-dimensional scoring per page; status classification | Algorithmic + AI-Rubric |
| REQ-BCE2-011 | P0 | EVAL-BCE2-051 | All missing page types identified | Algorithmic |
| REQ-BCE2-012 | P1 | EVAL-BCE2-051, 053 | Hierarchy-based prioritization; homepage always first | Algorithmic |
| REQ-BCE2-013 | P0 | EVAL-BCE2-047, 048 | Zero orphans; max 3 clicks from homepage; zero broken links | Algorithmic |
| REQ-BCE2-014 | P0 | EVAL-BCE2-048c | Section count std dev > 0; >= 2 distinct orderings | Algorithmic |
| REQ-BCE2-015 | P1 | EVAL-BCE2-048 | Three silos defined; root-level services; flat locations | Algorithmic |
| REQ-BCE2-016 | P0 | EVAL-BCE2-027, 047, 048b | Anchor distribution within targets; max 3 exact per target; zero broken links | Algorithmic |
| REQ-BCE2-017 | P1 | EVAL-BCE2-018, 054 | CSS tier decision per section; sidebar-aware; BS 5.0.2 only | Algorithmic + AI-Rubric |
| REQ-BCE2-018 | P0 | EVAL-BCE2-019, 020, 042 | 12-layer assembly; token budget 3k-8.5k; few-shot examples included | Algorithmic + AI-Rubric |
| REQ-BCE2-019 | P0 | EVAL-BCE2-018, 045 | Zero unknown classes; zero 5.1+ classes; zero cross-site contamination | Algorithmic |
| REQ-BCE2-020 | P1 | EVAL-BCE2-035, 036, 037, 038 | CSS fallback for all; self-contained JS; keyboard navigable; ARIA compliant | Algorithmic + Human-Aligned |
| REQ-BCE2-021 | P0 | EVAL-BCE2-032, 033, 034, 034b | 100% valid JSON; correct types; @graph; content/schema match | Algorithmic |
| REQ-BCE2-022 | P0 | EVAL-BCE2-017, 043, 044, 046 | All artifacts present; validation checklist passes; paste-ready | Algorithmic + Human-Aligned |
| REQ-BCE2-023 | P0 | EVAL-BCE2-039, 040, 041 | 100% feedback persistence; >= 80% reflected in subsequent generations | Algorithmic + AI-Rubric |
| REQ-BCE2-024 | P1 | EVAL-BCE2-049, 050 | 100% correct classification; actionable recommendations per alert | Algorithmic + AI-Rubric |
| REQ-BCE2-025 | P0 | EVAL-BCE2-003 | 100% constraints enforced; zero migration errors; indexes present | Algorithmic |
| REQ-BCE2-026 | P0 | EVAL-BCE2-004, 055 | 100% invalid transitions rejected; per-site independent progression | Algorithmic |
| REQ-BCE2-027 | P0 | EVAL-BCE2-053 | Homepage first; hierarchy enforced; batch requires 3-5 approved suburb pages | Algorithmic |
| REQ-BCE2-028 | P0 | EVAL-BCE2-039, 040, 042, 052 | Zero data loss; site isolation; token budget management | Algorithmic + AI-Rubric |
| REQ-BCE2-029 | P1 | EVAL-BCE2-005 | Happy-path returns parsed; timeout/retry functional | Algorithmic |
| REQ-BCE2-030 | P1 | EVAL-BCE2-054 | Zero overlaps; correct width per page type; sidebar simulated in preview | AI-Rubric |
| REQ-BCE2-031 | P1 | EVAL-BCE2-054 | All CSS tiers loaded; responsive breakpoints; offline capable | Algorithmic + AI-Rubric |
| REQ-BCE2-032 | P1 | EVAL-BCE2-006, 056 | Zero data loss; correct resume point; no re-generation of completed work | Algorithmic |
| REQ-BCE2-033 | P0 | EVAL-BCE2-052 | Zero cross-site leakage; correct site_id filtering | Algorithmic |
| REQ-BCE2-034 | P0 | EVAL-BCE2-017 | Zero validation errors; zero disallowed elements; zero placeholders | Algorithmic |
| REQ-BCE2-035 | P0 | EVAL-BCE2-022, 023, 024, 025, 026 | Heading hierarchy; keyword placement; uniqueness >= 40%; E-E-A-T signals | Algorithmic + AI-Rubric |
| REQ-BCE2-036 | P0 | EVAL-BCE2-028, 029, 030, 031 | Direct answer blocks; FAQ + schema; stats density; freshness signals | Algorithmic + AI-Rubric |
| REQ-BCE2-037 | P1 | EVAL-BCE2-020 | Coherence >= 7/10; zero contradictions; zero duplicated sentences | AI-Rubric |
| REQ-BCE2-038 | P2 | EVAL-BCE2-058 | CSS changes detected; deprecated classes flagged | Algorithmic |
| REQ-BCE2-039 | P0 | EVAL-BCE2-046 | >= 95% HTML preserved; JSON-LD survives; renders correctly | Human-Aligned |
| REQ-BCE2-040 | P1 | EVAL-BCE2-021 | Downward trend over 20+ pages; <5% edits by page 16+ | Human-Aligned |
| REQ-BCE2-041 | P1 | EVAL-BCE2-003 | Version on every save; non-destructive rollback; history preserved | Algorithmic |
| REQ-BCE2-042 | P0 | EVAL-BCE2-051 | 5 stages complete; 3 pages exported; all checks pass | Human-Aligned |

---

## 6. Success Metrics

| # | Metric | Target | Source | Priority |
|---|--------|--------|--------|----------|
| SM-1 | Generated content edit rate (pages 16+) | < 5% edit distance for 80% of pages | SC-1 / EVAL-BCE2-021 | 1 |
| SM-2 | SEO keyword ranking | Pages appear in local search results for target suburb + service keywords | SC-2 / GSC data | 2 |
| SM-3 | GEO citation readiness | 100% of pages have direct answer blocks, FAQ schema, statistics density | SC-2 / EVAL-BCE2-028, 029, 030 | 2 |
| SM-4 | Brand voice consistency | AI-rubric >= 8/10 by proficient phase; human confirms "sounds like this site" >= 80% | SC-3 / EVAL-BCE2-019 | 3 |
| SM-5 | Learning loop effectiveness | Statistically significant downward trend in edit distance over 20+ pages per site | SC-4 / EVAL-BCE2-021, 040 | 4 |
| SM-6 | Interactive element engagement | Pages with interactive JS show increased clicks, engagement, time on site | SC-5 / Analytics data | 5 |
| SM-7 | Freshness alert coverage | Zero stale content goes unnoticed; alerts fire for all pages > 10 weeks since deployment | SC-6 / EVAL-BCE2-049 | 6 |
| SM-8 | Export validation pass rate | 100% of exports pass automated validation checklist before clipboard copy | EVAL-BCE2-044 | -- |
| SM-9 | Multi-site isolation | Zero cross-site data leakage incidents | EVAL-BCE2-052 | -- |

---

## 7. Dependencies

| # | Dependency | Type | Impact | Affected Requirements |
|---|-----------|------|--------|----------------------|
| D-1 | Live BookingTimes driving school site access (5 sites) | External | Required for CSS/content scraping, brand inference, and audit | REQ-BCE2-001, 002, 003, 004, 005 |
| D-2 | BookingTimes WYSIWYG code view editor | External | All content deployed via manual paste. HTML, JSON-LD, and attributes must survive TinyMCE sanitization. DEC-035 confirms JSON-LD survives. | REQ-BCE2-022, 034, 039 |
| D-3 | Claude CLI (`claude -p`) on Max subscription | External | AI content generation, brand inference, and validation. Must be installed and authenticated on operator's machine. | REQ-BCE2-003, 018, 029 |
| D-4 | Bootstrap 5.0.2 | External | Locked CSS framework version on live sites (DEC-028). Tier 1 CSS source. | REQ-BCE2-001, 019 |
| D-5 | Font Awesome 6 Pro | External | Icon framework available on the platform. Catalogued separately. | REQ-BCE2-001, 019 |
| D-6 | better-sqlite3 | Framework | Local SQLite database for all structured data (DEC-011). Synchronous, no async overhead. | REQ-BCE2-025 |
| D-7 | SvelteKit (Svelte 5) with adapter-node | Framework | Frontend framework for local deployment (DEC-001, DEC-011). | All UI requirements |
| D-8 | Google Search Console API (optional) | External | Enriches Stage 3 prioritization with traffic data. Pipeline functions without it. | REQ-BCE2-012 |
| D-9 | jQuery (platform-bundled) | External | Available globally on BookingTimes pages. Tier 2 JS can use it. | REQ-BCE2-020 |

---

## 8. Open Questions

| # | Question | Why It Matters | Status |
|---|----------|---------------|--------|
| OQ-1 | Does BookingTimes allow executable JavaScript (inline `<script>`, event handlers) in page content pasted through code view? | Tier 3 interactivity depends on this. If JS is stripped, interactivity is limited to CSS-only (Tier 1) and head injection (Tier 2). | Open -- manual test required |
| OQ-2 | How does the learning/feedback loop persist across sessions? | Resolved: all learning persists in SQLite. No ephemeral session state matters for learning. Brand rules, brand examples, and brand profile history are all database-backed. (ADR-020) | Resolved |
| OQ-3 | What does "minimal edits" mean concretely for SC-1? | Resolved: <5% edit distance = copy edits only, 5-15% = minor revisions, >15% = significant. Target: 80% of pages at <5% by page 16+. (ADR-028) | Resolved |
| OQ-4 | Are there Bootstrap 5.1+ features assumed in the design that do not exist in 5.0.2? | Resolved: key gaps identified (CSS custom properties, `text-bg-*`, dark mode, `z-*` utilities). Mitigated by validated 5.0.2 class catalogue. (ADR-016) | Resolved |
| OQ-5 | Does the WYSIWYG editor strip `<script type="application/ld+json">`? | Resolved: confirmed JSON-LD survives TinyMCE paste (DEC-035). | Resolved |
| OQ-6 | What is the concrete page inventory across all 5 sites? | Stage 1 sitemap crawl will answer this. Approximate count needed for effort estimation. | Open -- resolved by Stage 1 |
| OQ-7 | How will content freshness be tracked given manual paste deployment? | Resolved: operator manually marks "deployed" after paste. Three timestamps tracked. (ADR-019) | Resolved |
| OQ-8 | Can sites progress through stages independently? | Resolved: yes. Per-site independent progression. Stage 2 is global. (ADR-012) | Resolved |
| OQ-9 | Which site should be the pilot? | Open -- operator to decide. Recommendation: site with most existing content (richer brand inference). | Open |
| OQ-10 | Can the operator directly modify custom CSS files on each site? | Determines Tier 3 CSS deployment friction. If CSS changes require a support ticket, turnaround time becomes a bottleneck. | Open |

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| **BookingTimes** | A SaaS booking platform (ASP.NET Web Forms) used to host the 5 driving school websites. Functions as a booking system, not a CMS. |
| **AutomotiveBusiness** | The correct schema.org type for driving schools. `DrivingSchool` does not exist in schema.org. |
| **Bootstrap 5.0.2** | The specific version of the Bootstrap CSS framework running on all 5 live sites. Later versions (5.1-5.3) add features not available on the platform. |
| **Brand profile** | A structured record of a site's inferred brand voice: voice description, tone keywords, terminology patterns, sentence style, recurring phrases, and anti-patterns. Stored in `brand_profiles`. |
| **Brand rules** | Scoped rules (global, brand, page-type, section-type, page) with confidence scores that guide content generation. Sources: inferred, research, feedback, manual. Stored in `brand_rules`. |
| **Brand examples** | Approved (positive) or rejected (negative) content sections stored as few-shot examples for future generation. Stored in `brand_examples`. |
| **Code view paste** | The deployment mechanism: switching to code view in the BookingTimes WYSIWYG editor and pasting HTML directly. The only way to deploy content. |
| **CSS Tier 1** | Bootstrap 5.0.2 base CSS. Use freely. Never modify. Shared across all sites. |
| **CSS Tier 2** | Site-specific custom CSS files. Use where appropriate. Can be extended with new classes. Identified from scraped stylesheets. |
| **CSS Tier 3** | System-generated new custom CSS. Created when Tiers 1-2 are insufficient. Must be approved by operator and added to site's custom CSS file. |
| **Direct answer block** | A self-contained 40-60 word paragraph that directly answers a specific question. Serves as a pre-formed snippet AI engines can extract verbatim. A GEO optimization technique. |
| **E-E-A-T** | Experience, Expertise, Authoritativeness, Trustworthiness. Google's quality framework for evaluating content. For driving schools: instructor qualifications, TMR accreditation, transparent pricing, reviews, contact methods. |
| **GEO** | Generative Engine Optimization. Structuring content for citation by AI search engines (Google AI Overviews, Perplexity, ChatGPT). Techniques: direct answer blocks, FAQ schema, statistics density, freshness signals. |
| **Hybrid Two-Page Model** | Content architecture with Service Pages (3-6, content-heavy, root-level) and Location Pages (50+, lean, under `/areas/`). No service x location matrix. |
| **JSON-LD** | JavaScript Object Notation for Linked Data. The format used for structured data (schema.org) markup. Placed in `<script type="application/ld+json">` tags in the body. |
| **Link graph** | A directed graph of internal links stored in `internal_link_graph`. Nodes are pages; edges are links with type, anchor text, and variant classification. Built before content generation. |
| **Scribe checkpoint** | A mandatory documentation event at every pipeline stage transition. Records deliverables, decisions, and state for session resumption. Stored in `scribe_checkpoints`. |
| **Section-based generation** | Content produced one section at a time via individual Claude CLI calls, not as whole pages. Enables per-section review, feedback, and learning. |
| **Silo** | A topical content grouping (Services, Locations, Trust) with defined internal linking rules. Hub-and-spoke structure with cross-silo links following defined patterns. |
| **TinyMCE** | The WYSIWYG editor used by BookingTimes. Has HTML sanitization (DOMPurify) that may strip certain elements. JSON-LD confirmed to survive (DEC-035). Executable JS survival unconfirmed (OQ-1). |
| **TLDR-first** | Content structure where the first 200 words directly and completely answer the primary query. No building up to the answer. A GEO optimization technique. |
| **TMR** | Transport and Main Roads. The Queensland government department responsible for driver licensing. TMR accreditation is a key E-E-A-T signal for driving schools. |
| **12-layer context assembly** | The prompt construction technique for section generation. 12 layers of context (platform constraints through output format) assembled per Claude CLI call, targeting 3,000-8,500 tokens. |
