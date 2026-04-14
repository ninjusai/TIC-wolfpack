---
title: "Eval Specification: Bookingtimes Content Emulator V2.1 Rebuild"
version: "1.0.0"
status: complete
eval-id: EVL-bookingtimes-content-emulator-002
references:
  - PRB-bookingtimes-content-emulator-002
  - ARCH-bookingtimes-content-emulator-002
  - design-v2.1.md
  - eval-spec.md (V1 — partially carried forward)
created: 2026-04-02
author: Eval
domain: content-management
project: bookingtimes-content-emulator
total-cases: 52
supersedes: EVL-bookingtimes-content-emulator-001
---

# Eval Specification: Bookingtimes Content Emulator V2.1 Rebuild

## 1. Eval Overview

### 1.1 Purpose

This document defines what "good" looks like for the V2.1 rebuild before any code is written. It translates the 7 success criteria from PRB-bookingtimes-content-emulator-002 into formal, testable eval cases across the full 5-stage pipeline, covering infrastructure, content quality, SEO/GEO optimization, structured data, interactivity, learning, export, content architecture, and freshness.

### 1.2 Scope

The eval covers the complete V2.1 system:
- 5-stage pipeline (Audit → Research → Gap Analysis → Design → Build)
- Section-based generation with 12-layer context assembly
- Brand voice inference and learning loop
- SEO/GEO/Schema integration at every stage
- Three-tier CSS strategy (Bootstrap 5.0.2 base, site custom, new custom)
- Three-tier JS interactivity (CSS-only, head injection, inline scripts)
- Multi-artifact export (HTML + JSON-LD + Head JS)
- Content freshness detection and alerting
- Internal link graph with anchor text rotation

### 1.3 Maturity Targets

The system is expected to mature over time. Eval thresholds reflect this:

| Maturity Phase | Pages Approved | Expected Edit Rate | Expected Eval Pass Rate |
|---|---|---|---|
| **Cold Start** | 0-5 | HIGH (30-50% content changed) | P0 cases pass, P1 partial |
| **Learning** | 5-20 | MEDIUM (15-30% content changed) | P0 + most P1 pass |
| **Proficient** | 20-50 | LOW (5-15% content changed) | P0 + P1 pass, P2 partial |
| **Mature** | 50+ | MINIMAL (<5% content changed) | All P0 + P1 + most P2 pass |

### 1.4 Success Criteria Mapping

Every success criterion from the problem definition maps to at least one eval case:

| Priority | Success Criterion | Eval Cases |
|---|---|---|
| 1 | Content passes human review with minimal edits | EVAL-BCE2-017, 018, 019, 020, 021 |
| 2 | Pages rank for target keywords (SEO) | EVAL-BCE2-022, 023, 024, 025, 026, 027 |
| 2 | Content structured for AI citation (GEO) | EVAL-BCE2-028, 029, 030, 031 |
| 3 | Per-site brand voice consistency | EVAL-BCE2-019, 020 |
| 4 | System learns from feedback over time | EVAL-BCE2-039, 040, 041, 042 |
| 5 | Interactive elements drive engagement | EVAL-BCE2-035, 036, 037, 038 |
| 6 | System alerts when content is stale | EVAL-BCE2-049, 050 |

### 1.5 Scorer Types

| Type | Description | When Used |
|---|---|---|
| **Algorithmic** | Fully automated. Deterministic pass/fail via code. | HTML validation, class checking, schema parsing, link graph traversal |
| **AI-Rubric** | LLM judge with structured rubric. Repeatable but probabilistic. | Brand voice match, content coherence, GEO quality assessment |
| **Human-Aligned** | Requires human ground truth or human review. Cannot be fully automated. | Edit distance tracking, WYSIWYG paste acceptance, engagement metrics |

---

## 2. Eval Summary

| Category | Cases | P0 | P1 | P2 |
|---|---|---|---|---|
| Pipeline Infrastructure | 7 | 4 | 2 | 1 |
| Content Quality | 5 | 3 | 2 | 0 |
| SEO | 6 | 3 | 2 | 1 |
| GEO | 4 | 2 | 2 | 0 |
| Schema / Structured Data | 4 | 3 | 1 | 0 |
| JavaScript / Interactivity | 4 | 1 | 2 | 1 |
| Learning / Feedback | 4 | 2 | 1 | 1 |
| Export / Deployment | 4 | 3 | 1 | 0 |
| Content Architecture | 4 | 2 | 2 | 0 |
| Freshness | 2 | 1 | 1 | 0 |
| Cross-Cutting / Edge Cases | 8 | 3 | 3 | 2 |
| **Total** | **52** | **27** | **19** | **6** |

---

## 3. Eval Cases — Pipeline Infrastructure

### EVAL-BCE2-001: CSS Scraping Completeness and Tier Classification

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-001 |
| **Category** | Pipeline Infrastructure |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** The CSS scraper must capture all stylesheets from a target site and correctly classify them into three tiers: Bootstrap 5.0.2 base, site custom CSS, and platform/third-party CSS.

**Input:** Live BookingTimes driving school site URL.

**Expected Outcome:**
- All `<link rel="stylesheet">` and inline `<style>` blocks captured
- Bootstrap 5.0.2 CDN stylesheet identified and classified as Tier 1
- Site-specific custom CSS file(s) (e.g., `LoadCSS?k=` patterns) identified as Tier 2
- Platform CSS, Font Awesome 6 Pro, and third-party libraries classified separately
- Zero content-area CSS files missed

**Threshold:** >= 95% of manually-verified CSS files captured; 100% tier classification accuracy for known files.

---

### EVAL-BCE2-002: Content Scraping Accuracy

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-002 |
| **Category** | Pipeline Infrastructure |
| **Priority** | P0 |
| **Scorer** | Algorithmic + AI-Rubric |

**Description:** The content scraper must extract the correct content sections from a page, distinguishing page content from platform chrome (navigation, sidebar, footer).

**Input:** 5 representative pages (homepage, service page, location page, about page, FAQ page) from one site.

**Expected Outcome:**
- Main content area correctly identified and extracted (excludes nav, sidebar, footer)
- Heading hierarchy preserved (H1-H6 structure intact)
- Text content matches live page (no truncation, no extra platform text)
- Images, lists, and CTAs captured with their surrounding markup
- Sidebar content identified separately (not mixed into main content)

**Threshold:** >= 90% content extraction accuracy measured against human-verified ground truth per page. Zero cases where sidebar content is mixed into main content extraction.

---

### EVAL-BCE2-003: Database Schema Integrity

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-003 |
| **Category** | Pipeline Infrastructure |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** The 25+ table SQLite schema must enforce referential integrity, apply all migrations in order, and support the full pipeline data model.

**Input:** Fresh database initialization via migration scripts.

**Expected Outcome:**
- All migrations run without error in sequence
- All 25+ tables created with correct columns and types
- Foreign key constraints enforced (`PRAGMA foreign_keys = ON`)
- Attempting to insert a `section_specs` row with a nonexistent `blueprint_id` fails
- Attempting to insert a `content_freshness` row with a nonexistent `site_id` fails
- `sites.pipeline_stage` CHECK constraint rejects invalid values
- `section_specs.status` CHECK constraint rejects invalid values
- Indexes exist on performance-critical columns: `(site_id, status)` on `work_backlog`, `(site_id, class_name)` on `css_audit`

**Threshold:** 100% of constraints enforced. Zero migration errors.

---

### EVAL-BCE2-004: Stage Gate Enforcement

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-004 |
| **Category** | Pipeline Infrastructure |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** The pipeline must enforce strict stage ordering. No site can advance to a later stage without completing prerequisites. Specifically: Stage 3 requires both Stage 1 (for that site) AND Stage 2 (global). Stages 3→4→5 are strictly sequential per site.

**Input:** Attempt to advance a site through stages out of order.

**Expected Outcome:**
- Attempting to start Stage 3 for a site that has not completed Stage 1 is rejected
- Attempting to start Stage 3 when Stage 2 (global) is incomplete is rejected
- Attempting to start Stage 4 before Stage 3 is complete for that site is rejected
- Attempting to start Stage 5 before Stage 4 is complete for that site is rejected
- Two sites can be at different stages simultaneously (independent progression)
- Stage 2 completion unlocks Stage 3 for ALL sites that have completed Stage 1

**Threshold:** 100% of invalid stage transitions rejected. 100% of valid transitions accepted.

---

### EVAL-BCE2-005: Claude CLI Subprocess Integration

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-005 |
| **Category** | Pipeline Infrastructure |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** The Claude CLI subprocess must correctly spawn, send prompts via stdin, receive responses via stdout, handle errors via stderr, and enforce timeouts and retries.

**Input:** A test prompt sent via `child_process.spawn("claude", ["-p", ...])`.

**Expected Outcome:**
- Prompt delivered via stdin (not command-line argument, to avoid Windows cmd length limits)
- Response captured from stdout and parsed correctly
- `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_API_KEY` stripped from subprocess environment
- Timeout fires after 120 seconds (configurable) if no response
- Retry logic executes up to 3 attempts with exponential backoff (2s, 4s, 8s)
- Stderr errors are captured and surfaced to the UI

**Threshold:** 100% of happy-path calls return parsed responses. Timeout and retry fire correctly on simulated failures.

---

### EVAL-BCE2-006: Scribe Checkpoint Persistence

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-006 |
| **Category** | Pipeline Infrastructure |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Every stage transition must produce a Scribe checkpoint that documents deliverables, decisions, and current state, enabling session resumption without information loss.

**Input:** Complete a stage transition (e.g., Stage 1 → Stage 2 gate) and verify checkpoint creation.

**Expected Outcome:**
- Checkpoint record created in the database with: stage completed, deliverables list, decisions made, timestamp
- Checkpoint contains sufficient detail to resume from this point in a new session
- Checkpoint is logged via the logging system
- A new session can query the latest checkpoint and determine: which site, which stage, what was completed, what is pending

**Threshold:** 100% of stage transitions produce a checkpoint. Checkpoint contains all required fields.

---

### EVAL-BCE2-007: Bootstrap 5.0.2 Class Catalogue Accuracy

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-007 |
| **Category** | Pipeline Infrastructure |
| **Priority** | P2 |
| **Scorer** | Algorithmic |

**Description:** The system must maintain an accurate catalogue of valid Bootstrap 5.0.2 classes, excluding classes only available in 5.1+. This catalogue is used to validate generated HTML and assemble the CSS palette for prompts (Layer 8).

**Input:** The Bootstrap 5.0.2 source CSS file parsed into a class catalogue.

**Expected Outcome:**
- Catalogue includes all utility classes present in BS 5.0.2 (e.g., `d-flex`, `text-center`, `mb-3`)
- Catalogue excludes 5.1+ additions (e.g., `text-bg-primary` from 5.2, CSS custom properties from 5.1, `z-*` utilities from 5.3)
- Validation against 20 known BS 5.0.2 classes returns all as valid
- Validation against 10 known BS 5.1-5.3-only classes returns all as invalid

**Threshold:** 100% accuracy on the 30-class test set. Zero false positives (5.1+ classes accepted) or false negatives (5.0.2 classes rejected).

---

## 4. Eval Cases — Content Quality

### EVAL-BCE2-017: HTML Validity and Paste-Readiness

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-017 |
| **Category** | Content Quality |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Generated HTML must be well-formed, body-level only (no `<head>`, `<html>`, `<body>` wrapper tags), with no broken tags, no unclosed elements, and no head-only elements (e.g., `<meta>`, `<title>`) in the content.

**Input:** Generated HTML for one complete page (all sections assembled).

**Expected Outcome:**
- HTML parses without errors
- All tags properly nested and closed
- No `<html>`, `<head>`, `<body>`, `<meta>`, `<title>`, `<link>` tags in output (body-level content only)
- No bare element selectors in inline styles
- No placeholder tokens remaining (`{{...}}`, `[TBD]`, `TODO`, `INSERT_`)
- Content is a self-contained HTML fragment suitable for paste into code view editor

**Threshold:** Zero HTML validation errors. Zero disallowed elements. Zero placeholder tokens.

---

### EVAL-BCE2-018: Bootstrap 5.0.2 Class Usage Correctness

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-018 |
| **Category** | Content Quality |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Every CSS class in generated HTML must be valid — either from the BS 5.0.2 catalogue (Tier 1), the site's custom CSS (Tier 2), or system-generated approved custom CSS (Tier 3). No classes from BS 5.1-5.3 only. No unknown classes.

**Input:** Generated HTML for one page + the site's three-tier CSS catalogue.

**Expected Outcome:**
- Every class in the HTML resolves to Tier 1, Tier 2, or Tier 3
- Zero classes that exist only in Bootstrap 5.1+ (e.g., `text-bg-primary`, `z-3`)
- Zero classes that are completely unknown (typos, hallucinated classes)
- Font Awesome 6 Pro icon classes (e.g., `fa-solid`, `fa-car`) validated against FA6 catalogue

**Threshold:** Zero unknown or invalid classes across the entire page.

---

### EVAL-BCE2-019: Brand Voice Match

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-019 |
| **Category** | Content Quality |
| **Priority** | P0 |
| **Scorer** | AI-Rubric |

**Description:** Generated content must match the inferred brand voice profile for the target site. Content for Site A must sound like Site A, not like Site B or like generic AI output.

**Input:** Generated page content + the site's `brand_profiles` record (voice_description, tone_keywords, terminology_patterns, sentence_style, recurring_phrases, anti_patterns).

**Expected Outcome:**
- Tone matches the profile's tone_keywords (e.g., "warm", "encouraging", "local")
- Terminology follows the profile's patterns (e.g., uses "learner driver" not "student driver" if that is the site's pattern)
- Sentence structure matches the profile's style (short/long, active/passive, direct address)
- Anti-patterns are absent (e.g., if the brand avoids overly formal language, none appears)
- Content is distinguishable from the other 4 sites' brand voices

**Threshold:**
- AI-rubric score >= 7/10 on voice consistency (cold start)
- AI-rubric score >= 8/10 on voice consistency (proficient, 20+ pages)
- Human reviewer confirms "sounds like it belongs on this site" for >= 80% of pages

---

### EVAL-BCE2-020: Section Coherence

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-020 |
| **Category** | Content Quality |
| **Priority** | P1 |
| **Scorer** | AI-Rubric |

**Description:** Sections generated individually must read naturally in sequence when assembled into a full page. No abrupt topic shifts, no repeated information across sections, no contradictory statements.

**Input:** Complete assembled page (all sections in order) for one page.

**Expected Outcome:**
- Sections flow logically from one to the next
- No repeated sentences or paragraphs across sections
- No contradictory information (e.g., different prices in two sections)
- Transitions between sections feel natural, not jarring
- The page reads as a unified document, not as separately-written fragments

**Threshold:** AI-rubric score >= 7/10 on coherence. Zero contradictions detected. Zero exact duplicated sentences across sections.

---

### EVAL-BCE2-021: Edit Distance Tracking

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-021 |
| **Category** | Content Quality |
| **Priority** | P1 |
| **Scorer** | Human-Aligned |

**Description:** The system must track the edit distance between generated content and human-approved content, and this distance should decrease over feedback iterations for the same site.

**Input:** Generated content vs. final approved content for 10+ pages across multiple feedback iterations for one site.

**Expected Outcome:**
- Edit distance is computed and stored for every generated-vs-approved pair
- A trend line over 10+ pages shows a decreasing edit rate
- Pages 1-5 may have edit rates of 30-50% (cold start)
- Pages 15-20 should show edit rates of 15-30% (learning phase)
- Pages 40-50 should show edit rates of <15% (proficient phase)

**Threshold:** Statistically significant downward trend in edit distance over 20+ pages for a single site. Not a fixed numeric threshold — the trend matters.

---

## 5. Eval Cases — SEO

### EVAL-BCE2-022: Heading Hierarchy Compliance

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-022 |
| **Category** | SEO |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Generated pages must have a valid heading hierarchy: exactly one H1, logical H2-H6 nesting with no skipped levels, H1 contains the primary target keyword.

**Input:** Generated HTML for one page + target keyword.

**Expected Outcome:**
- Exactly one `<h1>` tag per page
- H1 contains the primary target keyword (exact or close match)
- No skipped heading levels (e.g., H1 → H3 without H2 is invalid)
- H2 headings are descriptive and unique within the page (not generic like "Welcome")
- Heading count is appropriate for page type (service pages: 5-10 headings; location pages: 4-8)

**Threshold:** Zero heading hierarchy violations. H1 keyword presence required.

---

### EVAL-BCE2-023: Target Keyword Placement

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-023 |
| **Category** | SEO |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Target suburb + service keywords must appear in key positions: H1, first paragraph (first 200 words), and at natural density throughout the content.

**Input:** Generated page HTML + target keyword(s) for that page.

**Expected Outcome:**
- Primary keyword appears in H1
- Primary keyword appears in the first 200 words of body content
- Keyword density is 1-3% (natural, not stuffed)
- Location modifier (suburb name) appears in H1 for location pages
- Service modifier appears for service pages

**Threshold:** Primary keyword present in H1 and first 200 words. Density between 0.5% and 4%.

---

### EVAL-BCE2-024: Title Tag and Meta Description Quality

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-024 |
| **Category** | SEO |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Generated pages must include properly formatted title tag and meta description recommendations that follow the benchmark formulas.

**Input:** Page blueprint + generated title/meta recommendations.

**Expected Outcome:**
- Title tag under 60 characters
- Title follows the benchmark formula (e.g., `[Service] in [Location] | [Brand Name]` for service pages)
- Primary keyword appears first in title
- Meta description 150-160 characters
- Meta description includes CTA, USP, and location
- Each page's title and meta are unique across the site

**Threshold:** 100% format compliance. Zero duplicate titles or metas within a site.

---

### EVAL-BCE2-025: Content Uniqueness Across Suburb Pages

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-025 |
| **Category** | SEO |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Suburb/location pages must have 40-50% unique content. The shared content (service descriptions, CTAs) is acceptable, but each suburb page must include substantial unique content (local landmarks, driving conditions, TMR offices, local testimonials).

**Input:** Generated HTML for 5+ suburb pages from the same site.

**Expected Outcome:**
- Pairwise content similarity between any two suburb pages is <= 60% (i.e., >= 40% unique)
- Unique content includes suburb-specific elements: local landmarks, driving conditions, specific roads/roundabouts, nearest TMR office, local FAQ
- No two suburb pages have identical section text (beyond shared structural elements like CTAs)

**Threshold:** >= 40% unique content per suburb page, measured by text similarity (Jaccard or cosine similarity on paragraph-level segments). Zero identical non-CTA paragraphs across suburbs.

---

### EVAL-BCE2-026: E-E-A-T Signal Presence

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-026 |
| **Category** | SEO |
| **Priority** | P1 |
| **Scorer** | Algorithmic + AI-Rubric |

**Description:** Generated content must include E-E-A-T signals appropriate for a driving school: instructor qualifications, TMR accreditation, transparent pricing, reviews/testimonials, physical address, contact methods, ABN.

**Input:** Generated page HTML.

**Expected Outcome:**
- At least 3 of the following E-E-A-T elements present per service/location page:
  - Instructor name or qualification mention
  - TMR accreditation or Cert IV reference
  - Specific pricing or pricing transparency signal
  - Testimonial or review reference
  - Physical address or service area
  - Multiple contact methods (phone, email, booking link)
  - Years of experience or students taught

**Threshold:** >= 3 E-E-A-T signals per service/location page. Homepage must have >= 5.

---

### EVAL-BCE2-027: Internal Link Compliance

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-027 |
| **Category** | SEO |
| **Priority** | P2 |
| **Scorer** | Algorithmic |

**Description:** Generated content must include the internal links specified in the page blueprint, with correct URLs and anchor text drawn from the rotation bank.

**Input:** Generated HTML + page blueprint link requirements + anchor text bank.

**Expected Outcome:**
- All required outbound links from the blueprint are present in the HTML
- Link URLs resolve to known pages in the link graph
- Anchor text matches one of the approved variants from the anchor text bank
- 3-10 contextual internal links per page (excluding nav/footer)
- No broken links (all hrefs point to valid pages)

**Threshold:** 100% of required links present. Zero broken links. All anchor text from approved bank.

---

## 6. Eval Cases — GEO

### EVAL-BCE2-028: Direct Answer Block Presence

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-028 |
| **Category** | GEO |
| **Priority** | P0 |
| **Scorer** | AI-Rubric |

**Description:** Every generated page must contain at least one direct answer block — a self-contained 40-60 word paragraph that directly answers a specific question. These serve as pre-formed snippets AI engines can extract verbatim.

**Input:** Generated page HTML.

**Expected Outcome:**
- At least one paragraph of 40-60 words that directly answers a question implied by the page topic
- The answer is self-contained (makes sense without surrounding context)
- The answer is factual and specific (includes numbers, names, or concrete details)
- The answer is positioned in the first 200 words of the page (TLDR-first)

**Threshold:** >= 1 direct answer block per page. AI-rubric score >= 7/10 on answer completeness and specificity.

---

### EVAL-BCE2-029: FAQ Schema and Content Quality

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-029 |
| **Category** | GEO |
| **Priority** | P0 |
| **Scorer** | Algorithmic + AI-Rubric |

**Description:** Every service page and location page must include 3-5 FAQ questions with complete factual answers, both as visible HTML content and as FAQPage JSON-LD schema.

**Input:** Generated page HTML + JSON-LD output for a service or location page.

**Expected Outcome:**
- 3-5 Q&A pairs in visible HTML content
- Questions phrased as people ask AI assistants (natural language, not keyword-stuffed)
- Answers are 40-80 words each with specific facts (referencing TMR, QLD Government, specific numbers)
- FAQPage JSON-LD schema present with matching questions and answers
- HTML Q&A content and JSON-LD Q&A content are identical (no mismatch)

**Threshold:** 3-5 FAQ items per service/location page. JSON-LD matches HTML content exactly. AI-rubric >= 7/10 on question naturalness and answer specificity.

---

### EVAL-BCE2-030: Statistics Density

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-030 |
| **Category** | GEO |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Generated content must include specific statistics (prices, pass rates, hours required, students taught, years operating, suburbs served) at a frequency of approximately one per 150-200 words.

**Input:** Generated page HTML with word count.

**Expected Outcome:**
- Statistics identified by patterns: numbers, percentages, dollar amounts, year references, "X students", "Y years"
- Frequency: at least 1 statistic per 200 words of body content
- Statistics are specific and verifiable, not vague ("over 500 students" is acceptable; "many students" is not)

**Threshold:** >= 1 statistic per 200 words. Zero pages with no statistics at all.

---

### EVAL-BCE2-031: Freshness Signal Presence

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-031 |
| **Category** | GEO |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Generated content must include freshness signals: a visible "last updated" date, current year references, and time-sensitive content that indicates recency.

**Input:** Generated page HTML.

**Expected Outcome:**
- A visible "Last updated: [date]" or equivalent text present on the page
- At least one reference to the current year (2026) in the content
- No outdated references (e.g., mentioning 2024 pass rates without qualification)

**Threshold:** Freshness date present. Current year referenced at least once. Zero stale date references.

---

## 7. Eval Cases — Schema / Structured Data

### EVAL-BCE2-032: Valid JSON-LD Output

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-032 |
| **Category** | Schema / Structured Data |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** All JSON-LD output must be syntactically valid JSON, parseable without errors, and placed in `<script type="application/ld+json">` tags within the body.

**Input:** Generated JSON-LD blocks for one page.

**Expected Outcome:**
- Each JSON-LD block is valid JSON (parseable by `JSON.parse()`)
- Script tags use `type="application/ld+json"` exactly
- JSON-LD blocks are placed in the body content (not wrapped in `<head>`)
- Multiple JSON-LD blocks per page are acceptable (each in its own `<script>` tag)
- No JavaScript syntax mixed into JSON-LD blocks

**Threshold:** 100% valid JSON. Zero parse errors. Correct script type attribute.

---

### EVAL-BCE2-033: Correct Schema.org Types and @graph Pattern

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-033 |
| **Category** | Schema / Structured Data |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** JSON-LD must use the correct schema.org types per page type and follow the @graph/@id reference pattern for entity linking.

**Input:** Generated JSON-LD + page type classification.

**Expected Outcome:**
- Homepage uses `AutomotiveBusiness` (NOT `DrivingSchool`, which does not exist in schema.org)
- `@graph` array with `@id` cross-references between entities
- `BreadcrumbList` present on every page
- Page-type-specific schema applied:
  - Service pages: `Service` with `Offer`
  - Location pages: `AutomotiveBusiness` with `areaServed`
  - FAQ pages: `FAQPage`
- `sameAs` disambiguation links to Google Maps, Facebook, etc.

**Threshold:** 100% correct type usage. @graph pattern used on all pages. BreadcrumbList on every page.

---

### EVAL-BCE2-034: Required Schema Properties Present

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-034 |
| **Category** | Schema / Structured Data |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Schema entities must include all required properties. An `AutomotiveBusiness` without `name`, `address`, `telephone`, or `geo` is incomplete.

**Input:** Generated JSON-LD for homepage and location pages.

**Expected Outcome:**
- `AutomotiveBusiness` entities include: `name`, `address` (with `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`), `telephone`, `geo` (with `latitude`, `longitude`), `areaServed`
- `Service` entities include: `name`, `description`, `provider` (referencing the org via `@id`)
- `FAQPage` entities include: `mainEntity` array with `Question` items containing `name` and `acceptedAnswer`
- `BreadcrumbList` entities include: `itemListElement` with `position`, `name`, `item`

**Threshold:** 100% of required properties present per schema type. Zero incomplete entities.

---

### EVAL-BCE2-034b: JSON-LD Content Consistency

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-034b |
| **Category** | Schema / Structured Data |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Schema content must match visible page content. FAQ questions in JSON-LD must match FAQ questions in HTML. Business name in schema must match the brand name on the page.

**Input:** Generated HTML + JSON-LD for one page.

**Expected Outcome:**
- FAQ questions/answers in JSON-LD match visible FAQ content in HTML (exact text match)
- Business name in schema matches the site's brand name
- BreadcrumbList items match visible breadcrumb navigation
- Address in schema matches any address displayed on the page

**Threshold:** 100% match between schema content and visible page content. Zero mismatches.

---

## 8. Eval Cases — JavaScript / Interactivity

### EVAL-BCE2-035: Generated JS Is Self-Contained

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-035 |
| **Category** | JavaScript / Interactivity |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Any generated JavaScript must be self-contained, relying only on jQuery (platform-bundled) and Bootstrap 5.0.2 JS. No external CDN dependencies. No references to libraries not present on the platform.

**Input:** Generated Head JS artifact + any inline JS in HTML.

**Expected Outcome:**
- JS references only `jQuery`/`$` and Bootstrap 5.0.2 JS APIs
- No `import` statements or `require()` calls
- No references to external CDNs or unpkg/jsdelivr resources
- All DOM queries use `[data-bce-*]` attributes or `.bce-interactive-*` classes (namespaced)
- Uses `DOMContentLoaded` listener for initialization

**Threshold:** Zero external dependencies beyond jQuery and BS 5.0.2. Zero namespace collisions with `bce-` prefix.

---

### EVAL-BCE2-036: JS Does Not Conflict with Platform Scripts

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-036 |
| **Category** | JavaScript / Interactivity |
| **Priority** | P1 |
| **Scorer** | Algorithmic + Human-Aligned |

**Description:** Generated JavaScript must not interfere with BookingTimes platform scripts (booking widget, navigation, form handling).

**Input:** Generated Head JS loaded on a live BookingTimes page (manual test).

**Expected Outcome:**
- Platform booking widget still functions after JS injection
- Navigation and menu behavior unchanged
- No console errors caused by generated JS
- No global variable pollution (all code wrapped in IIFE or module scope)
- jQuery `$` alias is not reassigned or conflicted

**Threshold:** Zero platform functionality regressions. Zero console errors. Manual verification required.

---

### EVAL-BCE2-037: Interactive Element Accessibility

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-037 |
| **Category** | JavaScript / Interactivity |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** All interactive elements (accordions, tabs, calculators, toggles) must be keyboard navigable and include appropriate ARIA attributes.

**Input:** Generated HTML with interactive elements.

**Expected Outcome:**
- All interactive elements are reachable via Tab key
- Accordions/tabs have `role="tablist"`, `role="tab"`, `role="tabpanel"` as appropriate
- Expandable elements have `aria-expanded` attributes
- Buttons have descriptive `aria-label` where icon-only
- CSS-only interactive elements (`<details>`/`<summary>`) inherit native accessibility
- Touch targets are >= 48x48px

**Threshold:** Zero ARIA violations per interactive element. 100% keyboard navigability.

---

### EVAL-BCE2-038: CSS-Only Fallback Tier

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-038 |
| **Category** | JavaScript / Interactivity |
| **Priority** | P2 |
| **Scorer** | Algorithmic |

**Description:** Every interactive element that uses Tier 2 (head injection) or Tier 3 (inline script) JS must have a Tier 1 (CSS-only) fallback that provides basic functionality without JavaScript.

**Input:** Generated HTML with interactive elements, rendered with JS disabled.

**Expected Outcome:**
- Accordions still show content (collapsed by default with expand capability via `<details>`)
- Tabs show all tab content stacked (no JS-driven switching, but all content visible)
- Calculators show static result examples (no live calculation, but informative content remains)
- No content is hidden or inaccessible when JS is disabled

**Threshold:** All content remains accessible (visible and readable) with JS disabled. Degraded interactivity is acceptable; hidden content is not.

---

## 9. Eval Cases — Learning / Feedback

### EVAL-BCE2-039: Feedback Persistence Across Sessions

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-039 |
| **Category** | Learning / Feedback |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** All feedback (approvals, rejections, refinements, rule additions) must persist in the SQLite database and survive tool restart. No feedback stored in ephemeral session state.

**Input:** Provide feedback on 3 sections, close the tool, reopen, verify feedback is present.

**Expected Outcome:**
- Approved sections appear in `brand_examples` with correct `section_type`, `quality_rating`
- Rejected sections appear with `is_negative = 1` and rejection reason
- Refinement feedback creates entries in `brand_rules` with `source = 'feedback'`
- All feedback has correct `site_id` (per-site isolation)
- After tool restart, querying the database returns all feedback from the previous session

**Threshold:** 100% feedback persistence. Zero data loss on restart. Correct site_id association.

---

### EVAL-BCE2-040: Subsequent Generations Reflect Prior Feedback

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-040 |
| **Category** | Learning / Feedback |
| **Priority** | P0 |
| **Scorer** | AI-Rubric |

**Description:** After feedback is provided (e.g., "use shorter sentences" or "don't use the word 'journey'"), subsequent generations for the same site must reflect that feedback.

**Input:** Generate a section → provide specific feedback → regenerate a new section of the same type → compare.

**Expected Outcome:**
- If feedback says "use shorter sentences," the regenerated section has shorter average sentence length
- If feedback adds a terminology rule ("use 'learner driver' not 'student driver'"), the new section uses the correct term
- Approved examples from prior pages appear as few-shot context in new generation prompts (Layer 10)
- Brand rules derived from feedback appear in generation prompts (Layer 3)

**Threshold:** AI-rubric confirms feedback is reflected in >= 80% of cases. Prompt assembly includes relevant rules and examples (verifiable by inspecting assembled prompt).

---

### EVAL-BCE2-041: Brand Profile Updates Are Non-Destructive

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-041 |
| **Category** | Learning / Feedback |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Brand profile updates must preserve history. When the profile evolves from feedback, previous versions are snapshotted in `brand_profile_history`, not overwritten.

**Input:** Update a brand profile field (e.g., change tone_keywords) 3 times.

**Expected Outcome:**
- `brand_profiles` reflects the latest state
- `brand_profile_history` contains 3 snapshot records with timestamps
- Each snapshot contains the full profile state at that point in time
- `inference_confidence` increases as more pages are approved
- Original inferred profile is recoverable from history

**Threshold:** 100% of updates produce history snapshots. Zero data loss on profile evolution.

---

### EVAL-BCE2-042: Token Budget Management for Accumulated Learning

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-042 |
| **Category** | Learning / Feedback |
| **Priority** | P2 |
| **Scorer** | Algorithmic |

**Description:** As a site accumulates rules and examples (50+ rules, 30+ examples), the prompt assembler must select the most relevant subset to stay within token budget, not include all of them.

**Input:** A site with 60 brand rules and 40 brand examples. Generate a hero section.

**Expected Outcome:**
- Prompt assembled with a subset of rules (filtered by scope: global + brand + page_type + section_type relevant to hero)
- Prompt assembled with 2-5 most relevant examples (hero section examples, highest quality_rating)
- Total prompt tokens for Layers 2+3+10 stay within budget (~1,500-3,300 tokens)
- Most relevant rules prioritized (confirmed, high-confidence, matching scope)
- Irrelevant rules excluded (e.g., a FAQ-specific rule is not included for a hero section prompt)

**Threshold:** Prompt token count stays within the 3,000-8,500 total range per call (ADR-013). Relevance filtering demonstrably selects appropriate subset.

---

## 10. Eval Cases — Export / Deployment

### EVAL-BCE2-043: Multi-Artifact Export Completeness

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-043 |
| **Category** | Export / Deployment |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** The export pipeline must produce all required artifacts: Page HTML, Schema JSON-LD (appended to HTML body), and Head JS (separate artifact for head injection).

**Input:** Approved page with interactive elements and schema markup.

**Expected Outcome:**
- Page HTML artifact: complete body-level HTML with all sections assembled + JSON-LD `<script>` blocks appended
- Head JS artifact: separate `<script>` block for BookingTimes Analytics & Tracking paste
- Both artifacts are independently copy-to-clipboard ready
- No build step required between export and paste
- "Copy HTML" and "Copy Head JS" are separate actions

**Threshold:** All expected artifacts present. Each artifact is self-contained and paste-ready.

---

### EVAL-BCE2-044: Export Validation Checklist

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-044 |
| **Category** | Export / Deployment |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Before copy-to-clipboard, the system must run an automated validation checklist and block export if critical checks fail.

**Input:** Assembled page ready for export.

**Expected Outcome:**
- All CSS classes validated against the site's three-tier catalogue
- HTML well-formedness verified
- No bare element selectors in inline styles
- All internal links resolve to known pages in the link graph
- JSON-LD structurally valid
- Required sections from blueprint all present
- Word count within blueprint range
- No placeholder tokens remaining
- Export blocked if any critical check fails, with specific failure messages

**Threshold:** 100% of checklist items run before export. Critical failures block export. All validations produce actionable error messages.

---

### EVAL-BCE2-045: CSS Class Isolation Per Site

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-045 |
| **Category** | Export / Deployment |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Exported HTML for Site A must only use CSS classes available on Site A. No cross-site class contamination from Site B's custom CSS.

**Input:** Exported HTML for Site A + CSS catalogues for Sites A and B.

**Expected Outcome:**
- Every class in Site A's exported HTML belongs to: BS 5.0.2 (shared), Site A's custom CSS (Tier 2), or Site A's approved Tier 3 CSS
- Zero classes from Site B's custom CSS appear in Site A's export
- Bootstrap classes (shared across all sites) are not flagged as contamination

**Threshold:** Zero cross-site class contamination.

---

### EVAL-BCE2-046: WYSIWYG Paste Acceptance

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-046 |
| **Category** | Export / Deployment |
| **Priority** | P1 |
| **Scorer** | Human-Aligned |

**Description:** Exported HTML, when pasted into the BookingTimes WYSIWYG code view editor, must be preserved without significant modification by the editor's HTML sanitizer (TinyMCE).

**Input:** Exported HTML pasted into the live BookingTimes code view editor.

**Expected Outcome:**
- Class attributes preserved on all elements
- Bootstrap grid structure (`row`, `col-*`) preserved
- `<script type="application/ld+json">` blocks preserved (confirmed by DEC-035)
- Custom `data-bce-*` attributes preserved
- No structural elements stripped or rewritten
- Content renders correctly after paste

**Threshold:** >= 95% of HTML structure preserved after paste. JSON-LD script tags survive. Manual verification required.

---

## 11. Eval Cases — Content Architecture

### EVAL-BCE2-047: Link Graph Integrity

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-047 |
| **Category** | Content Architecture |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** The internal link graph must have no orphan pages (pages with < 2 incoming links) and no broken internal links (links pointing to non-existent pages).

**Input:** Complete link graph for one site (all existing + planned pages).

**Expected Outcome:**
- Every page has >= 2 incoming internal links
- Every page is reachable from the homepage within 3 clicks
- No internal links point to URLs not in the site structure map
- No self-referential links (page linking to itself)
- Bidirectional service↔location links exist per the silo strategy

**Threshold:** Zero orphan pages. Zero broken links. Max 3 clicks from homepage to any page.

---

### EVAL-BCE2-048: Silo Structure Maintenance

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-048 |
| **Category** | Content Architecture |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Content silos must be maintained: service pages link to their location pages, location pages link back to service pages, and geographic clusters link to 3-5 adjacent suburbs only.

**Input:** Complete link graph + silo definitions for one site.

**Expected Outcome:**
- Each service page links to all location pages where that service is offered ("Available In" section)
- Each location page links back to all service pages ("Services in [Suburb]" section)
- Each location page links to 3-5 geographically adjacent suburbs ("Nearby Areas" section)
- Cross-silo links follow the defined rules (not random)
- Hub pages ("Areas We Serve") link to all location pages in their cluster

**Threshold:** 100% of required silo links present. Geographic adjacency links limited to 3-5 per location page.

---

### EVAL-BCE2-048b: Anchor Text Rotation Compliance

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-048b |
| **Category** | Content Architecture |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Anchor text for internal links must follow the rotation distribution targets and respect the hard constraint: no exact anchor text used more than 3 times site-wide per target.

**Input:** All internal links across all generated pages for one site.

**Expected Outcome:**
- Exact match anchors: 10-20% of total
- Partial match: 30-40%
- Branded: 10-15%
- Natural/contextual: 30-40%
- Generic ("learn more"): < 5%
- No exact anchor text used > 3 times for the same target URL
- Anchor text length: 2-5 words for optimal effectiveness

**Threshold:** Distribution within target ranges (+/- 5%). Zero instances of exact anchor > 3 uses per target.

---

### EVAL-BCE2-048c: Dynamic Section Count Variation

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-048c |
| **Category** | Content Architecture |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Section counts must vary across pages and sites to avoid programmatic sameness. Not every location page should have exactly the same number of sections in the same order.

**Input:** Page blueprints for 10+ location pages across 2+ sites.

**Expected Outcome:**
- Section counts vary across location pages (not all identical)
- Section ordering varies where content requirements allow
- Different sites produce different section counts for the same page type
- The variation is meaningful (driven by content needs), not random padding

**Threshold:** Standard deviation of section count > 0 across 10+ location pages. At least 2 distinct section orderings observed.

---

## 12. Eval Cases — Freshness

### EVAL-BCE2-049: Stale Content Detection

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-049 |
| **Category** | Freshness |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** The system must correctly classify content freshness based on `last_deployed_at` timestamps and surface alerts for stale content.

**Input:** Pages with various `last_deployed_at` values: 4 weeks ago, 7 weeks ago, 11 weeks ago, NULL.

**Expected Outcome:**
- 4 weeks ago → "fresh" status
- 7 weeks ago → "aging" status (warning)
- 11 weeks ago → "stale" status (alert)
- NULL → "unknown" status
- Aging and stale pages surfaced in dashboard alerts
- `next_review_due` computed correctly from `last_deployed_at`

**Threshold:** 100% correct status classification. Alerts surfaced for all aging/stale pages.

---

### EVAL-BCE2-050: Freshness Alert Includes Actionable Recommendations

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-050 |
| **Category** | Freshness |
| **Priority** | P1 |
| **Scorer** | AI-Rubric |

**Description:** Freshness alerts must not just flag stale pages — they must include actionable recommendations for what to update (based on GEO research: content < 13 weeks old is cited 50% more).

**Input:** A page flagged as "stale" (deployed > 10 weeks ago).

**Expected Outcome:**
- Alert identifies the specific page and its freshness status
- Recommendations include: update the "last updated" date, refresh statistics with current data, review FAQ for relevance, check for outdated references
- Recommendations are page-type-specific (location page recommendations differ from service page)
- Alert includes priority level based on page importance (homepage > service > location)

**Threshold:** Every stale alert includes >= 2 actionable recommendations. AI-rubric >= 7/10 on recommendation specificity.

---

## 13. Eval Cases — Cross-Cutting / Edge Cases

### EVAL-BCE2-051: Single-Site Pipeline End-to-End

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-051 |
| **Category** | Cross-Cutting |
| **Priority** | P0 |
| **Scorer** | Human-Aligned |

**Description:** A complete end-to-end test: take one site from Stage 1 through Stage 5, producing at least 3 approved pages (homepage + 1 service + 1 location). Verifies the full pipeline works in sequence.

**Input:** One BookingTimes driving school site URL.

**Expected Outcome:**
- Stage 1: Site audit completes, brand profile inferred, user confirms
- Stage 2: Benchmark established (may already be global from prior run)
- Stage 3: Gap analysis produces prioritized backlog with link graph
- Stage 4: Page blueprints with section specs for top-3 priority pages
- Stage 5: Sections generated, reviewed, approved; pages exported
- All Scribe checkpoints fire at stage transitions
- Exported HTML is paste-ready and passes all validation checks

**Threshold:** All 5 stages complete without errors. 3 pages exported and pass EVAL-BCE2-017, 018, 022, 032, 043 checks.

---

### EVAL-BCE2-052: Multi-Site Isolation

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-052 |
| **Category** | Cross-Cutting |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** Data for different sites must be completely isolated. Brand voice, CSS, feedback, link graphs, and generated content for Site A must never leak into Site B.

**Input:** Two sites (A and B) both with brand profiles, feedback, and generated content.

**Expected Outcome:**
- Site A's brand profile is never used when generating for Site B
- Site A's custom CSS classes never appear in Site B's exports
- Site A's feedback rules (brand_rules with site_id = A) are not included in Site B's generation prompts
- Site A's brand examples are not used as few-shot for Site B
- Link graphs are per-site (Site A's links don't reference Site B pages)
- Exception: Stage 2 benchmark data is correctly shared (no site_id) but applied per-site

**Threshold:** Zero cross-site data leakage. All per-site tables correctly filtered by site_id.

---

### EVAL-BCE2-053: Homepage-First Ordering

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-053 |
| **Category** | Cross-Cutting |
| **Priority** | P0 |
| **Scorer** | Algorithmic |

**Description:** The homepage must always be the first page generated per site (DEC-031). The system must not allow generating a service or location page before the homepage is approved for that site.

**Input:** Attempt to generate a location page before the homepage is approved.

**Expected Outcome:**
- System rejects or deprioritizes generation of non-homepage pages before homepage approval
- Homepage is always first in the work backlog per site
- Once homepage is approved, service pages are next, then location pages
- The hierarchy (homepage → services → locations → long-tail) is enforced in generation ordering

**Threshold:** 100% enforcement of homepage-first rule. Zero pages generated out of hierarchy order.

---

### EVAL-BCE2-054: Sidebar-Aware Layout for Long-Tail Pages

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-054 |
| **Category** | Cross-Cutting |
| **Priority** | P1 |
| **Scorer** | AI-Rubric |

**Description:** Long-tail pages (location pages) have a fixed platform sidebar. Generated content must account for the sidebar — content layout must work alongside it, and CSS may adjust sidebar positioning but cannot remove it.

**Input:** Generated HTML for a location page + site's sidebar dimensions.

**Expected Outcome:**
- Content layout uses Bootstrap grid that accommodates the sidebar
- No content overlaps with the sidebar area
- CSS adjustments (if any) for sidebar positioning are documented in Tier 3 CSS
- Homepage and service page layouts correctly use full viewport width (no sidebar constraint)
- The same page renders correctly whether sidebar is present or not (resilient layout)

**Threshold:** AI-rubric >= 7/10 on layout quality with sidebar. Zero content-sidebar overlaps. Correct layout differentiation between page types.

---

### EVAL-BCE2-055: Concurrent Stage Progression for Multiple Sites

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-055 |
| **Category** | Cross-Cutting |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** Multiple sites can progress through stages independently. Site A at Stage 5 while Site B is still at Stage 1. The system must track per-site state correctly.

**Input:** Advance Site A to Stage 3, Site B to Stage 1, Site C not started.

**Expected Outcome:**
- `sites.pipeline_stage` shows different values for each site
- Operations on Site A (Stage 3 gap analysis) do not affect Site B's state
- Stage 2 (global) is marked complete once, shared by all sites
- UI correctly displays per-site pipeline status
- Scribe checkpoints are per-site (Site A's checkpoint doesn't mention Site B)

**Threshold:** Per-site state tracking is correct for all 5 sites at different stages simultaneously.

---

### EVAL-BCE2-056: Session Resumption After Interruption

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-056 |
| **Category** | Cross-Cutting |
| **Priority** | P1 |
| **Scorer** | Algorithmic |

**Description:** If the tool is closed mid-pipeline (e.g., during Stage 5 generation after 4 of 8 sections), reopening the tool must allow resumption from exactly where it left off, not from scratch.

**Input:** Generate 4 of 8 sections for a page, close the tool, reopen.

**Expected Outcome:**
- Previously generated sections are preserved in the database (`section_specs.generated_html`)
- The system identifies that 4 sections are complete and 4 are pending
- Generation can resume from section 5 without regenerating sections 1-4
- Context assembly for section 5 includes sections 1-4 (Layer 9) from the database
- The page blueprint and all specifications are intact

**Threshold:** Zero data loss on interruption. Correct identification of resume point. Sections 1-4 not regenerated.

---

### EVAL-BCE2-057: Low-Content Site Brand Inference

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-057 |
| **Category** | Cross-Cutting |
| **Priority** | P2 |
| **Scorer** | AI-Rubric |

**Description:** When a site has very little content (< 5 pages, < 500 words per page), the brand inference must produce a low-confidence profile and flag it for extra operator input rather than confidently guessing.

**Input:** A site with 3 pages, each under 300 words.

**Expected Outcome:**
- Brand profile is created with `inference_confidence < 0.5`
- System surfaces a warning: "Low content volume — brand inference may be unreliable"
- Operator is prompted to review and supplement the inferred profile with more detail
- The system does not refuse to proceed — it works with what it has but flags uncertainty
- Subsequent feedback enrichment raises confidence as pages are approved

**Threshold:** `inference_confidence` correctly reflects content volume. Warning surfaced for low-content sites.

---

### EVAL-BCE2-058: Platform Update Resilience

| Attribute | Value |
|---|---|
| **ID** | EVAL-BCE2-058 |
| **Category** | Cross-Cutting |
| **Priority** | P2 |
| **Scorer** | Algorithmic |

**Description:** If the BookingTimes platform updates its CSS (minor version bump or class changes), the system must detect the difference via re-scrape and update its catalogue without breaking existing generated content.

**Input:** Two CSS scrapes: before and after a simulated platform CSS change (3 classes renamed, 2 added, 1 removed).

**Expected Outcome:**
- Re-scrape detects the changes and produces an updated catalogue
- Diff report identifies added, removed, and changed classes
- Previously generated content that uses removed classes is flagged for review
- New classes are available for future generation
- Existing approved content is not silently broken — the system alerts about deprecated classes

**Threshold:** 100% of CSS changes detected. Deprecated class usage flagged in existing content.

---

## 14. V1 Eval Cases — Disposition

The V1 eval spec (EVL-bookingtimes-content-emulator-001) contained 32 cases. Their disposition in V2:

| V1 Category | V1 Cases | V2 Disposition |
|---|---|---|
| CSS Scraping (001-004) | 4 | **Carried forward** as EVAL-BCE2-001 (expanded to include tier classification) and EVAL-BCE2-058 (resilience). V1's property extraction and cross-site overlap are subsumed by the three-tier analysis. |
| Export HTML Validation (005-008) | 4 | **Carried forward** as EVAL-BCE2-017, 018, 045, 046. V2 adds JSON-LD and multi-artifact concerns. V1's "zero unknown classes" concept expanded to three-tier validation. |
| Preview Fidelity (009-012) | 4 | **Partially dropped.** V2.1 still has an iframe preview, but SSIM-based pixel comparison is deprioritized. V2 focuses on paste-readiness (EVAL-BCE2-046) rather than preview-to-live pixel matching. |
| Batch Generation (013-016) | 4 | **Reframed.** V2.1 does not use template-based batch generation. Section-based generation replaces it. Placeholder token check carried forward in EVAL-BCE2-017. Suburb-specific data accuracy is covered by EVAL-BCE2-025 (uniqueness). |
| Template System (017-020) | 4 | **Dropped.** V2.1 does not use templates. Section-based generation with dynamic blueprints replaces the template system entirely. |
| AI Content Generation (021-024) | 4 | **Evolved.** V1's basic AI quality checks are replaced by the comprehensive content quality, SEO, GEO, and brand voice eval cases in V2. |
| Version History (025-028) | 4 | **Subsumed.** Version tracking is covered by database schema integrity (EVAL-BCE2-003) and session resumption (EVAL-BCE2-056). Brand profile history covered by EVAL-BCE2-041. |
| Edge Cases (029-032) | 4 | **Partially carried forward.** Platform update resilience (EVAL-BCE2-058) and multi-site isolation (EVAL-BCE2-052) cover the most important edge cases. |

---

## 15. Automation Strategy

| Scorer Type | Case Count | Automation Approach |
|---|---|---|
| **Algorithmic** | 34 | Fully automated test suite. Run on every build. CI-integrated. |
| **AI-Rubric** | 11 | LLM judge with structured rubrics. Run on demand (per-page generation). Rubrics documented as prompts with scoring criteria. |
| **Human-Aligned** | 7 | Requires human ground truth or manual testing. Run periodically (per-site pilot, WYSIWYG paste tests). Results recorded in database for trend tracking. |

**Recommended execution order:**
1. Algorithmic P0 cases first (infrastructure, HTML validity, schema) — these are build gates
2. AI-Rubric P0 cases next (brand voice, content quality) — these validate generation quality
3. Human-Aligned cases during pilot site testing — these validate real-world paste and review workflow
4. P1 and P2 cases added as the system matures past cold start

---

## 16. Open Evaluation Questions

| # | Question | Impact on Eval |
|---|---|---|
| EQ-1 | What is the concrete threshold for "minimal edits" (OQ-3 from problem def)? | EVAL-BCE2-021 currently uses a trend-based threshold. A fixed numeric threshold (e.g., < 15% edit rate at maturity) would strengthen the eval. |
| EQ-2 | How will WYSIWYG paste behavior be systematically tested? | EVAL-BCE2-046 requires manual testing. A repeatable test protocol (specific HTML patterns to paste, specific attributes to verify) should be defined during pilot. |
| EQ-3 | Can edit distance be measured automatically? | If the tool tracks both generated and approved HTML, Levenshtein or diff-based metrics can be computed algorithmically. This would upgrade EVAL-BCE2-021 from human-aligned to algorithmic. |
| EQ-4 | How will engagement metrics (SC-5) be measured? | EVAL-BCE2-035-038 cover JS quality, not engagement impact. Engagement measurement requires analytics integration (click tracking, time-on-page) which is outside the current tool scope. |
