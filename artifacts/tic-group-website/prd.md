---
title: "TIC Group Website Rebuild — Product Requirements Document"
version: "1.0.0"
status: draft
last-updated: "2026-04-11"
author: quill
project: tic-group-website
prd-id: PRD-tic-group-website-001
upstream:
  problem: PRB-tic-group-website-001 (artifacts/tic-group-website/problem.md)
  eval-spec: artifacts/tic-group-website/eval-spec.md
  architecture: artifacts/tic-group-website/architecture.md
  intake-brief: INT-tic-group-website-001 (artifacts/tic-group-website/intake-brief.json)
---

# TIC Group Website Rebuild — Product Requirements Document

## 1. Problem Statement

The Instructor College (TIC) has pivoted from being a training provider to being a group that acquires, operates, and supports driving school businesses, but the current public website still leads with nationally recognised training course language ("Complete TLI41222", "we train the instructors"). This creates two compounding problems:

1. **Compliance risk:** ASQA states only registered RTOs can advertise or deliver VET. TIC's current site implies it delivers nationally recognised training, which may not be legally accurate.
2. **Positioning mismatch:** The site fails to reflect TIC's actual business model as an investor, operator, acquirer, and services platform for driving schools, undermining acquisition conversations and industry credibility with potential sellers, partners, and recruits.

The website must be rebuilt as a static site (11ty + Cloudflare Pages) that positions TIC as a driving industry group — not a training provider — and eliminates all ASQA compliance risk.

*Source: PRB-tic-group-website-001*

---

## 2. Goals

The following SMART goals are derived from the seven success criteria defined in the problem definition and eval specification.

| ID | Goal | Measurable Target | Timeline |
|----|------|--------------------|----------|
| G-1 | Deploy a fully functional Phase 1 website on Cloudflare Pages | 100% of Phase 1 routes return HTTP 200; sitemap.xml contains all canonical URLs | Phase 1 launch |
| G-2 | Eliminate ASQA compliance risk from all published content | Zero matches against the compliance blocklist across all built HTML | Phase 1 launch |
| G-3 | Meet Core Web Vitals thresholds on every Phase 1 page | LCP < 2.5 s, CLS < 0.1, INP < 200 ms, Lighthouse Performance >= 90 | Phase 1 launch |
| G-4 | Achieve WCAG 2.2 AA accessibility compliance | Zero critical and zero serious axe-core violations on all Phase 1 pages | Phase 1 launch |
| G-5 | Deliver working enquiry forms with spam protection | All four form types submit, Turnstile validates, confirmation displays | Phase 1 launch |
| G-6 | Render a complete, data-driven brand directory | Published brands from `brands/*.md` render on `/our-group/` with detail pages | Phase 1 launch |
| G-7 | Implement valid structured data on every page | Organisation and BreadcrumbList JSON-LD pass schema validation with zero errors | Phase 1 launch |

---

## 3. Users

### 3.1 Driving School Owner Considering Sale

- **Goal:** Evaluate whether TIC is a credible, trustworthy acquirer; understand the sale process, continuity assurances, and next steps for a confidential enquiry.
- **Key pages:** Home, Acquisitions, Our Group, About.
- **Key action:** Submit confidential acquisition enquiry form.

### 3.2 Driving School Operator Needing Support Services

- **Goal:** Understand what operational support services TIC offers, see clear outcomes and practical details, and initiate a service enquiry.
- **Key pages:** Home (services preview), Contact.
- **Key action:** Submit service enquiry form.

### 3.3 General Credibility Audience (Partners, Recruits, Media)

- **Goal:** Quickly understand who TIC is, what it does, its scale and track record, and how to get in contact.
- **Key pages:** Home, About, Our Group.
- **Key action:** Submit general or media/partnerships enquiry form.

---

## 4. Requirements

### 4.1 P0 — Must Have (Phase 1 Launch)

#### Pages and Content

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-001 | Home page | Hero, what TIC is, proof strip, value creation model (Acquire / Operate / Support), group brands preview, services preview (static teaser), acquisition CTA, insights preview (static teaser or omitted), contact CTA | SC-1 |
| REQ-002 | About page | Who we are, story, leadership, operating model, values, FAQ accordion | SC-1 |
| REQ-003 | Our Group page (brand directory) | Overview section, brand card grid rendered from `brands/*.md` collection, regions/locations summary | SC-1, SC-6 |
| REQ-004 | Brand detail pages | Individual pages generated from `brands/*.md` with title, region, service areas, summary, featured image, body content, back link to `/our-group/` | SC-1, SC-6 |
| REQ-005 | Acquisitions page | Why owners choose TIC, what we look for, what happens after sale, process steps, seller FAQ, confidential enquiry form with Turnstile | SC-1, SC-5 |
| REQ-006 | Contact page | General enquiry, acquisition enquiry, service enquiry, media/partnerships forms — all with Turnstile | SC-1, SC-5 |
| REQ-007 | Utility pages | Privacy policy, terms, cookie policy, accessibility statement, HTML sitemap, 404 page, thank-you confirmation page | SC-1 |

#### Content Model

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-008 | Brands content collection | `src/brands/*.md` with frontmatter schema: title, region, service_areas, brand_summary, website_url, featured_image, logo, status, order, date_acquired. Collection filters to `status: published` and sorts by `order`. | SC-6 |
| REQ-009 | Draft brand exclusion | Brands with `status: draft` must not appear in production builds | SC-6 |
| REQ-010 | Future content schemas | Define frontmatter schemas for `services/*.md`, `insights/*.md`, `case-studies/*.md` for forward compatibility. Directories exist but contain no published content in Phase 1. | SC-1 |

#### Compliance

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-011 | ASQA content compliance | Zero pages imply TIC delivers VET or nationally recognised training. Automated blocklist grep runs against all built HTML. Any match is a blocking failure. | SC-2 |
| REQ-012 | Compliance blocklist | Maintained in `evals/compliance-blocklist.txt`. Includes: "nationally recognised", "registered training organisation", "RTO" (standalone), "VET" (standalone), training package codes (TLI\d+), "Certificate IV"/"Cert IV"/"Certificate 4", "we train", "we deliver training", "training provider", "nationally accredited", "complete your" + training/cert/qualification, "course" as primary offering. | SC-2 |
| REQ-013 | Legacy page removal | Any pages from the old site that contain VET/training language must be removed or set to `noindex`. 301 redirect map required if old URLs had SEO value. | SC-2 |

#### Forms and Spam Protection

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-014 | Confidential acquisition enquiry form | Fields: name, email, phone, business_name, region, message, privacy_consent. Located on `/acquisitions/`. Submits to dedicated acquisition inbox. | SC-5 |
| REQ-015 | General enquiry form | Fields: name, email, phone, message, privacy_consent. Located on `/contact/`. | SC-5 |
| REQ-016 | Service enquiry form | Fields: name, email, phone, business_name, service_interest, message, privacy_consent. Located on `/contact/`. | SC-5 |
| REQ-017 | Media/partnerships form | Fields: name, email, organisation, enquiry_type, message, privacy_consent. Located on `/contact/`. | SC-5 |
| REQ-018 | Cloudflare Turnstile integration | Turnstile widget on all form pages. Invisible/managed challenge mode. Server-side token verification in Cloudflare Pages Function. | SC-5 |
| REQ-019 | Form submission handler | Cloudflare Pages Function (`functions/api/submit.js`): parse POST body, verify Turnstile token, validate required fields, route by form_type, send email/webhook, redirect to `/thank-you/?form=<type>`. | SC-5 |
| REQ-020 | Client-side form validation | Required field validation and email format check before submission. | SC-5 |
| REQ-021 | Thank-you page | Single confirmation page at `/thank-you/` with form-type-specific messaging via query parameter. | SC-5 |

#### Accessibility

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-022 | WCAG 2.2 AA compliance | All images have alt text. Colour contrast meets AA ratios (4.5:1 normal, 3:1 large). All interactive elements keyboard accessible. Visible focus indicators. Form inputs have associated labels. Valid ARIA attributes. Single `<h1>` per page with correct heading hierarchy. Skip-to-content link present. | SC-4 |
| REQ-023 | Automated accessibility testing | axe-core scan of all Phase 1 routes in CI. Zero critical and zero serious violations required. | SC-4 |

#### Performance

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-024 | Core Web Vitals compliance | LCP < 2.5 s, CLS < 0.1, INP < 200 ms on all Phase 1 pages. Lighthouse Performance score >= 90. | SC-3 |
| REQ-025 | Responsive image pipeline | 11ty Image plugin generates responsive images with `srcset`, `sizes`, WebP/AVIF output. Widths: 300, 600, 900, 1200. | SC-3 |
| REQ-026 | Font optimisation | Self-hosted web fonts with `font-display: swap`. Preload critical fonts. | SC-3 |
| REQ-027 | CSS/JS optimisation | Inline critical CSS. Defer non-critical JS. Conditional loading of Alpine.js and GSAP (only on pages that need them). | SC-3 |

#### Structured Data and SEO

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-028 | Organisation JSON-LD | Home page includes Organisation structured data with name, url, logo, description, contactPoint. Data sourced from `organisation.json`. | SC-7 |
| REQ-029 | BreadcrumbList JSON-LD | Every page includes BreadcrumbList structured data matching the page's URL hierarchy. | SC-7 |
| REQ-030 | SEO meta tags | Every page has `<title>`, meta description, OG tags, Twitter card, canonical URL via `seo.njk` partial. | SC-7 |
| REQ-031 | XML sitemap | `sitemap.xml` generated at build time containing all Phase 1 canonical URLs. | SC-1 |
| REQ-032 | robots.txt | Environment-aware robots.txt: allow all on production, disallow all on preview/staging. | SC-1 |

#### Deployment and Infrastructure

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-033 | 11ty static site build | Site builds with zero errors and zero warnings via `npx eleventy`. | SC-1 |
| REQ-034 | Cloudflare Pages deployment | Production on `ticgroup.com.au` (main branch). Staging on `develop.tic-group.pages.dev`. Preview deploys for feature branches. | SC-1 |
| REQ-035 | Security headers | X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy, Content-Security-Policy. Delivered via `_headers` file. | SC-1 |
| REQ-036 | SSL/TLS and domain | Cloudflare-managed SSL. `www` redirect to apex domain. | SC-1 |
| REQ-037 | CI eval pipeline | GitHub Actions workflow: build check, compliance blocklist grep, brand count validation, JSON-LD validation, axe-core scan (build time). Post-deploy: route checks, Lighthouse CI, Playwright form tests. All evals must pass before production promotion. | SC-1, SC-2, SC-3, SC-4, SC-5, SC-6, SC-7 |

#### Design Direction

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-038 | Responsive mobile-first design | All pages fully responsive. Mobile-first CSS approach. | SC-3, SC-4 |
| REQ-039 | Dark/light layered sections | Alternating dark and light section backgrounds using `section.njk` component with variant prop. Design tokens for colour system. | SC-3 |
| REQ-040 | Typography system | Strong editorial typography. CSS custom properties for font families, sizes, weights. Inter as primary font. | SC-3 |
| REQ-041 | Photography direction | Documentary-style photography. Minimal stock imagery. Image optimisation via 11ty Image plugin. | SC-3 |

### 4.2 P1 — Should Have

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-042 | Motion and animation | GSAP for controlled motion sequences (e.g., home page hero animation). Conditional loading — only on pages that use it. Must not degrade Core Web Vitals. | SC-3 |
| REQ-043 | Editorial content polish | Refined copywriting across all pages. Professional tone aligned with acquirer/operator positioning. Prior art references: Tiny, Permanent Equity, Halma. | SC-2 |
| REQ-044 | Cloudflare Web Analytics | Analytics beacon integrated via `analytics.njk` partial on all pages. | SC-1 |
| REQ-045 | 301 redirect map | Redirect map from old site URLs to new site URLs to preserve SEO equity. Delivered via `_redirects` file. | SC-1 |

### 4.3 P2 — Nice to Have

| REQ-ID | Requirement | Details | Eval Trace |
|--------|-------------|---------|------------|
| REQ-046 | Preview/staging strategy | Formal preview environment strategy with Cloudflare Pages branch deploys. Eval pipeline runs against preview URLs before production promotion. | SC-1 |
| REQ-047 | Advanced SEO | Additional structured data types (LocalBusiness for brands, FAQPage for FAQ sections). Schema markup beyond Organisation and BreadcrumbList. | SC-7 |
| REQ-048 | RSS feed scaffold | `feed.njk` template scaffolded for Phase 2 insights/blog activation. | SC-1 |

---

## 5. Acceptance Criteria

All acceptance criteria are inherited from the eval specification (eval-spec.md). No criteria are invented.

### AC-1: Deployment (from SC-1)

- 11ty build completes with zero errors and zero warnings (`npx eleventy --dryrun`).
- All Phase 1 routes return HTTP 200 with non-empty HTML body on production deployment.
- 404 page returns HTTP 404 (not 200) for unknown routes.
- `sitemap.xml` exists and contains all Phase 1 canonical URLs.

**Eval method:** CI build check + post-deploy HTTP status checks (curl script).

### AC-2: ASQA Compliance (from SC-2)

- Automated grep of all built HTML files against the compliance blocklist returns zero matches.
- Any match is a blocking failure requiring content change before deploy.
- Manual legal review confirms content is ASQA-compliant (client responsibility).

**Eval method:** CI build-time grep (`evals/compliance-check.sh`).

### AC-3: Performance (from SC-3)

- LCP < 2.5 s on all Phase 1 routes.
- CLS < 0.1 on all Phase 1 routes.
- INP < 200 ms on all Phase 1 routes.
- Lighthouse Performance score >= 90 on all Phase 1 routes.
- Any single page failing any metric is a blocking failure.

**Eval method:** Lighthouse CI (3 runs per page) against staging/production URL.

### AC-4: Accessibility (from SC-4)

- axe-core automated audit returns zero critical violations on all Phase 1 pages.
- axe-core returns zero serious violations on all Phase 1 pages.
- Minor/moderate violations logged but non-blocking for Phase 1.
- Specific checks: alt text on all images, AA colour contrast, keyboard accessibility, visible focus indicators, labelled form inputs, valid ARIA, correct heading hierarchy, skip-to-content link.

**Eval method:** axe-core via Playwright against locally-served build + post-deploy URLs.

### AC-5: Forms (from SC-5)

- Acquisition enquiry form exists on `/acquisitions/` with all required fields.
- Turnstile widget renders on all form pages.
- Valid submission reaches `/thank-you/` confirmation page.
- Empty required fields are blocked by client-side validation.
- All four form types (acquisition, general, service, media) function end-to-end.

**Eval method:** Playwright end-to-end tests with Turnstile test keys. Manual smoke test for email delivery.

### AC-6: Brand Directory (from SC-6)

- Count of rendered brands on `/our-group/` equals count of `brands/*.md` files with `status: published`.
- Each brand card displays title, region, and summary.
- Each brand detail link returns HTTP 200.
- Zero draft brands appear in production build.

**Eval method:** Build-time count validation (`evals/brand-check.sh`) + Playwright post-deploy test.

### AC-7: Structured Data (from SC-7)

- Every Phase 1 page has valid JSON-LD (parseable, no syntax errors).
- Home page has Organisation JSON-LD with name, url, logo, description, contactPoint.
- Every page has BreadcrumbList JSON-LD matching its URL hierarchy.
- Zero errors from schema.org validation.
- Zero errors from Google Rich Results validator.

**Eval method:** Build-time JSON-LD parse and schema check (`evals/structured-data-check.js`). Manual Google Rich Results Test post-deploy.

---

## 6. Traceability Matrix

| REQ-ID | Requirement | Eval Case | Pass/Fail Threshold |
|--------|-------------|-----------|---------------------|
| REQ-001 | Home page | SC-1 | Route `/` returns HTTP 200 |
| REQ-002 | About page | SC-1 | Route `/about/` returns HTTP 200 |
| REQ-003 | Our Group page | SC-1, SC-6 | Route `/our-group/` returns HTTP 200; brand count matches published `brands/*.md` count |
| REQ-004 | Brand detail pages | SC-1, SC-6 | Each `/our-group/:slug/` returns HTTP 200; displays title, region, summary |
| REQ-005 | Acquisitions page | SC-1, SC-5 | Route `/acquisitions/` returns HTTP 200; form submits to `/thank-you/` |
| REQ-006 | Contact page | SC-1, SC-5 | Route `/contact/` returns HTTP 200; all four form types function |
| REQ-007 | Utility pages | SC-1 | All utility routes return HTTP 200; `/404.html` returns 404 |
| REQ-008 | Brands content collection | SC-6 | Published brands render; schema fields present in output |
| REQ-009 | Draft brand exclusion | SC-6 | Zero draft brands in production HTML |
| REQ-010 | Future content schemas | SC-1 | Directories exist; no broken links to unpublished content |
| REQ-011 | ASQA content compliance | SC-2 | Zero blocklist matches in built HTML |
| REQ-012 | Compliance blocklist | SC-2 | Blocklist file exists; CI job runs grep |
| REQ-013 | Legacy page removal | SC-2 | No VET/training pages accessible; old URLs redirect or 404 |
| REQ-014 | Acquisition enquiry form | SC-5 | Form submits, Turnstile validates, confirmation displays |
| REQ-015 | General enquiry form | SC-5 | Form submits, Turnstile validates, confirmation displays |
| REQ-016 | Service enquiry form | SC-5 | Form submits, Turnstile validates, confirmation displays |
| REQ-017 | Media/partnerships form | SC-5 | Form submits, Turnstile validates, confirmation displays |
| REQ-018 | Turnstile integration | SC-5 | Turnstile widget renders; token verified server-side |
| REQ-019 | Form submission handler | SC-5 | Pages Function returns 302 to `/thank-you/`; email received |
| REQ-020 | Client-side validation | SC-5 | Empty required fields blocked before submission |
| REQ-021 | Thank-you page | SC-5 | `/thank-you/` returns HTTP 200 with form-type-specific message |
| REQ-022 | WCAG 2.2 AA compliance | SC-4 | Zero critical/serious axe-core violations |
| REQ-023 | Automated a11y testing | SC-4 | CI pipeline includes axe-core scan; zero critical/serious |
| REQ-024 | Core Web Vitals | SC-3 | LCP < 2.5 s, CLS < 0.1, INP < 200 ms, Lighthouse >= 90 |
| REQ-025 | Responsive image pipeline | SC-3 | Images serve WebP/AVIF with correct srcset |
| REQ-026 | Font optimisation | SC-3 | font-display: swap; preload critical fonts |
| REQ-027 | CSS/JS optimisation | SC-3 | Critical CSS inlined; non-critical JS deferred |
| REQ-028 | Organisation JSON-LD | SC-7 | Valid JSON-LD on home page with required fields |
| REQ-029 | BreadcrumbList JSON-LD | SC-7 | Valid BreadcrumbList on every page matching URL hierarchy |
| REQ-030 | SEO meta tags | SC-7 | title, meta description, OG tags, canonical on every page |
| REQ-031 | XML sitemap | SC-1 | `sitemap.xml` contains all Phase 1 URLs |
| REQ-032 | robots.txt | SC-1 | Production allows crawling; preview/staging disallows |
| REQ-033 | 11ty build | SC-1 | Zero errors, zero warnings |
| REQ-034 | Cloudflare Pages deployment | SC-1 | Production live on custom domain |
| REQ-035 | Security headers | SC-1 | `_headers` file delivers CSP, X-Frame-Options, etc. |
| REQ-036 | SSL/TLS and domain | SC-1 | HTTPS enforced; www redirects to apex |
| REQ-037 | CI eval pipeline | SC-1 through SC-7 | All evals pass before production promotion |
| REQ-038 | Responsive mobile-first | SC-3, SC-4 | Pages render correctly on mobile viewports |
| REQ-039 | Dark/light sections | SC-3 | Sections alternate without CLS; contrast meets AA |
| REQ-040 | Typography system | SC-3 | Design tokens applied; fonts load without layout shift |
| REQ-041 | Photography direction | SC-3 | Images optimised; no uncompressed stock photos |
| REQ-042 | Motion/animation | SC-3 | GSAP loads conditionally; no CWV degradation |
| REQ-043 | Editorial polish | SC-2 | Content aligns with acquirer/operator positioning; zero blocklist matches |
| REQ-044 | Analytics integration | SC-1 | Cloudflare Web Analytics beacon present in HTML |
| REQ-045 | 301 redirect map | SC-1 | Old URLs redirect to appropriate new pages |
| REQ-046 | Preview strategy | SC-1 | Branch deploys available; evals run on preview |
| REQ-047 | Advanced SEO | SC-7 | Additional schema types validate without errors |
| REQ-048 | RSS scaffold | SC-1 | Template file exists; no broken output |

---

## 7. Success Metrics

The following seven testable criteria define project success. All are inherited from the problem definition (PRB-tic-group-website-001).

| # | Criterion | Measurement | Automated | Blocking |
|---|-----------|-------------|-----------|----------|
| SC-1 | All Phase 1 pages live and responding | All defined routes return expected HTTP status codes on production | Yes (build + curl) | Yes |
| SC-2 | Zero ASQA compliance risk | Content blocklist grep returns zero matches across all built HTML | Yes (grep) + manual legal review | Yes |
| SC-3 | Core Web Vitals pass on all pages | Lighthouse CI: LCP < 2.5 s, CLS < 0.1, INP < 200 ms, Performance >= 90 | Yes (Lighthouse CI) | Yes |
| SC-4 | WCAG 2.2 AA accessibility | axe-core: zero critical and zero serious violations on all Phase 1 pages | Yes (axe-core) + manual spot check | Yes |
| SC-5 | Acquisition enquiry form works end-to-end | Form submits, Turnstile validates, confirmation displays, submission received | Partial (Playwright) + manual smoke test | Yes |
| SC-6 | Brand directory renders all brands | Published brand count matches rendered count; detail pages return HTTP 200 | Yes (count + parse) | Yes |
| SC-7 | Structured data validates | Organisation and BreadcrumbList JSON-LD pass schema validation with zero errors | Yes (JSON parse + schema check) + manual Google Rich Results | Yes |

---

## 8. Dependencies

### 8.1 Content Dependencies (from TIC)

| Dependency | Required For | Impact If Missing |
|------------|-------------|-------------------|
| Brand content: names, logos, descriptions, regions, service areas for all group brands | REQ-003, REQ-004, REQ-008 | Brand directory launches with gaps, undermining group credibility |
| Leadership content: names, titles, headshots, bios | REQ-002 | About page leadership section is incomplete or omitted |
| Documentary-style photography or commissioned photoshoot | REQ-041 | Design falls back to illustration or curated stock, reducing editorial quality |
| Acquisition page copy: value proposition, process details, seller FAQ content | REQ-005 | Acquisitions page lacks the trust-building content critical for Persona 1 |
| Legal/utility page content: privacy policy, terms, cookie policy text | REQ-007 | Utility pages launch with placeholder content |
| Form submission destination: email addresses or endpoints for each form type | REQ-014 through REQ-019 | Forms build but submissions go nowhere |
| Confidential enquiry form requirements: specific fields, disclaimers, privacy commitments | REQ-014 | High-stakes interaction may lack required legal protections |

### 8.2 Infrastructure Dependencies

| Dependency | Required For | Impact If Missing |
|------------|-------------|-------------------|
| Domain DNS on Cloudflare (or migration to Cloudflare) | REQ-034, REQ-036 | Deployment timeline slips; staging-only launch |
| Cloudflare Turnstile site key and secret key | REQ-018 | Forms have no spam protection |
| Email relay or Mailchannels configuration | REQ-019 | Form submissions cannot be delivered |
| Cloudflare Pages project created and connected to GitHub repo | REQ-034 | No deployment pipeline |

### 8.3 Legal/Compliance Dependencies

| Dependency | Required For | Impact If Missing |
|------------|-------------|-------------------|
| ASQA compliance legal review and sign-off | REQ-011 | Site may still carry compliance risk despite automated checks |
| Confirmation of TIC's current RTO registration status | REQ-011, REQ-013 | Specific compliance actions cannot be determined |
| Content audit of existing site for VET/training language | REQ-013 | Old URLs may still be accessible with non-compliant content |

---

## 9. Open Questions

### Inherited from Problem Definition

1. **RTO status clarity:** Is TIC currently a registered RTO, or has it fully divested its RTO registration? The answer changes the specific ASQA compliance actions required.
2. **Existing content audit:** Has anyone catalogued which pages on the current site contain VET/training delivery language?
3. **Brand count and readiness:** How many brands are in the TIC group today, and do all have the content required by the `brands/*.md` schema?
4. **Photography assets:** Does TIC have existing documentary-style photography, or does a photoshoot need to be commissioned? What is the timeline for asset delivery?
5. **Form submission backend:** Where should form submissions go? Email? CRM? Shared inbox?
6. **Leadership content:** Does the About page require headshots, bios, and titles? How many people, and are assets available?
7. **Acquisition enquiry confidentiality:** Are there specific fields, disclaimers, or privacy commitments beyond standard form handling?
8. **Redirect strategy:** When the existing site is replaced, what happens to old URLs? Is a 301 redirect map required?
9. **Analytics baseline:** Are there existing analytics that need to be preserved or migrated, or is Cloudflare Web Analytics a fresh start?
10. **Legal review process:** Who signs off that the final site content is ASQA-compliant?
11. **Services preview scope:** What content appears in the home page "services preview" given full services pages are Phase 2?
12. **Insights preview scope:** What content appears in the home page "insights preview" pre-Phase 2?

### Surfaced During PRD Development

13. **Brand detail page depth:** How much body content is expected per brand beyond the frontmatter fields? Is a paragraph sufficient, or do brands need multi-section detail pages?
14. **Contact page form UX:** Should the four form types on `/contact/` be presented as tabs, a dropdown selector, or separate sections on a single page?
15. **Thank-you page personalisation:** Beyond the form-type query parameter, should the confirmation include the submitter's name or reference number?
16. **Cookie consent mechanism:** The cookie policy page is in scope, but is a cookie consent banner/modal also required? Cloudflare Web Analytics is cookie-free, but Turnstile may set cookies.
17. **Social media links:** The `site.json` includes LinkedIn. Are there other social profiles to include in the footer?
18. **Favicon and app icons:** Are brand assets available for favicon, Apple touch icon, and OG image fallback?

---

## 10. Phase Boundaries

### Phase 1 — Current Scope (Ship Independently)

**Pages:**
- Home (`/`)
- About (`/about/`)
- Our Group (`/our-group/`)
- Brand detail pages (`/our-group/:slug/`)
- Acquisitions (`/acquisitions/`)
- Contact (`/contact/`)
- Privacy Policy (`/privacy-policy/`)
- Terms (`/terms/`)
- Cookie Policy (`/cookie-policy/`)
- Accessibility Statement (`/accessibility/`)
- HTML Sitemap (`/sitemap/`)
- 404 page (`/404.html`)
- Thank You (`/thank-you/`)

**Active collection:** `brands/*.md` only.

**Features:**
- Full brand directory with detail pages (REQ-003, REQ-004, REQ-008, REQ-009)
- Four form types with Turnstile protection (REQ-014 through REQ-021)
- Organisation + BreadcrumbList JSON-LD (REQ-028, REQ-029)
- WCAG 2.2 AA compliance (REQ-022, REQ-023)
- Core Web Vitals compliance (REQ-024 through REQ-027)
- ASQA-compliant content with automated blocklist (REQ-011, REQ-012, REQ-013)
- Cloudflare Web Analytics (REQ-044)
- Responsive mobile-first design (REQ-038)
- Dark/light section design system (REQ-039, REQ-040)
- Security headers (REQ-035)
- CI eval pipeline covering all seven success criteria (REQ-037)

**Built but empty (forward-compatible):**
- `src/services/` — schema defined, no published content
- `src/insights/` — schema defined, no published content
- `src/case-studies/` — schema defined, no published content
- Home page services/insights sections are static teasers, not links to empty pages

**Phase 1 rules:**
- The site must be fully functional and valuable with only Phase 1 content.
- No broken links to Phase 2 content.
- Teasers, not stubs: home page previews for services/insights are static sections or omitted.

### Phase 2 — Deferred (Architecture Accommodates)

**New pages:**
- Services hub (`/services/`) and detail pages (`/services/:slug/`)
- Insights/blog hub (`/insights/`) and article pages (`/insights/:slug/`)
- Case studies hub (`/case-studies/`) and detail pages (`/case-studies/:slug/`)

**Requirements deferred:** Services content, insights content, case studies content, RSS feed activation.

**Architecture provisions built in Phase 1:** Content schemas defined, collection-level JSON files created, navigation data extensible, base layout supports new page types, collection definitions commented out in `.eleventy.js`.

### Phase 3 — Deferred (Architecture Accommodates)

**New features:**
- Interactive portfolio map (Alpine.js + brand data as JSON)
- Acquisition fit self-check (multi-step form)
- Service maturity quiz (multi-step form)
- Advanced brand directory filters (Alpine.js, filter by region/service area)
- Bookkeeping/accounting service pages (pending business validation)

**Architecture provisions built in Phase 1:** Brand data includes `region` and `service_areas` fields for client-side filtering. Alpine.js is in the approved stack. Interactive components can be added as new partials.

---

## 11. Technical Architecture Summary

This PRD defers to the full architecture document (`artifacts/tic-group-website/architecture.md`) for implementation details. Key decisions are summarised here for reference:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Static site generator | 11ty (Eleventy) | Mandated constraint. Markdown-driven content model, Nunjucks templating, excellent performance. |
| Hosting | Cloudflare Pages | Mandated constraint. Branch previews, edge delivery, integrated Workers/Functions. |
| Templating | Nunjucks | Consistent with 11ty ecosystem. Inheritance, partials, macros. |
| Client-side JS | Vanilla JS + Alpine.js (conditional) | Minimal overhead. Alpine.js only if justified by interactive component count. |
| Motion | GSAP (conditional) | Controlled animation. Loaded only on pages that use it. |
| Forms | Cloudflare Pages Functions + Turnstile | Serverless form handler. Spam protection without user friction. |
| CSS | Vanilla CSS with custom properties | No build step dependency. Design tokens for consistency. |
| Images | 11ty Image plugin | Responsive images, WebP/AVIF, automated optimisation. |
| Analytics | Cloudflare Web Analytics | Cookie-free, privacy-friendly, integrated with hosting platform. |
| CI/CD | GitHub Actions + Cloudflare Pages | Automated eval pipeline gates production deploys. |

---

## Appendix A: Eval Tooling

| Tool | Purpose | Install Command |
|------|---------|-----------------|
| `@lhci/cli` | Lighthouse CI for performance evals | `npm install -D @lhci/cli` |
| `@axe-core/playwright` | Accessibility scanning via Playwright | `npm install -D @axe-core/playwright` |
| `playwright` | End-to-end form testing | `npm install -D playwright` |
| `jsdom` | JSON-LD extraction and parsing | `npm install -D jsdom` |
| `glob` | File matching for build-time checks | `npm install -D glob` |

## Appendix B: Test Data Requirements

| Requirement | Details |
|-------------|---------|
| Brand fixtures | Minimum 3 `brands/*.md` with `status: published` and 1 with `status: draft` |
| Form test data | Name, email, phone, business name, message using test values |
| Turnstile test keys | `1x00000000000000000000AA` (always passes) for CI |
| Compliance blocklist | Maintained in `evals/compliance-blocklist.txt`, one pattern per line |
