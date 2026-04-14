---
title: "TIC Group Website Rebuild — Problem Definition"
version: "1.0.0"
status: draft
last-updated: "2026-04-11"
author: framer
project: tic-group-website
problem-id: PRB-tic-group-website-001
source: intake-brief.json
---

# TIC Group Website Rebuild — Problem Definition

## 1. Problem Statement

The Instructor College (TIC) has pivoted from being a training provider to being a group that acquires, operates, and supports driving school businesses, but the current public website still leads with nationally recognised training course language ("Complete TLI41222", "we train the instructors"). This creates two compounding problems: first, a **compliance risk** where ASQA states only registered RTOs can advertise or deliver VET, and TIC's current site implies it delivers nationally recognised training which may not be legally accurate; second, a **positioning mismatch** where the site fails to reflect TIC's actual business model as an investor, operator, acquirer, and services platform for driving schools, undermining acquisition conversations and industry credibility with potential sellers, partners, and recruits.

## 2. Scope

### 2.1 In Scope (Phase 1)

1. Reposition TIC as a group/operator/acquirer brand — core messaging pivot across all public-facing pages
2. **Home page:** hero, what TIC is, proof strip, value creation model (Acquire / Operate / Support), group brands preview, services preview, acquisition CTA, insights preview, contact CTA
3. **About page:** who we are, story, leadership, operating model, values, FAQ
4. **Our Group page:** overview, brand directory rendered from a markdown content model, regions/locations, individual brand detail pages
5. **Acquisitions page:** why owners choose TIC, what we look for, what happens after sale, process steps, seller FAQ, confidential enquiry form
6. **Contact page:** general enquiry, acquisition enquiry, service enquiry, media/partnerships forms
7. **Utility pages:** privacy policy, terms, cookie policy, accessibility statement, sitemap, 404 page, thank-you confirmation page
8. Structured data: Organisation and breadcrumb JSON-LD on all pages
9. Responsive mobile-first design
10. WCAG 2.2 AA accessibility compliance
11. Core Web Vitals compliance (LCP < 2.5 s, CLS < 0.1, INP < 200 ms)
12. Content model definition: `brands/*.md`, `services/*.md`, `insights/*.md`, `case-studies/*.md` with defined frontmatter schemas
13. Removal or noindex of any pages that imply TIC delivers nationally recognised training (ASQA compliance)
14. Form spam protection via Cloudflare Turnstile
15. Analytics integration via Cloudflare Web Analytics
16. Dark/light layered section design, strong typography, editorial layouts
17. Documentary-style photography direction, minimal stock imagery

### 2.2 Out of Scope

1. **Services section detail pages** — deferred to Phase 2
2. **Insights/blog hub** — deferred to Phase 2
3. **Case studies section** — deferred to Phase 2
4. **Interactive tools** (portfolio map, acquisition fit self-check, service maturity quiz) — deferred to Phase 3
5. **Advanced directory filters** — deferred to Phase 3
6. **Bookkeeping/accounting service pages** — deferred to Phase 3, pending validation
7. Heavy WebGL or 3D elements
8. SPA architecture or heavy frontend frameworks
9. Any content implying TIC delivers nationally recognised training — this is a hard exclusion, not a deferral

## 3. Users

### Persona 1: Driving School Owner Considering Sale

- **Role:** Owner of an established driving school business exploring exit or succession
- **Goal:** Evaluate whether TIC is a credible, trustworthy acquirer; understand the sale process, continuity assurances, and next steps for a confidential enquiry
- **Context:** These are business owners who have built their driving schools over years or decades. They care deeply about staff continuity, brand preservation, and student welfare after sale. They need a clear, simple, low-pressure path to begin a conversation. Trust and discretion are paramount.

### Persona 2: Driving School Operator Needing Support Services

- **Role:** Operator of an existing driving school seeking operational assistance
- **Goal:** Understand what operational support services TIC offers, see clear outcomes and practical details, and initiate a service enquiry
- **Context:** These operators are not selling. They need help with specific operational challenges — compliance, fleet management, marketing, bookings, administration. They want to see what is available, what it costs (or at least what the engagement model is), and how to get started.

### Persona 3: General Credibility Audience

- **Role:** Partner, recruit, journalist, or industry observer
- **Goal:** Quickly understand who TIC is, what it does, its scale and track record, and how to get in contact
- **Context:** This is a broad audience that includes potential business partners, job candidates, journalists, and general industry observers. They arrive with little prior knowledge and need a clear, professional picture of TIC's identity and positioning within 30 seconds of landing.

## 4. Success Criteria

| # | Criterion | Measurement | Testable |
|---|-----------|-------------|----------|
| SC-1 | Site launches with all Phase 1 pages live and responding | All defined routes return HTTP 200 on the production deployment | Yes |
| SC-2 | Zero compliance risk — no page implies TIC delivers VET or nationally recognised training | Content audit of every page passes with zero instances of VET delivery language, RTO advertising, or nationally recognised training claims | Yes |
| SC-3 | Core Web Vitals pass on all Phase 1 pages | Lighthouse/PageSpeed audit: LCP < 2.5 s, CLS < 0.1, INP < 200 ms on every page | Yes |
| SC-4 | WCAG 2.2 AA accessibility compliance | axe-core automated audit returns zero critical violations on all Phase 1 pages | Yes |
| SC-5 | Acquisition enquiry form works end-to-end | Form submits successfully, spam protection validates, confirmation page displays, submission is received | Yes |
| SC-6 | Brand directory renders all brands from the markdown content model | Every `brands/*.md` entry renders on the Our Group page with correct title, region, summary, and links | Yes |
| SC-7 | Structured data validates for Organisation and breadcrumb | Organisation and breadcrumb JSON-LD pass Google Rich Results Test with zero errors | Yes |

## 5. Constraints

1. **Regulatory — ASQA compliance:** All pages implying TIC delivers nationally recognised training must be removed or noindexed. Only registered RTOs can advertise, offer, or deliver VET. This is a legal compliance requirement, not a preference.
2. **Phased delivery:** Phase 1 (core pages) must ship independently. Phase 2 (services, insights, case studies) and Phase 3 (interactive tools) follow separately. The site must be fully functional and valuable at Phase 1 completion.
3. **Static site generator:** 11ty (Eleventy) is the mandated generator.
4. **Hosting:** Cloudflare Pages is the mandated hosting platform.
5. **Templating:** Nunjucks or Liquid only.
6. **Client-side JavaScript:** Vanilla JS or Alpine.js only. No heavy SPA frameworks (React, Vue, Angular, etc.).
7. **Motion:** GSAP permitted only for tightly controlled motion. No heavy animation libraries.
8. **Performance:** Fast LCP, minimal CLS, lightweight interaction — especially on mobile.
9. **Design direction:** Dark/light layered sections, strong typography, editorial layouts, documentary-style photography. This is a creative constraint that must be respected across all pages.
10. **Optional infrastructure:** Cloudflare R2 for media storage, Cloudflare Workers for server-side functions (use only where needed).

## 6. Background & Prior Art

The following references inform the positioning and structure expectations for this project:

- **Tiny (tiny.com)** — plain-English acquisition pitch, proof metrics, founder-friendly tone
- **Halma (halma.com)** — purpose + portfolio + operating model site structure
- **Permanent Equity** — acquisition criteria, seller reassurance, operational transparency
- **Breakthrough Energy** — three-part model analogous to Acquire / Operate / Support
- **Inspired Education / Nord Anglia** — group site positioned above operating brands
- **Total Drive / MyDriveTime** — driving school industry service page references
- **Lightship, Joby, Shift5** — premium motion and content architecture (Awwwards winners)
- **TIC's existing website** — the current site that implies RTO training delivery, creating the compliance and positioning problems this project solves

### Positioning Context

- **Core positioning:** A driving industry group that acquires, operates, and supports driving school businesses.
- **Brand promise:** We help driving schools grow through better systems, stronger operations, and specialist industry support.
- **Pillars:** Acquire | Operate | Support

### Content Model

The site uses a markdown-driven content model with defined frontmatter schemas:

- `brands/*.md` — title, region, service_areas, brand_summary, website_url, featured_image, status, order
- `services/*.md` — title, audience, outcomes, features, CTA
- `insights/*.md` — title, category, summary, author, published_date, related
- `case-studies/*.md` — title, business_type, challenge, intervention, outcomes, metrics, testimonial

Note: Only `brands/*.md` is required for Phase 1. The other content types support Phase 2 and Phase 3 but the schema should be defined now for forward compatibility.

## 7. Assumptions

| # | Assumption | Impact If Wrong |
|---|-----------|-----------------|
| A-1 | TIC is not currently a registered RTO and therefore cannot legally advertise VET delivery | If TIC is a registered RTO, the ASQA compliance constraint still applies but the urgency and specific remediation changes significantly |
| A-2 | The existing domain and DNS are already on Cloudflare or can be migrated before launch | If DNS migration is blocked or delayed, the deployment timeline slips and a staging-only launch may be needed |
| A-3 | Brand content (logos, descriptions, regions) exists or can be provided for all group brands before Phase 1 launch | If brand content is incomplete, the brand directory will launch with gaps, undermining the "group credibility" goal |
| A-4 | Documentary-style photography either exists or will be commissioned/sourced before launch | If photography is unavailable, the design direction must fall back to illustration or carefully curated stock, reducing the editorial quality |
| A-5 | Form submissions can be handled by Cloudflare Workers or a simple email relay — no CRM integration is needed for Phase 1 | If CRM integration is required at launch, the scope and complexity of form handling increases significantly |
| A-6 | The "services preview" on the home page is a teaser pointing to Phase 2, not a fully functional services section | If full services content is expected at launch, this is a scope expansion that conflicts with the phased delivery constraint |
| A-7 | The "insights preview" on the home page is a teaser pointing to Phase 2, not a fully functional blog | Same as A-6 — if full insights content is expected, scope expands |
| A-8 | ASQA compliance review is TIC's responsibility; the project team builds what is specified, but legal sign-off on content is the client's obligation | If the project team is expected to provide legal compliance assurance, additional legal review steps must be added to the process |

## 8. Open Questions

1. **RTO status clarity:** Is TIC currently a registered RTO, or has it fully divested its RTO registration? The answer changes the specific ASQA compliance actions required.
2. **Existing content audit:** Has anyone catalogued which pages on the current site contain VET/training delivery language? If not, a content audit is a prerequisite before build begins.
3. **Brand count and readiness:** How many brands are in the TIC group today, and do all have the content required by the `brands/*.md` schema (title, region, service areas, summary, logo, featured image)?
4. **Photography assets:** Does TIC have existing documentary-style photography, or does a photoshoot need to be commissioned? What is the timeline for asset delivery?
5. **Form submission backend:** Where should form submissions go? Email? A specific CRM? A shared inbox? This determines whether a simple Workers function suffices or integration work is needed.
6. **Leadership content:** Does the About page require headshots, bios, and titles for leadership? How many people, and are assets available?
7. **Acquisition enquiry confidentiality:** The confidential enquiry form is a high-stakes interaction. Are there specific fields, disclaimers, or privacy commitments that must be included beyond standard form handling?
8. **Redirect strategy:** When the existing site is replaced, what happens to old URLs? Is a 301 redirect map required for SEO preservation, or is this a clean-slate launch?
9. **Analytics baseline:** Are there existing analytics (Google Analytics, etc.) that need to be preserved or migrated, or is Cloudflare Web Analytics a fresh start?
10. **Legal review process:** Who signs off that the final site content is ASQA-compliant? Is there a legal team or compliance officer in the loop?
11. **Services preview scope:** The home page includes a "services preview" — what content appears here given that full services pages are Phase 2? Is this a static list, a teaser, or something else?
12. **Insights preview scope:** Same question for the "insights preview" on the home page — what content appears here pre-Phase 2?
