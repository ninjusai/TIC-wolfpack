---
title: "Design V2.1: Infer-First Brand Intelligence Pipeline"
version: "1.0.0"
status: final
created: "2026-04-02"
revised: "2026-04-02"
author: architect
project: bookingtimes-content-emulator
type: design-thinking-document
supersedes: design-v2.md
revision-note: "Final revision. All open questions resolved. Scribe checkpoints added. Platform constraints documented. GSC integration point defined. Section count made dynamic."
---

# Design V2.1: Infer-First Brand Intelligence Pipeline

## 0. What Changed From V2 (and from the initial V2.1 draft)

V2 proposed a "Brand Knowledge Amplifier" where users manually fill in brand profiles and the system learns incrementally through feedback. V2.1 reframes the entire approach. This revision consolidates the initial V2.1 draft with three major new inputs: Scout's SEO/GEO/schema research, Scout's siloing/linking research, and human feedback on multi-agent auditing and section-based generation.

| V2 / Initial V2.1 Assumption | Consolidated V2.1 Reality |
|---|---|
| Brand profiles are **manually authored** | Brand profiles are **inferred from existing content** |
| Content generation starts immediately | **Multi-agent audit, research, and gap analysis** happen first |
| Stage 1 is passive scraping | Stage 1 is an **active multi-agent site audit** by SEO, GEO, Schema, Pixel, and Content specialists |
| One Claude call per page | **Section-based generation** with cascading rules and per-section calls |
| SEO/GEO/schema are afterthoughts | SEO, GEO, schema, siloing, internal linking are **first-class architectural concerns** backed by specialist agents |
| CSS analysis: "what classes exist?" | CSS analysis: **three tiers** (Bootstrap base vs. site custom vs. new custom) |
| Individual page focus | **Site-wide content architecture** planned before any page is generated |
| `DrivingSchool` schema type | **`AutomotiveBusiness`** (DrivingSchool does not exist in schema.org) |
| Link structure as afterthought | **Link graph built BEFORE content generation**; anchor text rotation mandatory |
| Generic content per suburb | **40-50% unique content** per suburb page; direct answer blocks; FAQ schema everywhere |
| Fixed section counts per page type | **Dynamic section count** per page AND per site, determined by page type, brand, and content requirements |
| Unknown deployment mechanism | **Code view paste** in WYSIWYG confirmed; sidebars are fixed platform elements |
| Standalone content tool | **One component of a larger platform** (unified comms, email, GSC consolidation, cross-site insights) |

The core reframe: V2 treated content generation as the starting point. V2.1 treats **understanding what exists and what should exist** as the starting point. Generation is Stage 5 of 5, and it happens section-by-section with specialist agent validation.

---

## 1. Platform Context & Constraints

### 1.1 Larger Platform Vision

This content tool is ONE PART of a larger unified platform:
- **Unified communications** -- manage all email accounts across all sites in one place
- **Search console data consolidation** -- cross-site GSC performance data in a single view
- **Content management** -- what this document designs

Design decisions must not block future integration. Specifically:
- Data models should use site_id foreign keys consistently so cross-site queries are natural
- GSC integration points should be designed as interfaces that a larger system can consume
- APIs and data formats should be consistent across modules

We do NOT over-engineer for the larger platform now. We design clean boundaries and avoid decisions that would require painful refactoring later.

### 1.2 SaaS Platform Constraints (BookingTimes.com)

All 5 sites run on the same SaaS platform. These constraints are non-negotiable and every agent in the pipeline must understand them:

| Constraint | Detail | Impact |
|---|---|---|
| **Deployment mechanism** | Code view paste in WYSIWYG editor. Switch to code view, paste HTML directly. | All generated HTML must be paste-ready. No build steps, no compilation. |
| **Sidebars are fixed** | Platform-controlled elements. Cannot be removed or directly modified. | CSS can adjust sidebar positioning to some extent. Page layouts must account for sidebar presence. Agents must design content areas that work alongside fixed sidebars. |
| **URL patterns are platform-enforced** | Limited control over URL structure. Sitemap is the source of truth for what patterns are allowed. | URL strategy works within detected patterns from sitemap. No custom URL rewrites. |
| **SaaS updates are global** | Platform updates affect all 5 sites simultaneously. | Track platform documentation. Design CSS and HTML that is resilient to minor platform changes. This is a dependency to monitor, not a blocker. |
| **Body-only HTML** | Generated content goes into the page body via WYSIWYG. No access to `<head>`. | JSON-LD goes in body (Google supports this). No custom `<head>` tags. CSS must be in existing stylesheets or inline. |
| **Custom CSS files exist** | The existing CSS scraper already captures custom CSS files from each site. | The task is IDENTIFYING which scraped file is the custom one (vs. Bootstrap/platform CSS) and CLASSIFYING its contents. The system CAN add to custom CSS files -- not limited to what currently exists. |

### 1.3 Scribe Checkpoints

Every stage transition in the pipeline requires a **Scribe checkpoint** -- a mandatory documentation event before proceeding to the next stage.

**Scribe checkpoint protocol:**
1. Scribe is spawned at each stage gate (after stage completion, before next stage begins)
2. Scribe documents:
   - What was produced in the completed stage (deliverables list)
   - Decisions made during the stage (with rationale)
   - Current state for the next session (if the session ends mid-pipeline)
   - Any issues or blockers encountered
3. Scribe updates: `CONTEXT.md`, `CHANGELOG.md`, `DECISIONS.md` as appropriate
4. The checkpoint is logged via `squad/log.py`

This ensures memory persistence between sessions. If a session ends mid-pipeline, the next session can resume from the last Scribe checkpoint without information loss.

---

## 2. The 5-Stage Pipeline

Every site goes through five stages. Each stage has defined inputs, outputs, agents, and gates. No stage can be skipped. Stages 1 and 2 can run in parallel (they are independent). Stage 3 requires both. Stages 4 and 5 are sequential.

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌───────────────────┐   ┌──────────────┐
│   STAGE 1    │   │     STAGE 2      │   │   STAGE 3    │   │     STAGE 4       │   │   STAGE 5    │
│ Site Audit & │   │ Research &       │   │ Gap Analysis │   │ Design &          │   │ Build &      │
│ Inventory    │──>│ Benchmark        │──>│              │──>│ Architecture      │──>│ Learn        │
│              │   │                  │   │ Audit vs.    │   │                   │   │              │
│ (per site)   │   │ (domain-wide,    │   │ Benchmark    │   │ (per page/gap)    │   │ (section-    │
│              │   │  shared across   │   │              │   │                   │   │  based,      │
│              │   │  all sites)      │   │ (per site)   │   │ (per site)        │   │  feedback    │
│              │   │                  │   │              │   │                   │   │  loop)       │
└──────┬───────┘   └────────┬─────────┘   └──────┬───────┘   └─────────┬─────────┘   └──────┬───────┘
       │                    │                     │                     │                     │
   [SCRIBE]             [SCRIBE]              [SCRIBE]             [SCRIBE]             [SCRIBE]
   checkpoint           checkpoint            checkpoint           checkpoint           checkpoint
       │                    │                     │                     │                     │
   Unified              Benchmark              Prioritized          Content plans          Generated
   Site Brief           Standard               Backlog              per section            pages +
   + Sitemap            + Page Taxonomy        (by hierarchy)       + CSS decisions        enriched
   Inventory            + Schema Reqs          + Link graph         + Schema specs         brand
                        + Silo Strategy                             + Silo map             profile
```

### Specialist Agents Across the Pipeline

| Agent | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
|-------|---------|---------|---------|---------|---------|
| **seo** | SEO audit (titles, metas, headers, canonicals, Core Web Vitals, internal links, E-E-A-T, content uniqueness) | Define SEO benchmark standards, title tag formulas, header hierarchy templates | Score SEO gaps per page, identify missing canonicals/metas | Set SEO requirements per section, meta tag drafts | Validate generated sections against SEO checklist |
| **geo** | GEO readiness audit (citation-worthiness, direct answer blocks, FAQ presence, statistics density, freshness) | Define GEO benchmark (TLDR-first, FAQ patterns, direct answer formats) | Score GEO readiness gaps, identify pages lacking citation-worthy content | Set GEO requirements per section (direct answer blocks, stat frequency) | Validate generated sections for AI citation readiness |
| **schema** | Schema audit (what exists, what's missing, what's broken, per page) | Define schema requirements per page type (AutomotiveBusiness, FAQPage, BreadcrumbList, etc.) | Score schema gaps, identify broken/missing structured data | Specify exact JSON-LD per page, @graph with @id references | Validate generated schema, run against Google Rich Results Test |
| **pixel** | Visual design audit (layout quality, CSS usage, Bootstrap vs custom, responsive behavior, accessibility) | Inform design quality benchmarks | Score design gaps per page | CSS decisions per section, design pattern selection | Validate visual quality of assembled pages |
| **content analysis** | Voice extraction, tone profiling, terminology patterns, content depth per page type | N/A (domain research is Scout's job) | Score voice consistency, content depth gaps | Set voice/tone requirements per section brief | Validate brand voice consistency in generated sections |

---

### Stage 1: Site Audit & Inventory

**Purpose:** Understand everything that currently exists on the site through specialist lenses. Build the brand profile by inference. Produce a unified site brief with specific, actionable findings. Establish complete inventory via sitemap crawl.

**Inputs:**
- Site URL (already in `sites` table)

**Process:**

#### 1.0 Sitemap-Based Inventory

Before specialist agents run, the system performs a **full sitemap crawl** to establish scope:

- Fetch and parse the sitemap (XML sitemap, sitemap index, or HTML sitemap)
- Record every URL found -- this is the complete inventory of pages that exist
- Detect URL patterns from the sitemap (the sitemap is the source of truth for what URL structures the platform enforces)
- Classify pages by detected patterns (e.g., `/areas/*` = location pages, service keywords in path = service pages)
- Count total pages per type -- this tells us the scale of work needed

This is an **inventory crawl, not a deep-research crawl**. We know what exists and how many pages need work. We do NOT deep-research every page upfront. The specialist agents below then audit a representative sample plus key pages (homepage, service pages, a few location pages) in depth.

The following agents run **in parallel**, each visiting the live site and assessing it through their specialist lens:

#### 1.1 SEO Agent Audit

The SEO agent visits key pages on the site and assesses:

- **Title tags:** Present? Unique? Follows keyword-first formula? Under 60 characters?
- **Meta descriptions:** Present? Unique? 150-160 characters? Includes CTA and location?
- **Header hierarchy:** One H1 per page? H1 contains primary keyword? No skipped levels?
- **Canonical tags:** Self-referencing canonicals on every page?
- **Mobile-first:** Touch targets 48x48px? Font 16px+? No horizontal scroll? Click-to-call?
- **Core Web Vitals:** LCP under 2.5s? INP under 200ms? CLS under 0.1?
- **Internal link structure:** How many internal links per page? Orphan pages? Link equity flow?
- **Content uniqueness:** Duplicate content across suburb pages? What percentage is unique per page?
- **E-E-A-T signals:** TMR accreditation displayed? Real instructor photos? Transparent pricing? Reviews? ABN?
- **Image optimization:** WebP format? Alt text descriptive? Lazy loading? srcset for responsive?

**Output:** SEO audit report with per-page gap scores and specific deficiencies.

Example finding: *"Your 12 suburb pages have identical title tags ('Driving Lessons | BrandName'), no meta descriptions, H1 tags that say 'Welcome', no self-referencing canonicals, and zero internal links to service pages. Average content uniqueness across suburb pages is 8%."*

#### 1.2 GEO Agent Audit

The GEO agent assesses each page for AI citation readiness:

- **Direct answer blocks:** Does any page contain a self-contained 40-60 word paragraph that directly answers a specific question?
- **TLDR-first content:** Do pages answer the primary query in the first 200 words, or do they bury the answer?
- **FAQ content:** Any Q&A sections? Are questions phrased how people ask AI assistants?
- **Statistics density:** Specific numbers, dates, prices, pass rates? Frequency per 200 words?
- **Freshness signals:** Last updated dates visible? Content less than 13 weeks old?
- **Named authorship:** Author bios present? Instructor names and qualifications shown?
- **Entity clarity:** Are relationships clear (this school -> these services -> these suburbs)?

**Output:** GEO readiness report with citation-worthiness scores per page.

Example finding: *"Zero pages have direct answer blocks. FAQ content exists only on the main FAQ page (3 questions, generic). No statistics anywhere. No freshness dates. No named authors. AI engines have nothing citation-worthy to extract."*

#### 1.3 Schema Agent Audit

The Schema agent inspects the structured data on every page:

- **What exists:** Which schema types are present? Valid JSON-LD? Any Microdata or RDFa?
- **What's missing:** Per page type, what schema SHOULD exist but doesn't?
- **What's broken:** Malformed JSON-LD? Required properties missing? Values that don't match page content?
- **Entity graph:** Is there an `@graph` with `@id` references linking entities? Or isolated, disconnected blocks?
- **`sameAs` disambiguation:** Are business entities linked to Google Maps, Facebook, Wikipedia?
- **BreadcrumbList:** Present on every page? Matches visible breadcrumbs?

**Output:** Schema audit with per-page recommendations and a site-wide entity graph assessment.

Example finding: *"Homepage has a LocalBusiness schema but uses the generic type instead of AutomotiveBusiness. Missing: telephone, geo, areaServed, aggregateRating, sameAs. No schema on any other page. No BreadcrumbList anywhere. No FAQPage schema despite having FAQ content."*

#### 1.4 Pixel Agent Audit (Visual/Design)

Pixel assesses the visual and technical design quality:

- **Layout patterns:** Grid usage, spacing consistency, visual hierarchy
- **Sidebar awareness:** Document fixed sidebar dimensions and behavior. Design content areas that work alongside them. Note what CSS adjustments (if any) can influence sidebar positioning.
- **CSS tier analysis:** Bootstrap classes used vs. available; custom CSS quality and purpose; redundant/conflicting styles; orphaned classes
- **Responsive behavior:** Works at mobile/tablet/desktop? Proper breakpoint usage?
- **Accessibility:** Color contrast, alt text, ARIA labels, keyboard navigation
- **Component usage:** Cards, lists, CTAs, buttons -- what's used well, what's underutilized?
- **Three-Tier CSS Classification:**
  - **Tier 1 (Bootstrap Base):** Which Bootstrap 5 classes are used? Usage frequency. These are the foundation -- never modify, always available.
  - **Tier 2 (Site Custom CSS):** Identify which scraped CSS file(s) are the site's custom stylesheets (vs. Bootstrap, platform CSS, third-party libraries). Classify custom classes by purpose: layout overrides, typography, color themes, component styles. Assess quality (well-structured vs. hacky vs. redundant vs. orphaned).
  - **Tier 3 (Potential New CSS):** Identified gaps -- populated later in Stage 4. Key capability: the system CAN add to existing custom CSS files, not just use what exists.

**Output:** Design audit + CSS tier analysis with quality scores.

#### 1.5 Content Analysis

Content analysis extracts the brand voice and content patterns:

- **Voice description:** Friendly/formal? Conversational/technical? Direct/indirect?
- **Tone keywords:** e.g., ["warm", "encouraging", "local"]
- **Terminology patterns:** e.g., "uses 'learner driver' not 'student driver'"
- **Sentence structure:** Short/long? Active/passive? Direct address?
- **Recurring phrases:** e.g., "book your lesson today", "experienced instructors"
- **Anti-patterns:** What the brand does NOT do
- **Content depth per page type:** Word counts, section coverage, CTA presence, image usage

**Output:** Brand profile baseline (auto-populated, pending user confirmation).

#### 1.6 Unified Site Brief

All five agent outputs converge into a **unified site brief** -- a single document per site that consolidates:

1. What exists (inventory of pages from sitemap, content, CSS, schema, links)
2. What's good (strengths to preserve and amplify)
3. What's bad (specific deficiencies with scores)
4. What's missing (gaps identified by each specialist)
5. Sitemap inventory summary (total pages, pages per type, URL patterns detected)

The site brief is structured, not narrative. It is the foundation for gap analysis in Stage 3.

**Gate:** The unified site brief is reviewed by the user. They confirm, adjust, or override the inferred voice profile. The system may have gotten things wrong -- the user corrects. This is the one manual step in Stage 1.

**Scribe Checkpoint:** After gate approval, Scribe documents: sitemap inventory results, audit findings summary, brand profile confidence level, user overrides applied.

**Outputs:**
- Unified site brief (all agent audit reports consolidated)
- Sitemap inventory (complete page list with URL pattern classifications)
- Populated `brand_profiles` record (auto-filled, user-reviewed)
- `site_structure_map` records (all existing pages and their relationships)
- `css_audit` records (three-tier classification with custom CSS file identification)
- `content_audit` records (per-page content analysis with SEO/GEO/schema scores)
- `internal_link_graph` records (existing link relationships)
- `schema_audit` records (per-page structured data assessment)
- Initial `brand_rules` with source = 'inferred' (pending user confirmation)

---

### Stage 2: Research & Benchmark

**Purpose:** Establish what a driving school website SHOULD look like. This is domain-level research, not site-specific. It applies across all 5 sites. Scout's completed research populates this stage directly.

**Inputs:**
- Domain: "driving school website in Queensland, Australia"
- Scout's SEO/GEO/schema research (complete)
- Scout's siloing/linking research (complete)

**Agents involved:** seo, geo, schema (translate Scout's research into actionable benchmark standards)

**Process:**

#### 2.1 Page Taxonomy

Based on Scout's Two-Page Model research, the recommended page taxonomy is:

**Service Pages (3-6, content-heavy):**
- `/manual-driving-lessons/` (root-level for maximum authority)
- `/automatic-driving-lessons/`
- `/driving-test-preparation/`
- `/learner-licence-preparation/`
- `/defensive-driving/`
- `/keys2drive-free-lesson/` (if applicable)

**Location Pages (50+, lean/conversion-focused):**
- URL pattern as detected from sitemap (e.g., `/areas/[suburb-slug]/`)
- No service x location matrix -- each location page covers ALL services offered in that area on one page

**Supporting Content:**
- `/resources/[topic-slug]/` (guides, tips, blog)

**Core Pages:**
- `/about/`, `/contact/`, `/pricing/`, `/book-now/`

**Standard Hierarchy:** Homepage -> Services/Products -> Long tail, with siloed structure.

**URL Rules:** Detected from sitemap. Work within platform-enforced patterns. All lowercase, hyphen-separated where possible. The sitemap is the source of truth -- limited control over URL structure on this SaaS platform.

#### 2.2 SEO Benchmark Standards

From Scout's research, codified as actionable rules:

**Title Tag Formulas:**
- Service pages: `[Service] in [Location] | [Brand Name] - [Differentiator]`
- Location pages: `Driving Lessons in [Suburb], [Region] | [Brand Name]`
- Under 60 characters. Primary keyword first. Every page unique.

**Meta Descriptions:** 150-160 characters. CTA + USP + location. Every page unique.

**Header Hierarchy Templates:**
- Service pages: H1 (service + location) > H2 (What You'll Learn, Who This Is For, How It Works, Pricing, Why Choose Us, FAQ, CTA) > H3 (sub-items)
- Location pages: H1 (Driving Lessons in [Suburb]) > H2 (About Our Service, Services Available, Local Instructors, Driving Routes, Getting Your Licence, FAQ, CTA) > H3 (per-service, per-question)
- One H1 per page. Never skip levels. Descriptive, not generic.

**Content Uniqueness:** 40-50% unique content per suburb page. Unique content sources:
- Local landmarks and suburb character (150+ words)
- Local driving conditions (specific roads, roundabouts, school zones, hills)
- Nearest TMR office, common test routes
- Local testimonials from students in that suburb
- Instructor bio tie-in (which instructor covers this suburb)
- Suburb-specific FAQ

**Canonical Tags:** Self-referencing canonical on every page. Never canonicalize suburb pages to a master page.

**E-E-A-T Requirements for Driving Schools:**
- Experience: Real instructor photos, TMR accreditation numbers, specific student testimonials, actual vehicle photos, years of experience
- Expertise: Educational content (QLD licensing system, logbook hours), instructor qualifications (Cert IV Transport & Logistics)
- Authoritativeness: NAP consistency, industry memberships, community partnerships
- Trustworthiness: Transparent pricing, cancellation policies, SSL, physical address, ABN, Google reviews, multiple contact methods

**Image Optimization:** WebP format, descriptive alt text with keywords, srcset for responsive, lazy-load below fold, largest image under 200KB, width/height attributes for CLS prevention.

**Mobile-First:** Touch targets 48x48px, font 16px+, no horizontal scroll, click-to-call, click-to-map.

#### 2.3 GEO Benchmark Standards

From Scout's research on Generative Engine Optimization:

**Key Statistics Driving the Benchmark:**
- AI-referred web sessions grew 527% YoY
- AI Overviews appear on ~40% of queries but only ~7% of local queries (early-mover opportunity)
- Content with statistics gets 30-40% higher AI visibility
- 50% of AI-cited content is < 13 weeks old
- Named authors with bios are cited 2.3x more
- Sites with schema are cited 3.2x more in AI Overviews

**Required GEO Patterns:**

1. **Direct Answer Blocks (40-60 words):** Every page must contain at least one self-contained paragraph that directly answers a specific question. These function as pre-formed answer snippets AI engines can extract verbatim.

2. **TLDR-First Content:** The first 200 words of every page must directly and completely answer the primary query. No building up to the answer.

3. **FAQ Content with Schema:** Every service page and every suburb page must include 3-5 Q&A pairs using exact question formats people ask AI assistants, with complete factual answers referencing TMR/QLD Government.

4. **Statistics Every 150-200 Words:** Specific numbers throughout content -- prices, pass rates, hours required, students taught, years operating, suburbs served.

5. **Freshness:** Content must display last-updated dates. Target: update quarterly at minimum.

6. **Named Authorship:** Instructor bios on relevant pages. Author attribution on resource content.

**Platform-Specific Optimization:**
- Google AI Overviews: Schema markup heavily weighted. Favors pages already ranking well.
- Perplexity: Real-time crawling. Prioritizes recency and factual density.
- ChatGPT: Uses Bing index. Prioritizes authoritative domains and clear factual content.
- General: Be indexed by both Google and Bing. Keep content fresh. Structured data consistently.

#### 2.4 Schema Benchmark Standards

From Scout's research on structured data for driving schools:

**Critical Finding:** `DrivingSchool` does not exist in schema.org. Use `AutomotiveBusiness` as primary type. Multi-typing allowed: `"@type": ["AutomotiveBusiness", "EducationalOrganization"]`.

**Default Pattern: `@graph` with `@id` References**

Every page uses a JSON-LD `@graph` block where entities reference each other via `@id`. This creates a connected entity graph that AI engines can traverse.

**Mandatory Baseline Per Page:**
- `Organization` (site-wide, referenced via `@id`)
- `WebSite` (site-wide, referenced via `@id`)
- `BreadcrumbList` (per page, matches visible breadcrumbs exactly)

**Per Page Type:**

| Page Type | Primary Schema | Additional Schema |
|---|---|---|
| Homepage | `AutomotiveBusiness` (full: address, geo, areaServed, offers, aggregateRating, sameAs) | `WebSite` with `SearchAction`, `BreadcrumbList` |
| Service Page | `Service` (with Offer, provider ref) | `FAQPage`, `BreadcrumbList` |
| Location/Suburb Page | `AutomotiveBusiness` (with areaServed for this suburb + adjacent, parentOrganization ref) | `FAQPage`, `BreadcrumbList` |
| About Page | `AboutPage`, `AutomotiveBusiness` ref | `BreadcrumbList` |
| Contact Page | `ContactPage`, `AutomotiveBusiness` with `contactPoint` | `BreadcrumbList` |
| FAQ Page | `FAQPage` | `BreadcrumbList` |
| Pricing Page | `Service` + `Offer` with `PriceSpecification` | `BreadcrumbList` |
| Resource/Blog | `Article` or `HowTo` | `BreadcrumbList` |

**Entity Disambiguation via `sameAs`:** Every business entity links to Google Maps, Facebook, Instagram, and Wikipedia (where applicable). This is the highest-value schema implementation for AI visibility.

**JSON-LD Placement:** Can go in `<body>` (important for bookingtimes.com WYSIWYG constraint). Place `<script type="application/ld+json">` blocks at end of page content. Multiple blocks per page are fine.

**FAQPage Schema Everywhere:** Even though Google restricted FAQ rich results to authoritative sites, FAQ schema remains critical because: (a) AI engines parse and cite Q&A content via schema, (b) Bing and other engines still show rich results, (c) Google may expand eligibility again, (d) sites with schema are cited 3.2x more in AI Overviews.

#### 2.5 Content Siloing & Internal Linking Strategy

From Scout's siloing/linking research:

**Architecture: Hybrid Two-Page Model**

Two page types form the backbone:
1. **Service Pages** (3-6, content-heavy): One comprehensive page per service. All customer questions answered. Topical authority lives here. Root-level URLs for maximum authority.
2. **Location Pages** (50+, lean/conversion-focused): One page per suburb. Covers ALL services offered in that area on one page. Optimized for "[service] + [location]" intent. Links to service pages for detail. Localized trust signals.

**No service x location matrix.** Location pages are comprehensive for their area.

**Why This Architecture:**
- One external link to a service page benefits ALL linked location pages
- Authority consolidates rather than fragments
- No content duplication
- Teaches search engines: brand -> service -> location

**Hub-and-Spoke Internal Linking:**
- Each service page is a hub linking to all location pages where that service is offered
- Each location page links back to all service pages
- Bidirectional link wheels create equity flow in both directions
- 3-10 contextual internal links per page (excluding nav/footer)

**Geographic Clustering:**
- Location pages link to 3-5 geographically adjacent suburbs only (not all 50+)
- Creates geographic clusters reinforcing local relevance
- Example: Springfield cluster = Springfield, Augustine Heights, Brookwater, Redbank Plains, Ripley

**Anchor Text Rotation (Mandatory):**

| Anchor Type | Target Distribution |
|-------------|-------------------|
| Exact match keyword | 10-20% |
| Partial match | 30-40% |
| Branded | 10-15% |
| Natural/contextual | 30-40% |
| Generic | < 5% |

Never use the same anchor text for every link to the same page. Maximum 3 uses of any exact anchor site-wide per target. Anchor text 2-5 words for optimal effectiveness.

**Cross-Site Linking (5 Driving School Sites):**
- Keep minimal and contextual (< 5 cross-site links per site)
- Use bookingtimes.com platform page as natural hub
- Only cross-link when genuine user value (geographic handoff)
- Each site builds authority independently
- No automated footer links between sites, no identical link patterns

**Build the Link Graph BEFORE Generating Content:**
- Define all pages in the link graph before any content generation
- Establish all relationships (service->location, location->adjacent, etc.)
- Generate anchor text bank per target page
- Validate: every page has 2+ planned incoming links
- Validate: no page more than 3 clicks from homepage

#### 2.6 Competitor Scraping (Optional Enhancement)

**Status:** In scope as an optional enhancement. Not a blocker for the initial pipeline.

**Purpose:** Scrape competitor driving school websites to make the benchmark more concrete and data-driven rather than purely research-based.

**What to capture:**
- Page structures and section patterns
- Content depth and word counts per page type
- Schema markup usage
- Internal linking patterns
- Design patterns and CSS sophistication
- Service offerings and pricing transparency

**When to run:** After initial benchmark is established from Scout's research. Competitor data refines the benchmark, not defines it.

**Ethics/Constraints:** Respect robots.txt. Do not copy content. Use for structural and strategic insight only.

**Gate:** The benchmark is reviewed by the user. They may adjust the page taxonomy, add/remove page types, or override recommendations.

**Scribe Checkpoint:** After gate approval, Scribe documents: benchmark standards adopted, page taxonomy finalized, silo strategy confirmed, any user overrides to Scout's research recommendations.

**Outputs:**
- `benchmark_standards` records (SEO rules, GEO patterns, schema requirements)
- `silo_definitions` records (topical groupings with linking rules)
- `page_taxonomy` records (hierarchy levels, required sections per type)
- Internal linking blueprint (rules, anchor text banks, link graph template)
- Schema templates (JSON-LD per page type with @graph/@id pattern)

---

### Stage 3: Gap Analysis

**Purpose:** Overlay the Audit (what exists) against the Benchmark (what should exist). The delta becomes the work backlog.

**Inputs:**
- Stage 1 outputs: unified site brief (all agent audits), sitemap inventory, brand profile, CSS audit, link graph
- Stage 2 outputs: benchmark standards, page taxonomy, silo definitions, schema templates
- GSC traffic data (if available -- see Section 2.7)

**Agents involved:** seo (score SEO gaps), geo (score GEO gaps), schema (score schema gaps)

**Process:**

1. **Page Gap Identification**
   - For each page type in the benchmark taxonomy: does this site have it? (Cross-reference against sitemap inventory)
   - Status per page type:
     - **Missing** -- Page type does not exist. Needs creation.
     - **Weak** -- Page exists but fails multiple benchmark criteria.
     - **Adequate** -- Page meets minimum benchmark requirements.
     - **Strong** -- Page exceeds benchmark. Use as an exemplar.
   - For location pages: which suburbs are covered? Which are missing? (Sitemap inventory provides the complete list)

2. **Multi-Dimensional Quality Scoring**
   For each existing page, each specialist scores against their benchmark:
   - **SEO score** (seo agent): title, meta, headers, canonicals, keyword placement, internal links, E-E-A-T signals, image optimization, mobile-first
   - **GEO score** (geo agent): direct answer blocks, TLDR-first, FAQ content, statistics density, freshness, named authorship
   - **Schema score** (schema agent): correct types, required properties present, valid JSON-LD, @graph with @id, sameAs, BreadcrumbList matching visible breadcrumbs
   - **Design score** (pixel): layout quality, CSS usage, responsive behavior, accessibility
   - **Voice score** (content analysis): consistency with inferred brand profile, content depth
   - **Overall score:** Weighted composite

3. **CSS Gap Assessment**
   - Design patterns the benchmark suggests that current CSS cannot support
   - Underutilized Bootstrap components
   - Broken or redundant custom styles
   - New custom CSS candidates for page types the site lacks
   - Assessment of what can be added to existing custom CSS files (Tier 3 opportunities)

4. **Link Graph Construction**
   - Map existing pages into the silo structure from Stage 2
   - Identify silo gaps (e.g., "Resources silo has no pages")
   - Identify orphan pages (pages with < 2 incoming links)
   - Plan the full link graph: existing pages + planned pages + all relationships
   - Generate anchor text banks for every planned target page
   - Validate: every planned page has 2+ incoming links, max 3 clicks from homepage

5. **Backlog Prioritization**
   Priority is driven by page hierarchy:
   1. Homepage (if missing or weak) -- always first
   2. Core service pages (Level 1) -- define the brand, build authority
   3. Hub pages ("Areas We Serve") -- structural prerequisite for location pages
   4. Location pages (Level 3) -- the volume play, only after hierarchy is set
   5. Long-tail content (Level 4) -- benefits most from accumulated learning

   Within a level, priority is driven by: Missing > Weak > Adequate (don't touch Strong), then by **GSC traffic data** (if available: prioritize pages with high impressions but low CTR, or high-traffic suburbs), then by silo completion.

**Gate:** The user reviews and approves the backlog. They may reprioritize, remove items, or add items. This sets the work order for Stage 5.

**Scribe Checkpoint:** After gate approval, Scribe documents: gap analysis summary per site, backlog size and priority distribution, link graph statistics (total pages, total planned edges, orphan count), GSC data integration results (if applicable).

**Outputs:**
- `gap_analysis` records (per page: status, multi-dimensional scores, deficiencies)
- `work_backlog` records (prioritized list of pages to create/improve)
- Complete link graph (existing + planned pages + all edges + anchor text banks)
- Silo map with existing and planned pages

---

### Stage 4: Design & Architecture

**Purpose:** For each item in the work backlog, define the content strategy, CSS approach, and technical requirements BEFORE generation. This is now section-level planning, not just page-level.

**Inputs:**
- Approved work backlog from Stage 3
- Brand profile from Stage 1
- Benchmark standards from Stage 2
- CSS audit from Stage 1
- Link graph and silo map from Stage 3

**Agents involved:** seo (SEO requirements per section), geo (GEO requirements per section), schema (JSON-LD spec per page), pixel (CSS decisions per section)

**Process:**

For each backlog item (processed in priority order):

#### 4.1 Page Blueprint with Dynamic Section Count

Define the page as a sequence of sections, each with its own rules. **The number of sections is dynamic** -- determined per page AND per site based on:

- **Page type:** A homepage needs more sections than a location page. A service page may need a different count than a resource page.
- **Site brand:** Each site's brand personality may call for more or fewer content blocks. A premium brand might use fewer, more impactful sections. A community-focused brand might use more, varied sections.
- **Content requirements:** What needs to be covered on this specific page. A suburb with a TMR office needs a section about it. A suburb near a school zone needs driving conditions content. A page targeting competitive keywords needs more depth.
- **Avoiding programmatic sameness:** This is critical. If every location page across all 5 sites has exactly 6 sections in the same order, they look and feel templated. Dynamic section counts and ordering create genuine variety.

The system determines section count and composition during blueprinting, not from a fixed template.

```
Page Blueprint: [page_type] - [specific page]
├── Page-level rules
│   ├── SEO: title tag, meta description, canonical, header hierarchy
│   ├── GEO: TLDR-first in first 200 words, freshness date, named author
│   ├── Schema: JSON-LD spec (full @graph block)
│   ├── Linking: required outbound links, breadcrumb path, silo membership
│   ├── Voice: brand profile rules, terminology requirements
│   └── CSS: allowed tiers, design pattern selections, sidebar awareness
│
├── Section 1: [type, e.g., Hero]
│   ├── Inherits: all page-level rules
│   ├── Section rules: word count range, CTA requirements, heading (H1)
│   ├── Linking rules: which links must appear in this section
│   └── GEO rules: direct answer block required? statistics?
│
├── Section 2: [type, e.g., Services Overview]
│   ├── Inherits: all page-level rules
│   ├── Section rules: service list format, feature highlights, link targets
│   └── ...
│
├── Section N: [type -- count determined dynamically]
│   ├── Inherits: all page-level rules
│   ├── Section rules: specific to this section's purpose
│   └── ...
│
└── Assembly rules: coherence pass requirements, section flow validation
```

#### 4.2 Three-Tier Rule Cascade

Rules are resolved through a cascade before reaching any generation prompt:

1. **Global Rules** -- Apply to everything across all sites:
   - Brand voice anti-patterns
   - CSS constraints (body-only HTML, no bare selectors)
   - Platform constraints (bookingtimes.com WYSIWYG, sidebar limitations, code view paste)
   - Content quality minimums

2. **Page-Type Rules** -- Apply to all pages of this type:
   - All suburb pages need FAQPage schema
   - All service pages need pricing section
   - All pages need BreadcrumbList schema
   - Header hierarchy templates per page type

3. **Section Rules** -- Specific to this section type:
   - Hero: max 80 words, one H1, one primary CTA
   - FAQ: 3-5 questions, answers 40-80 words each, specific numbers required
   - Services Overview: link to each service page, use location-modified anchor text
   - Nearby Areas: 3-5 adjacent suburbs, varied anchor text

#### 4.3 Internal Linking Plan (Per Page)

Concrete link targets injected into generation prompts:

- Required outbound links (specific URLs, anchor text variants, placement section)
- Pages that should link TO this page (will need updating after generation)
- Breadcrumb path
- Silo membership and cross-silo link targets
- Anchor text selected from the rotation bank (respecting distribution targets)

#### 4.4 Schema Specification (Per Page)

Full JSON-LD specification using the @graph/@id pattern:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AutomotiveBusiness",
      "@id": "https://brand.bookingtimes.com/#organization",
      "name": "...",
      "sameAs": ["..."]
    },
    {
      "@type": "WebPage",
      "@id": "https://brand.bookingtimes.com/areas/springfield/#webpage",
      "isPartOf": { "@id": "https://brand.bookingtimes.com/#website" },
      "breadcrumb": { "@id": "https://brand.bookingtimes.com/areas/springfield/#breadcrumb" }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://brand.bookingtimes.com/areas/springfield/#breadcrumb",
      "itemListElement": [...]
    },
    {
      "@type": "FAQPage",
      "@id": "https://brand.bookingtimes.com/areas/springfield/#faq",
      "mainEntity": [...]
    }
  ]
}
```

#### 4.5 CSS Decision (Per Section)

For each section in the page blueprint:

- Can this section be built with Tier 1 (Bootstrap) + Tier 2 (existing custom)?
- If yes: specify which classes, which component patterns
- If no: define new Tier 3 CSS, draft rules, queue for user approval
- Tier 3 CSS is added to the site's existing custom CSS file(s) -- the system can extend these files, not just use what exists
- Design quality considerations: whitespace, typography hierarchy, responsive behavior, visual rhythm
- Sidebar awareness: content layout must account for fixed sidebar. CSS adjustments for sidebar positioning documented.

**Gate:** Page blueprints (with section breakdowns) are batch-reviewed by the user before generation begins. Easier to fix a blueprint than fix generated content.

**Scribe Checkpoint:** After gate approval, Scribe documents: blueprints produced (count per page type), section count ranges used, CSS tier decisions (how many Tier 3 additions proposed), schema patterns applied, link graph edge count.

**Outputs:**
- `page_blueprints` records (one per backlog item, with dynamic section breakdown)
- `section_specs` records (per section: rules, word count, linking, CSS)
- `link_plan` records (directed edges in the link graph with anchor text selections)
- `schema_specs` records (per page JSON-LD specification)
- `css_decisions` records (per section tier classification + any new CSS)
- Updated Tier 3 CSS (if any new custom styles needed, added to existing custom CSS files)

---

### Stage 5: Build & Learn

**Purpose:** Generate pages section-by-section in strict hierarchical order. Each approved page enriches the brand profile for subsequent pages.

**Inputs:**
- Page blueprints from Stage 4 (in priority order)
- Brand profile (evolving -- gets richer with each approval)
- CSS audit (all three tiers)
- Link plan, schema specs, anchor text banks

**Agents involved:** seo (validate per section), geo (validate per section), schema (validate assembled JSON-LD), pixel (validate visual quality)

**Process:**

#### 5.1 Section-Based Generation

**Why section-by-section:** Generating a whole page in one Claude call causes content drift. The model loses adherence to rules by the middle of a long generation. Section-based generation solves this:

```
Page Blueprint (from Stage 4)
├── Section 1: Hero
│   ├── Context: page-level rules + section-specific rules
│   ├── -> One Claude call -> validation -> review/approve
│   └── Output: approved section HTML
│
├── Section 2: Services Overview
│   ├── Context: page-level rules + section rules + Section 1 (for continuity)
│   ├── -> One Claude call -> validation -> review/approve
│   └── Output: approved section HTML
│
├── Section 3: Local Content
│   ├── Context: page-level rules + section rules + Sections 1-2 (for continuity)
│   ├── -> One Claude call -> validation -> review/approve
│   └── Output: approved section HTML
│
├── ... (remaining sections -- count determined dynamically per page)
│
└── Final Assembly
    ├── Stitch all approved sections
    ├── Coherence pass: do sections flow together? Transitions natural?
    ├── Link validation: all required links present? Anchor text correct?
    ├── Schema validation: JSON-LD valid? Matches page content?
    ├── SEO validation: title, meta, headers, keyword placement
    ├── GEO validation: direct answer block present? TLDR-first? Statistics density?
    └── Output: complete page ready for code-view paste into WYSIWYG
```

#### 5.2 Context Assembly (Per Section Call)

Each section generation call receives a focused prompt:

- **Layer 1:** Platform constraints (body-only HTML, no bare selectors, sidebar awareness, code view paste target)
- **Layer 2:** Brand profile (voice, tone, terminology)
- **Layer 3:** Brand rules (inferred + confirmed + feedback-derived), filtered to relevant scope
- **Layer 4:** Section specification (from blueprint: word count, CTA requirements, heading)
- **Layer 5:** Page-level context (SEO requirements, target keywords, page purpose)
- **Layer 6:** Internal linking targets for this section (specific URLs + anchor text)
- **Layer 7:** GEO requirements for this section (direct answer blocks, statistics)
- **Layer 8:** CSS class palette (tiered, filtered to relevant classes for this section type)
- **Layer 9:** Previously generated sections from this page (for continuity)
- **Layer 10:** Approved examples from previous pages of this type (few-shot)
- **Layer 11:** Suburb/location data (if applicable)
- **Layer 12:** Output format instructions

#### 5.3 Validation (Per Section + Assembled Page)

**Per Section:**
- CSS class validation (only classes from Tiers 1-3)
- HTML well-formedness
- Word count within range
- Required elements present (CTA, heading, links)
- Brand voice consistency check
- GEO requirements met (direct answer block present if required)

**Assembled Page (seo + geo + schema agents validate):**
- All required internal links present and correct
- Anchor text distribution matches targets
- Schema JSON-LD valid (run against validator)
- SEO checklist compliance (title, meta, headers, canonicals)
- GEO checklist compliance (TLDR-first, FAQ present, statistics density)
- Content brief compliance (all required sections, total word count)
- No orphan links (all targets exist in link graph)
- Code view paste readiness (HTML is self-contained, no external dependencies beyond existing CSS)

#### 5.4 Review & Approval

- User previews the assembled page in the iframe
- User can: Approve, Refine (specific sections), or Reject (regenerate sections)
- Individual sections can be regenerated without affecting others
- On Approve: page is saved, marked as approved, available as a future example
- On Refine: feedback captured, classified, relevant section regenerated
- On Reject: sections flagged with rejection reason, regenerated with guidance

#### 5.5 Learning Capture (The Feedback Loop)

On EVERY approval or refinement, the system captures learning:

**On Approval (Positive Signal):**

| What | Captured How | Where |
|---|---|---|
| Full approved HTML | Stored as `brand_example` | `brand_examples` table |
| Per-section approved HTML | Stored as section-level examples | `brand_examples` with section_type |
| Voice patterns that worked | Claude analyzes "what makes this on-brand?" | Reinforces `brand_rules` (confidence++) |
| CSS patterns used | Record which tiers/classes worked | `css_patterns` table |
| Content structure | Section types, ordering, word counts | Enriches page-type benchmarks |
| Internal links created | Actual link targets and anchor text | `internal_link_graph` table |

**On Refinement (Corrective Signal):**

| What | Captured How | Where |
|---|---|---|
| Feedback text | Stored verbatim | `ai_turns` table |
| Classified feedback | Voice, terminology, structure, CSS, SEO, GEO, one-time | `brand_rules` if brand-level, `page_type_rules` if type-level |
| Before/after diff | What changed per section | Informs anti-patterns (before) and preferences (after) |
| Rejection reason | Why the section was rejected | `brand_rules` as anti-pattern with high priority |

**Feedback Classification:**

```
                    ┌─────────────────────────────────┐
                    │          USER REVIEW             │
                    │  [Approve]  [Refine]  [Reject]   │
                    └──────┬────────┬────────┬─────────┘
                           │        │        │
                    ┌──────▼──┐  ┌──▼──────┐ │
                    │ POSITIVE│  │CORRECTIVE│ │
                    │ SIGNAL  │  │ SIGNAL   │ │
                    └────┬────┘  └────┬─────┘ │
                         │            │        │
              ┌──────────▼────────────▼────────▼──────────┐
              │         FEEDBACK CLASSIFIER                │
              │                                            │
              │  Categorize:                               │
              │  1. Voice/Tone       5. SEO/technical      │
              │  2. Terminology      6. GEO/citation       │
              │  3. Structure        7. Schema fix          │
              │  4. CSS/design       8. One-time edit       │
              │                                            │
              │  Scope:                                    │
              │  - Global (all sites, all pages)           │
              │  - Brand-level (all future brand content)  │
              │  - Page-type-level (all pages of this type)│
              │  - Section-type-level (all sections of     │
              │    this type across all pages)             │
              │  - One-time (this section only)            │
              └────────────────────────────────────────────┘
```

Phase 1 (MVP): Manual classification -- system asks user to pick scope.
Phase 2 (Later): AI-assisted -- system suggests classification, user confirms.

#### 5.6 Progressive Enrichment (The Compounding Effect)

```
Page #  | Brand Knowledge            | Expected Edit Effort
--------|----------------------------|-----------------------
   1    | Inferred profile only      | HIGH - system is learning
        |                            | (homepage is the hardest)
   2-4  | Profile + 1 approved page  | MEDIUM-HIGH - voice becoming
        | + section-level examples   | consistent
   5-8  | Profile + 4 pages + 15+   | MEDIUM - structure patterns
        | section examples + 10+    | emerging
        | rules                      |
  9-15  | Rich profile + 8 pages    | LOW-MEDIUM - system knows
        | + 30+ section examples    | the brand well
        | + 20+ rules               |
 16-50  | Mature profile + diverse  | LOW - batch-ready, minimal
        | examples + comprehensive  | corrections needed
        | rules                     |
```

**Page Generation Order (Enforced):**
```
1. Homepage
2. Core service pages (in order of business importance)
3. "Areas We Serve" hub page
4. Pricing / Packages page
5. About Us
6. Contact
7. FAQ
8. Top-priority suburb pages (nearest suburbs, highest traffic) -- 3-5 individually
9. Remaining suburb pages (batch-generated, leveraging accumulated learning)
10. Long-tail content (blog posts, guides, tips)
```

**Gate:** Each page must pass validation and user review before the next page in the hierarchy is generated. Batch generation (step 9) is unlocked only after 3-5 individual suburb pages have been approved.

**Scribe Checkpoint:** After each page approval (or batch of pages), Scribe documents: pages completed, brand profile evolution (new rules added, confidence changes), CSS patterns established, link graph progress (planned vs. actual edges).

**Outputs:**
- Generated pages (stored as `page_versions`)
- Per-section HTML (stored for reuse as examples)
- Enriched brand profile (updated after each approval)
- New brand rules (from feedback classification)
- New brand examples (from approved content)
- Updated internal link graph (actual links, not just planned)
- Valid JSON-LD per page (ready for deployment via code view paste)

---

## 3. The Self-Learning Mechanism

### How Learning Flows

The feedback loop is the same as described in the original V2.1 but now operates at the **section level** as well as the page level. When a user refines a specific section, the learning is scoped more precisely:

- A voice correction on a Hero section becomes a rule scoped to "hero sections for this brand"
- A structure correction on an FAQ section becomes a rule scoped to "FAQ sections"
- A terminology correction becomes a brand-level rule (applies everywhere)

This section-level scoping means the system learns faster and more precisely than whole-page feedback allows.

### The Compounding Effect

Top-down ordering matters even more with section-based generation. The homepage teaches the system what Hero sections, CTA sections, and content sections should look and sound like for this brand. Service pages teach Services Overview and FAQ sections. By the time suburb pages are generated, every section type has multiple approved examples.

---

## 4. Content Architecture (Top-Down)

### 4.1 Siloing Strategy

Content silos are not just an SEO technique -- they are a structural constraint on page generation order.

```
                            HOMEPAGE
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ SERVICES │    │LOCATIONS │    │ TRUST    │
        │ SILO     │    │ SILO     │    │ SILO     │
        ├──────────┤    ├──────────┤    ├──────────┤
        │ Manual   │    │ Areas We │    │ About Us │
        │ Lessons  │    │ Serve    │    │          │
        │ (hub)    │    │ (hub)    │    │ Testi-   │
        │          │    │          │    │ monials  │
        │ Auto     │    │ Suburb A │    │          │
        │ Lessons  │    │ Suburb B │    │ Contact  │
        │          │    │ Suburb C │    │          │
        │ Test     │    │ ...50+   │    │ FAQ      │
        │ Prep     │    │          │    │          │
        │          │    │          │    │ Resources│
        │ Pricing  │    │          │    │          │
        └──────────┘    └──────────┘    └──────────┘
```

**Generation rules:**
1. Generate the homepage first. Always.
2. Generate silo hub pages before silo child pages.
3. Within a silo, generate top-level pages before deep pages.
4. Cross-silo links are defined at the hub level and inherited by children.
5. A page cannot be generated until the pages it MUST link to already exist (at least as approved briefs with confirmed URLs).

### 4.2 Internal Linking as a Generation Constraint

The link graph is a first-class data structure, maintained across all stages:

```typescript
interface LinkGraph {
  pages: Map<string, PageNode>;
  edges: LinkEdge[];
}

interface PageNode {
  slug: string;
  type: 'homepage' | 'service' | 'location' | 'resource' | 'core';
  title: string;
  url: string;
  parentSlug: string | null;
  metadata: {
    suburb?: string;
    region?: string;
    service?: string;
    adjacentSuburbs?: string[];
    servicesOffered?: string[];
    locationsServed?: string[];
  };
}

interface LinkEdge {
  source: string;
  target: string;
  type: 'nav' | 'breadcrumb' | 'contextual' | 'hub-spoke' | 'sibling' | 'footer';
  anchorText: string;
  anchorVariant: 'exact' | 'partial' | 'branded' | 'natural' | 'generic';
  section: string;  // which section of the page this link belongs to
}
```

**Rule-Based Link Generation:**

```
Rule 1: Service -> Location links
  FOR each service_page:
    GET all location_pages WHERE service IN location.servicesOffered
    ADD "Available In These Areas" section with links

Rule 2: Location -> Service links
  FOR each location_page:
    GET all service_pages WHERE location.suburb IN service.locationsServed
    ADD "Our Services in [Suburb]" section with links

Rule 3: Location -> Adjacent Location links
  FOR each location_page:
    GET location_pages WHERE suburb IN location.adjacentSuburbs (limit 3-5)
    ADD "Nearby Areas" section with links

Rule 4: Contextual in-body links
  FOR each page body content:
    First mention of service -> link to service page
    First mention of suburb -> link to location page
    Ensure 3-10 contextual links total
    Rotate anchor text using bank

Rule 5: Orphan page prevention
  AFTER all pages generated:
    FOR each page: IF incoming_links < 2: FLAG and add links from parent
```

**Anchor Text Rotation System:**

```typescript
interface AnchorBank {
  targetSlug: string;
  variants: {
    exact: string[];      // ["manual driving lessons"]
    partial: string[];    // ["manual lesson packages", "learn manual driving"]
    branded: string[];    // ["[Brand] manual lessons"]
    natural: string[];    // ["learn to drive a manual car"]
    localized: string[];  // ["Springfield manual lessons"]
  };
  usageCount: Map<string, number>;
}
```

Select variant type based on distribution targets. Pick least-used specific anchor. Never use same exact anchor more than 3x site-wide per target.

**Regeneration Cascade:** Adding a new page triggers partial regeneration of related pages' link sections -- service pages update their "Available In" sections, adjacent suburb pages update their "Nearby Areas" sections.

### 4.3 Template-Based Linking Zones

Every page template has designated zones for internal links:

```
┌─────────────────────────────────────────┐
│ HEADER NAV                              │
│ [Home] [Services >] [Areas >] [Book]   │
├─────────────────────────────────────────┤
│ BREADCRUMB (with BreadcrumbList schema) │
│ Home > Service Areas > Springfield      │
├──────────────────────────┬──────────────┤
│ MAIN CONTENT AREA        │ SIDEBAR      │
│                          │ (FIXED -     │
│ HERO / H1 + Direct      │  platform    │
│ Answer Block (GEO)       │  controlled) │
│                          │              │
│ BODY CONTENT             │ CSS can      │
│ (contextual links woven  │ adjust       │
│ into copy)               │ positioning  │
│ [3-10 contextual links]  │ to some      │
│ [Stats every 150-200w]   │ extent       │
│                          │              │
│ SERVICES SECTION         │              │
│ (on location pages)      │              │
│ H2: "Driving Services    │              │
│ in [Suburb]"             │              │
│ [Links to service pages] │              │
│                          │              │
│ FAQ SECTION              │              │
│ (with FAQPage schema)    │              │
│ [3-5 Q&A, suburb-spec]   │              │
│                          │              │
│ NEARBY AREAS             │              │
│ (on location pages)      │              │
│ H2: "We Also Serve       │              │
│ These Areas"             │              │
│ [Links to 3-5 adjacent]  │              │
│                          │              │
│ CTA / BOOKING            │              │
├──────────────────────────┴──────────────┤
│ FOOTER                                  │
│ [Service links] [Key suburb links]      │
│ [Full area index link]                  │
└─────────────────────────────────────────┘
```

---

## 5. CSS Intelligence

### 5.1 Three-Tier Classification

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: Bootstrap Base                                      │
│                                                             │
│ Source: CDN (Bootstrap 5.3.3)                               │
│ Examples: container, row, col-*, btn, card, navbar          │
│ Policy: USE FREELY. Never modify. Always available.         │
│ Detection: Match against known Bootstrap class list         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TIER 2: Existing Site Custom CSS                            │
│                                                             │
│ Source: Site's own stylesheets (already captured by         │
│         existing CSS scraper)                               │
│ Identification: The scraper captures ALL CSS files. The     │
│         task is classifying which file(s) are custom CSS    │
│         vs. Bootstrap vs. platform CSS vs. third-party.     │
│ Classification approach:                                    │
│   - Bootstrap: matches known Bootstrap class/property       │
│     patterns, served from CDN or matches version hash       │
│   - Platform CSS: common across all 5 sites with identical  │
│     content, contains platform-specific selectors           │
│   - Third-party: matches known library patterns             │
│   - Custom: everything else = site-specific custom CSS      │
│ Policy: USE WHERE APPROPRIATE. Extend where needed.         │
│ Analysis: purpose, pages used, quality, conflicts           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TIER 3: New Custom CSS (System-Created)                     │
│                                                             │
│ Source: Created by the system or user                       │
│ Deployment: Added to the site's existing custom CSS         │
│             file(s). NOT limited to inline styles.          │
│ Capability: The system CAN extend the site's styling       │
│             beyond what currently exists.                   │
│ Policy: CREATE WHEN NEEDED. Must be justified and approved. │
│ Lifecycle: Stage 4 identifies need -> draft -> preview ->   │
│           approve -> add to custom CSS file -> use          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 CSS Decision Flow in Stage 4

For each section in a page blueprint:

```
Does this section need layout/components
beyond Tier 1 + Tier 2?
         │
    ┌────┴────┐
    No        Yes
    │         │
    ▼         ▼
Use Tier 1   Is there a close Tier 2 class?
+ Tier 2          │
only         ┌───┴───┐
              Yes     No
              │       │
              ▼       ▼
         Use it +   Create Tier 3 CSS
         note any   -> Draft -> Preview
         limits     -> User approves
                    -> Add to custom CSS file
```

### 5.3 Design Quality Through CSS

"Award-winning design" within Bootstrap + custom CSS means:
- Thoughtful whitespace (Bootstrap spacing utilities: py-5, my-4)
- Typography hierarchy (display-*, lead, text-muted + custom type scale)
- Component composition (cards, badges, buttons, alerts in cohesive layouts)
- Responsive behavior (proper breakpoint utilities, not just col-12)
- Visual rhythm (consistent section heights, alternating backgrounds)
- Color intention (brand colors purposeful, not decorative)
- Sidebar-aware layouts (content areas designed to work alongside fixed platform sidebar)

Approved design patterns are stored in `css_patterns` and become part of the generation prompt, giving Claude specific design recipes.

---

## 6. Quality & Design Standards

### 6.1 What "Award-Winning" Means Here

We are constrained: output goes into a WYSIWYG editor on bookingtimes.com via code view paste. Sidebars are fixed. "Award-winning" means:

1. **Visually polished within Bootstrap's grid.** Intentionally designed, not auto-generated. Account for sidebar presence.
2. **Content quality that exceeds the industry.** More specific, helpful, structured, and locally relevant than any competitor.
3. **SEO/GEO/schema that outperforms competitors.** Proper schema, strategic linking, optimized metas, direct answer blocks, FAQ everywhere. Most competitors do none of this.
4. **Consistent brand expression.** Every page feels like the same brand.
5. **Mobile-first responsiveness.** Phones are where driving school searches happen.
6. **Dynamic, non-templated feel.** Each site's pages feel unique because section counts and compositions vary per page and per site.

### 6.2 Design Quality Evaluation

Each generated page is scored by specialist agents:

| Dimension | Agent | What To Check |
|---|---|---|
| Layout | pixel | Grid usage, spacing, visual hierarchy, sidebar interaction |
| Typography | pixel | Heading hierarchy, line lengths, contrast |
| Components | pixel | Appropriate use of cards, lists, CTAs |
| Responsiveness | pixel | Mobile/tablet/desktop breakpoints |
| Brand Consistency | content analysis | Matches voice profile, uses approved patterns |
| Content Depth | content analysis | Word count, section coverage, specificity |
| SEO | seo | Title, meta, headers, links, canonicals, E-E-A-T |
| GEO | geo | Direct answer blocks, TLDR-first, FAQ, statistics, freshness |
| Schema | schema | Valid JSON-LD, correct types, @graph/@id, sameAs |

**Quality Gate:** A page must score above threshold on ALL dimensions. Below-threshold dimensions are flagged with specifics.

### 6.3 Design Quality Improvement Over Time

1. **Pattern accumulation.** Every approved section adds to the pattern library.
2. **Anti-pattern capture.** Rejected sections are analyzed and avoided.
3. **CSS confidence growth.** Early sections conservative, later ones more adventurous.
4. **Cross-site learning (design only, not voice).** Layout patterns are brand-agnostic and can transfer between sites. Voice never transfers.

---

## 7. GSC Integration Point

### 7.1 Purpose

Google Search Console data feeds into backlog prioritization (Stage 3) and content performance tracking (ongoing).

**Confirmed:** GSC access is available for all 5 sites.

### 7.2 Data Consumed

| GSC Data | Used In | How |
|---|---|---|
| Impressions per page | Stage 3 backlog prioritization | High impressions + low CTR = high-priority improvement target |
| Click-through rate per page | Stage 3 backlog prioritization | Low CTR pages need better titles/metas |
| Average position per page | Stage 3 gap scoring | Pages ranking 5-20 are "striking distance" improvement targets |
| Search queries per page | Stage 4 blueprinting | Informs target keywords and FAQ questions |
| Impressions by query | Stage 2 benchmark refinement | Reveals what people actually search for |
| Index coverage | Stage 1 audit | Confirms which pages Google has indexed |

### 7.3 Integration Design

**Current scope:** Pull GSC data to enrich prioritization and blueprinting. Simple, direct integration.

**Larger platform awareness:** This GSC integration will eventually feed into a cross-site performance dashboard. Design the integration point as a clean interface:

```typescript
interface GSCDataProvider {
  // Per-site data retrieval
  getPageMetrics(siteId: string, dateRange: DateRange): PageMetric[];
  getQueryMetrics(siteId: string, dateRange: DateRange): QueryMetric[];
  getIndexCoverage(siteId: string): IndexCoverage;

  // Cross-site aggregation (future -- interface defined now, implemented later)
  getAggregateMetrics(siteIds: string[], dateRange: DateRange): AggregateMetric[];
}

interface PageMetric {
  url: string;
  impressions: number;
  clicks: number;
  ctr: number;
  averagePosition: number;
  topQueries: string[];
}
```

Store GSC data in the existing SQLite database with `site_id` foreign keys. This ensures the larger platform can query across sites when the time comes.

### 7.4 GSC-Enhanced Backlog Prioritization

When GSC data is available, the Stage 3 prioritization formula becomes:

```
priority = hierarchy_weight * 0.4
         + gap_severity * 0.3
         + traffic_potential * 0.2
         + silo_completion * 0.1

where traffic_potential =
  - For existing pages: normalize(impressions * (1 - ctr))  // high impressions, low CTR = opportunity
  - For new pages: estimate from similar page types or query data
  - For "striking distance" pages (position 5-20): bonus multiplier
```

---

## 8. Updated Data Model

### 8.1 Revised Tables from V2

```sql
-- Brand profile: auto-populated from multi-agent audit, user-reviewed
CREATE TABLE brand_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL UNIQUE REFERENCES sites(id),
  -- Inferred fields (auto-populated by Stage 1 agents)
  voice_description TEXT,
  tone_keywords TEXT,                  -- JSON array
  terminology_patterns TEXT,           -- JSON array of {use: "X", avoid: "Y"}
  sentence_style TEXT,
  recurring_phrases TEXT,              -- JSON array
  anti_patterns TEXT,                  -- JSON array
  -- User-provided fields
  target_audience TEXT,
  key_differentiators TEXT,
  brand_personality TEXT,              -- 3-5 adjectives
  user_confirmed INTEGER DEFAULT 0,
  -- Metadata
  inference_confidence REAL,           -- 0.0-1.0
  source_page_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brand rules: now includes 'inferred' source + section-level scoping
CREATE TABLE brand_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),  -- NULL = global rule
  category TEXT NOT NULL CHECK (category IN (
    'voice', 'structure', 'terminology', 'seo', 'geo',
    'localization', 'visual', 'schema', 'linking', 'anti-pattern'
  )),
  rule_text TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN (
    'manual', 'feedback', 'inferred', 'research'
  )),
  scope TEXT NOT NULL DEFAULT 'brand' CHECK (scope IN (
    'global', 'brand', 'page_type', 'section_type', 'page'
  )),
  page_type TEXT,                        -- If scope = 'page_type'
  section_type TEXT,                     -- If scope = 'section_type'
  confidence REAL DEFAULT 1.0,
  confirmed INTEGER DEFAULT 0,
  source_session_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brand examples: now tracks section-level examples
CREATE TABLE brand_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  section_type TEXT,                     -- e.g., 'hero', 'faq', 'services_overview'
  page_type TEXT,                        -- e.g., 'homepage', 'suburb', 'service'
  html_content TEXT NOT NULL,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  is_negative INTEGER DEFAULT 0,
  notes TEXT,
  source TEXT CHECK (source IN (
    'existing_content', 'generated_approved', 'generated_rejected', 'manual'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 8.2 New Tables

```sql
-- Site structure map: all pages discovered on the site (populated from sitemap inventory)
CREATE TABLE site_structure_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  page_type TEXT,
  hierarchy_level INTEGER,              -- 0=home, 1=core, 2=secondary, 3=location, 4=long-tail
  word_count INTEGER,
  heading_structure TEXT,               -- JSON
  has_schema INTEGER DEFAULT 0,
  schema_types TEXT,                    -- JSON array
  has_canonical INTEGER DEFAULT 0,
  canonical_url TEXT,
  discovered_via TEXT DEFAULT 'sitemap' CHECK (discovered_via IN (
    'sitemap', 'crawl', 'manual'
  )),
  url_pattern TEXT,                     -- Detected URL pattern category
  status TEXT DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'audited', 'strong', 'adequate', 'weak', 'missing'
  )),
  last_scraped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Multi-dimensional content audit per page
CREATE TABLE content_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  structure_map_id INTEGER NOT NULL REFERENCES site_structure_map(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  -- Per-agent scores
  seo_score REAL,                       -- 0.0-1.0 (from seo agent)
  geo_score REAL,                       -- 0.0-1.0 (from geo agent)
  schema_score REAL,                    -- 0.0-1.0 (from schema agent)
  design_score REAL,                    -- 0.0-1.0 (from pixel)
  voice_score REAL,                     -- 0.0-1.0 (from content analysis)
  content_depth_score REAL,             -- 0.0-1.0
  overall_score REAL,                   -- Weighted composite
  -- Details
  seo_deficiencies TEXT,                -- JSON array (from seo agent)
  geo_deficiencies TEXT,                -- JSON array (from geo agent)
  schema_deficiencies TEXT,             -- JSON array (from schema agent)
  design_deficiencies TEXT,             -- JSON array (from pixel)
  voice_deficiencies TEXT,              -- JSON array
  extracted_content TEXT,               -- Full text content
  sections TEXT,                        -- JSON: [{type, word_count, heading}]
  ctas TEXT,                            -- JSON: [{text, placement, link_target}]
  has_direct_answer_block INTEGER DEFAULT 0,
  has_faq_content INTEGER DEFAULT 0,
  statistics_count INTEGER DEFAULT 0,
  freshness_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Schema audit: per-page structured data assessment
CREATE TABLE schema_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  structure_map_id INTEGER NOT NULL REFERENCES site_structure_map(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  schema_types_found TEXT,              -- JSON array of detected types
  schema_format TEXT,                   -- 'json-ld', 'microdata', 'rdfa', 'none'
  has_graph INTEGER DEFAULT 0,          -- Uses @graph pattern?
  has_id_references INTEGER DEFAULT 0,  -- Uses @id references?
  has_same_as INTEGER DEFAULT 0,        -- Has sameAs for disambiguation?
  has_breadcrumb INTEGER DEFAULT 0,
  has_faq_schema INTEGER DEFAULT 0,
  validation_errors TEXT,               -- JSON array of validation issues
  missing_types TEXT,                   -- JSON array of schema types that SHOULD be present
  missing_properties TEXT,              -- JSON array of required properties missing
  recommendations TEXT,                 -- JSON array of specific recommendations
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CSS audit: three-tier classification
CREATE TABLE css_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  class_name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  source_file TEXT,                     -- Which CSS file this class comes from
  properties TEXT,                      -- JSON: CSS properties
  usage_count INTEGER DEFAULT 0,
  specificity_score INTEGER,
  quality TEXT CHECK (quality IN (
    'well-structured', 'hacky', 'redundant', 'orphaned'
  )),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, class_name)
);

-- Internal link graph
CREATE TABLE internal_link_graph (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN (
    'contextual', 'navigation', 'breadcrumb', 'cta', 'hub-spoke', 'sibling', 'footer'
  )),
  anchor_text TEXT,
  anchor_variant TEXT CHECK (anchor_variant IN (
    'exact', 'partial', 'branded', 'natural', 'generic', 'localized'
  )),
  section TEXT,                          -- Which page section contains this link
  status TEXT DEFAULT 'existing' CHECK (status IN (
    'existing', 'planned', 'generated', 'approved'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Anchor text banks per target page
CREATE TABLE anchor_text_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  target_url TEXT NOT NULL,
  variant_type TEXT NOT NULL CHECK (variant_type IN (
    'exact', 'partial', 'branded', 'natural', 'generic', 'localized'
  )),
  anchor_text TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, target_url, anchor_text)
);

-- Benchmark standards
CREATE TABLE benchmark_standards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN (
    'page_type', 'seo', 'geo', 'schema', 'content', 'linking'
  )),
  key TEXT NOT NULL,
  value TEXT NOT NULL,                  -- JSON with the standard definition
  source TEXT,                          -- 'scout_research', 'manual', 'industry_standard', 'competitor_analysis'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Page taxonomy
CREATE TABLE page_taxonomy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_type TEXT NOT NULL UNIQUE,
  hierarchy_level INTEGER NOT NULL,     -- 0-4
  display_name TEXT NOT NULL,
  h1_pattern TEXT,
  required_sections TEXT,               -- JSON array of section specs (baseline, actual count is dynamic)
  optional_sections TEXT,               -- JSON array of sections that MAY be included based on context
  target_word_count_min INTEGER,
  target_word_count_max INTEGER,
  primary_keyword_pattern TEXT,
  schema_types TEXT,                    -- JSON array
  silo TEXT,
  geo_requirements TEXT,                -- JSON: {direct_answer_block, faq_count, stat_frequency}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Silo definitions
CREATE TABLE silo_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  silo_name TEXT NOT NULL,
  description TEXT,
  hub_page_type TEXT,
  hub_url TEXT,
  internal_linking_policy TEXT,
  cross_silo_links TEXT,                -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, silo_name)
);

-- Gap analysis with multi-dimensional scoring
CREATE TABLE gap_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  page_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'missing', 'weak', 'adequate', 'strong'
  )),
  existing_page_id INTEGER REFERENCES site_structure_map(id),
  seo_gap_score REAL,
  geo_gap_score REAL,
  schema_gap_score REAL,
  design_gap_score REAL,
  content_gap_score REAL,
  gsc_impressions INTEGER,              -- From GSC integration
  gsc_ctr REAL,                         -- From GSC integration
  gsc_avg_position REAL,                -- From GSC integration
  traffic_potential_score REAL,         -- Computed from GSC data
  deficiencies TEXT,                    -- JSON array
  priority INTEGER,
  silo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work backlog
CREATE TABLE work_backlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  gap_analysis_id INTEGER REFERENCES gap_analysis(id),
  page_type TEXT NOT NULL,
  target_url TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'create', 'improve', 'rewrite'
  )),
  priority INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'blueprinted', 'in_progress', 'generated', 'approved', 'skipped'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Page blueprints: per-page plan with dynamic section breakdown
CREATE TABLE page_blueprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backlog_id INTEGER NOT NULL REFERENCES work_backlog(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  target_keywords TEXT,                 -- JSON array
  working_title TEXT,
  h1_text TEXT,
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  -- Page-level rules
  page_level_seo_rules TEXT,            -- JSON
  page_level_geo_rules TEXT,            -- JSON
  page_level_voice_rules TEXT,          -- JSON
  page_level_css_rules TEXT,            -- JSON
  -- Dynamic section planning
  section_count INTEGER,                -- Determined dynamically, not from fixed template
  section_count_rationale TEXT,         -- Why this many sections for this page
  -- Linking
  internal_links_required TEXT,         -- JSON
  internal_links_optional TEXT,         -- JSON
  breadcrumb_path TEXT,                 -- JSON
  silo_membership TEXT,
  -- Schema
  schema_spec TEXT,                     -- JSON: full @graph JSON-LD specification
  -- Assembly
  section_order TEXT,                   -- JSON array of section IDs in order
  coherence_requirements TEXT,          -- JSON: section transition rules
  user_approved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Section specs: per-section generation plan
CREATE TABLE section_specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blueprint_id INTEGER NOT NULL REFERENCES page_blueprints(id),
  section_type TEXT NOT NULL,           -- 'hero', 'services_overview', 'faq', 'nearby_areas', etc.
  section_order INTEGER NOT NULL,       -- Position in page
  -- Section rules (inherit + override page-level)
  heading_text TEXT,                    -- H2/H3 for this section
  target_word_count_min INTEGER,
  target_word_count_max INTEGER,
  cta_required INTEGER DEFAULT 0,
  cta_text TEXT,
  -- Content requirements
  content_requirements TEXT,            -- JSON: specific requirements for this section
  -- Linking
  links_required TEXT,                  -- JSON: [{url, anchor_text, anchor_variant}]
  -- GEO
  direct_answer_block_required INTEGER DEFAULT 0,
  statistics_required INTEGER DEFAULT 0,
  faq_questions TEXT,                   -- JSON: if section_type = 'faq', specific questions
  -- CSS
  css_classes TEXT,                     -- JSON: recommended classes for this section
  design_pattern TEXT,                  -- Reference to css_patterns
  -- Generation tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'generated', 'approved', 'rejected'
  )),
  generated_html TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CSS patterns
CREATE TABLE css_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),  -- NULL = cross-brand
  pattern_name TEXT NOT NULL,
  description TEXT,
  classes_used TEXT NOT NULL,            -- JSON array
  tiers_used TEXT,                       -- JSON array: [1, 2] or [1, 2, 3]
  page_types TEXT,                       -- JSON array
  section_types TEXT,                    -- JSON array
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  usage_count INTEGER DEFAULT 0,
  html_snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brand profile history
CREATE TABLE brand_profile_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_profile_id INTEGER NOT NULL REFERENCES brand_profiles(id),
  snapshot TEXT NOT NULL,                -- JSON: full profile at this point
  change_reason TEXT,
  changed_by TEXT CHECK (changed_by IN (
    'inference', 'user_edit', 'feedback', 'approval'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- GSC metrics (for backlog prioritization and performance tracking)
CREATE TABLE gsc_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  url TEXT NOT NULL,
  date_range_start TEXT NOT NULL,
  date_range_end TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0.0,
  average_position REAL,
  top_queries TEXT,                     -- JSON array of {query, impressions, clicks, position}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scribe checkpoints (stage transition documentation)
CREATE TABLE scribe_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id), -- NULL = cross-site checkpoint
  stage TEXT NOT NULL,                  -- 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5'
  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN (
    'stage_complete', 'session_pause', 'milestone'
  )),
  deliverables TEXT NOT NULL,           -- JSON: what was produced
  decisions TEXT,                       -- JSON: decisions made with rationale
  state_for_next_session TEXT,          -- JSON: resumption context
  issues TEXT,                          -- JSON: blockers or concerns
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 8.3 Data Model Diagram

```
sites ─────────── brand_profiles ──── brand_profile_history
  │                    │
  │                brand_rules
  │                brand_examples
  │
  ├── site_structure_map ─── content_audit
  │                     └─── schema_audit
  │
  ├── css_audit
  │
  ├── internal_link_graph
  │
  ├── anchor_text_bank
  │
  ├── silo_definitions
  │
  ├── gap_analysis ─── work_backlog ─── page_blueprints ─── section_specs
  │
  ├── css_patterns
  │
  ├── gsc_metrics
  │
  ├── scribe_checkpoints
  │
  └── pages ─── page_versions
       │
       ai_sessions ─── ai_turns

benchmark_standards (domain-wide, not per-site)
page_taxonomy (domain-wide, not per-site)
```

---

## 9. Open Questions

### Resolved (All Formerly Open Questions)

| # | Original Question | Resolution |
|---|---|---|
| OQ-1 | **How deep should the site crawl go?** | **Full sitemap crawl for inventory** -- know what exists and how many pages need work. But NOT deep-researching every page upfront. Sitemap gives scope; specialist agents deep-audit a representative sample. |
| OQ-2 | **Should the system scrape competitor sites?** | **Yes, as optional enhancement.** Added to Stage 2 as non-blocking enrichment. Use for structural/strategic insight, not content copying. |
| OQ-3 | **How should Tier 3 CSS be deployed?** | **Add to existing custom CSS files.** The CSS scraper already captures custom CSS files. The task is identifying which scraped file is the custom one vs. Bootstrap/platform. The system CAN extend custom CSS files -- not limited to what exists. |
| OQ-4 | **Access to Google Search Console / analytics?** | **Yes, GSC access confirmed.** Traffic data feeds backlog prioritization. Designed as clean interface for future integration into larger platform (unified comms, cross-site performance). |
| OQ-5 | **URL structure convention?** | **URL patterns detected from sitemap.** Limited control (SaaS platform). Sitemap is source of truth. Work within platform-enforced constraints. |
| OQ-6 | **Same platform version across all 5 sites?** | **Yes, SaaS platform.** Updates are global across all 5 sites. Stay current with platform documentation. Dependency to track, not a blocker. |
| OQ-8 (V2.1) | Can schema markup be deployed via the WYSIWYG? | **Yes.** JSON-LD can go in the body. Place `<script type="application/ld+json">` blocks at end of page content. Google supports this. |
| OQ (V2) | What schema types for driving schools? | **AutomotiveBusiness** (DrivingSchool doesn't exist). Multi-type allowed: `["AutomotiveBusiness", "EducationalOrganization"]`. |
| OQ (V2.1) | What siloing strategy? | **Hybrid Two-Page Model** -- service pages (content-heavy, root-level) + location pages (lean, under /areas/). Hub-and-spoke internal linking. |
| OQ (V2.1) | How should suburb pages be unique? | **40-50% unique content** via: local landmarks, driving conditions, TMR office info, local testimonials, instructor tie-in, suburb-specific FAQ. |
| OQ (V2.1) | How deep should silos go? | **Max 3 levels.** Flat location structure under /areas/[suburb]/. No regional nesting. |
| OQ-V2-15 | WYSIWYG paste test | **Code view paste confirmed.** Switch to code view, paste HTML directly. Classes are preserved. Sidebars are fixed platform elements -- CSS can adjust positioning to some extent. |
| OQ-V2-1 | How does user create/edit brand profiles? | **Resolved:** Auto-populated by multi-agent audit, user-reviewed. Manual editing still available. |
| OQ-V2-2 | How are brand rules captured from feedback? | **Resolved:** Four sources: inferred (Stage 1), research (Stage 2), feedback (Stage 5), manual. All require user confirmation. |
| OQ-V2-5 | Should brand profiles have versions? | **Yes.** `brand_profile_history` table. Profile evolves with each approval. |
| OQ-14 | **Section count per page type?** | **Dynamic per page AND per site.** Not a fixed number. Determined by page type, site brand, and content requirements. Critical for avoiding programmatic sameness across 5 sites. |

### Technical Uncertainties

| # | Question | Notes |
|---|---|---|
| OQ-7 | **Voice inference reliability with thin content?** | Mitigation: if source_page_count < 5, flag as low-confidence and prompt for more user input. |
| OQ-9 | **Token budget for enriched prompt?** | Estimate: 5,000-8,000 tokens for page-level context + 1,000-2,000 per section. Section-based generation reduces per-call context size. Still well within Claude's context window. |
| OQ-10 | **Near-empty sites?** | Stage 1 produces minimal profile, Stage 3 classifies nearly everything as "missing." System works but requires more manual oversight on early pages. |

### Needs Experimentation

| # | Question | Approach |
|---|---|---|
| OQ-11 | **How many approved pages before batch generation is reliable?** | Generate 1-5 individually, measure edit distance. Batch 6-10, compare. Hypothesis: 3-5 pages. |
| OQ-12 | **Voice consistency validation method?** | Start with keyword/phrase matching. Evolve to Claude-based voice check if insufficient. |
| OQ-13 | **Section brief specificity vs. generation freedom?** | Test varying detail levels. Hypothesis: Hero needs detailed brief, body content needs lighter brief. |

---

## 10. What V2 Got Right (Retained)

1. **Separation of Site (technical) from Brand Profile (creative).** Still the right abstraction.
2. **Memory tiering (hot/warm/cold).** Still necessary. Section-based generation actually reduces per-call context vs. whole-page generation.
3. **Claude CLI subprocess architecture.** Single-turn, stateless calls with rich context assembly. The app is the memory; Claude is the muscle.
4. **Template cascade.** Now includes more layers (benchmark, silo, blueprint, section) but the pattern is the same: global > domain > site > page-type > section-type > instance.
5. **Risk: brand contamination.** Still real. Brand isolation in prompt assembly is critical.
6. **Risk: WYSIWYG paste.** Now confirmed working via code view. Sidebar constraints documented.

---

## 11. What V2 Got Wrong (Changed)

1. **"Have the user fill in profiles."** Wrong. Profiles are inferred by multi-agent audit. User confirms and refines.
2. **"Start creating content immediately."** Wrong. Five stages of profiling, research, gap analysis, and architecture must happen first.
3. **"Any page in any order."** Wrong. Top-down hierarchy is essential for SEO (silos, linking) and learning (homepage teaches the most).
4. **"SEO as an afterthought."** Wrong. SEO, GEO, and schema are first-class concerns with dedicated specialist agents at every stage.
5. **"CSS: what classes exist?"** Insufficient. Three-tier analysis with quality scoring. Custom CSS files are identifiable from scrape data and extendable.
6. **"One call per page."** Wrong. Section-based generation prevents content drift, enables per-section review/regeneration, and allows more focused rule application per call.
7. **"DrivingSchool schema type."** Wrong. Does not exist. Use `AutomotiveBusiness`.
8. **"Links as an afterthought."** Wrong. Link graph built before content generation. Anchor text rotation mandatory.
9. **"Fixed section counts."** Wrong. Dynamic per page and per site to avoid programmatic sameness.
10. **"Standalone tool."** Incomplete. This is one component of a larger platform. Designed with clean interfaces for future integration.

---

## 12. Queensland-Specific Content Opportunities

From Scout's research, these are high-value content elements specific to Queensland:

**Graduated Licensing System:** Each stage (Learner -> P1 -> P2 -> Open) is a content opportunity. Pages explaining requirements, tips, and how the school helps at each stage.

**3-for-1 Logbook Hours:** Each hour with a TMR-accredited instructor counts as 3 logbook hours (up to 10 actual / 30 logbook). This is a unique selling point that should appear on every service page, every suburb page, and in FAQ content.

**TMR Accreditation:** Mandatory for paid instruction. Display prominently. Include in schema descriptions, meta descriptions, FAQ answers. Link to TMR's driving school page.

**Geographic Considerations:** SEQ is the major population center. Mention specific roads and landmarks per suburb. Reference nearest TMR customer service centres. Differentiate regional QLD driving conditions.

---

## 13. Anti-Patterns Registry

### Content Anti-Patterns
1. **Thin suburb pages** -- No suburb page that only differs by name swap. Each needs 40-50% unique content.
2. **Service x Location matrix** -- Do NOT create `/manual-lessons/springfield/`. Fragments authority. Location pages cover all services for that area.
3. **Duplicate content across sites** -- 5 sites must have genuinely distinct content.
4. **Burying the answer** -- TLDR-first. Answer the primary query in the first 200 words.
5. **Vague, fluffy content** -- "Amazing instructors" is useless. Be specific and factual.
6. **Stale content** -- Content not updated in 6+ months loses AI visibility.
7. **No FAQ content** -- Missing the #1 citation-friendly content format.
8. **Fixed section templates** -- Same number of sections in same order across all pages creates programmatic sameness. Section counts and composition must vary.

### Linking Anti-Patterns
9. **Full mesh location linking** -- Never link every suburb to every other suburb.
10. **Exact-match anchor spam** -- Same anchor text everywhere triggers penalties.
11. **Too many links per page** -- Beyond 15 contextual links (excluding nav), equity dilutes.
12. **Orphan pages** -- Every page needs 2+ incoming links.
13. **Deep nesting** -- Max 3 levels. No `/areas/qld/seq/brisbane-north/springfield/`.

### Schema Anti-Patterns
14. **Schema/content mismatch** -- Schema values must match visible page content.
15. **Fake reviews** -- Never fabricate review data.
16. **Missing required properties** -- AutomotiveBusiness without name and address is invalid.
17. **Outdated prices** -- Keep schema prices current.

### Cross-Site Anti-Patterns
18. **Automated cross-site footer links** -- Looks like link manipulation.
19. **Identical link patterns** -- Each site must have independent link structure.
20. **Name-swapped templates** -- Each site needs genuinely unique content.

### Platform Anti-Patterns
21. **Ignoring sidebar** -- Designing layouts that conflict with fixed platform sidebars.
22. **Assuming URL control** -- Creating URL strategies that the SaaS platform cannot enforce.
23. **Head-dependent HTML** -- Generating content that requires `<head>` modifications.

---

## 14. Implementation Sequence (High-Level)

**Phase A: Foundation Validation**
- WYSIWYG code view paste test (confirmed working -- validate CSS class preservation)
- Live site end-to-end test (scrape, generate, preview, export)
- CSS file identification test (distinguish custom CSS from Bootstrap/platform in scrape data)
- Sidebar constraint documentation (measure dimensions, test CSS positioning adjustments)

**Phase B: Stage 1 (Site Audit & Inventory)**
- Sitemap crawl and inventory module
- SEO agent audit module
- GEO agent audit module
- Schema agent audit module
- Pixel agent visual/CSS audit module (with custom CSS file identification)
- Content analysis / voice inference module
- Unified site brief assembly
- Profile review UI
- Scribe checkpoint integration

**Phase C: Stage 2 (Research & Benchmark)**
- Integrate Scout's completed research outputs into benchmark_standards
- Page taxonomy population (Two-Page Model with dynamic section counts)
- Schema templates (JSON-LD per page type with @graph/@id)
- Silo strategy + link graph template
- Competitor scraping module (optional enhancement)
- Scribe checkpoint integration

**Phase D: Stage 3 (Gap Analysis)**
- Multi-dimensional scoring engine (SEO + GEO + Schema + Design + Content)
- GSC data integration for traffic-aware prioritization
- Link graph construction with anchor text bank generation
- Backlog generation and prioritization (with GSC-enhanced formula)
- Silo mapping
- Scribe checkpoint integration

**Phase E: Stage 4 (Design & Architecture)**
- Page blueprint generator (with dynamic section count determination)
- Section spec generator (per-section rules, word counts, linking)
- Schema spec generator (per-page @graph JSON-LD)
- CSS decision engine (per section, with Tier 3 additions to custom CSS files)
- Blueprint review UI
- Scribe checkpoint integration

**Phase F: Stage 5 (Build & Learn)**
- Section-based prompt builder (12-layer context assembly with platform constraints)
- Per-section generation + validation
- Page assembly + coherence pass
- Multi-agent validation (seo + geo + schema agents)
- Code view paste readiness validation
- Feedback classification system (now with section-level scoping)
- Brand profile enrichment loop
- Progressive batch generation with learning
- Scribe checkpoint integration (per page approval)

Each phase depends on the previous one. Within each phase, work items can be parallelized.
