---
title: "TIC Group Website — Site Architecture"
version: "1.0.0"
status: draft
date: "2026-04-11"
author: architect
project: tic-group-website
problem-ref: PRB-tic-group-website-001
---

# TIC Group Website — Site Architecture

This document defines the 11ty project structure, content model, template architecture, data flow, deployment configuration, form handling, and phase boundaries for the TIC Group Website rebuild.

---

## 1. 11ty Project Structure

```
tic-group-website/
├── .eleventy.js                  # 11ty config (collections, filters, plugins, passthrough)
├── .github/
│   └── workflows/
│       ├── build.yml             # CI: build + eval checks
│       └── deploy.yml            # CD: Cloudflare Pages deploy + post-deploy evals
├── evals/
│   ├── compliance-blocklist.txt  # ASQA blocklist patterns
│   ├── compliance-check.sh       # SC-2 grep check
│   ├── brand-check.sh            # SC-6 brand count check
│   ├── structured-data-check.js  # SC-7 JSON-LD validation
│   └── lighthouserc.js           # SC-3 Lighthouse CI config
├── functions/                    # Cloudflare Pages Functions (serverless)
│   └── api/
│       └── submit.js             # Form submission handler
├── src/
│   ├── _data/                    # 11ty global data files
│   │   ├── site.json             # Site metadata (name, url, description, social)
│   │   ├── navigation.json       # Primary + footer nav structure
│   │   ├── organisation.json     # Organisation JSON-LD data
│   │   └── env.js                # Environment-aware config (dev/staging/prod)
│   ├── _includes/
│   │   ├── layouts/
│   │   │   ├── base.njk          # HTML shell: <head>, skip-link, header, main, footer, scripts
│   │   │   ├── page.njk          # Standard page layout (extends base)
│   │   │   ├── brand.njk         # Brand detail page layout (extends base)
│   │   │   └── utility.njk       # Utility/legal page layout (extends base)
│   │   ├── partials/
│   │   │   ├── header.njk        # Site header + navigation
│   │   │   ├── footer.njk        # Site footer + nav + legal links
│   │   │   ├── seo.njk           # Meta tags, OG tags, canonical
│   │   │   ├── json-ld.njk       # JSON-LD structured data (Organisation + Breadcrumb)
│   │   │   ├── breadcrumb.njk    # Visual breadcrumb component
│   │   │   ├── analytics.njk     # Cloudflare Web Analytics snippet
│   │   │   └── turnstile.njk     # Cloudflare Turnstile widget partial
│   │   └── components/
│   │       ├── hero.njk          # Hero section (title, subtitle, CTA, image)
│   │       ├── proof-strip.njk   # Metrics/proof bar (number + label pairs)
│   │       ├── brand-card.njk    # Brand card for directory grid
│   │       ├── pillar-block.njk  # Acquire/Operate/Support block
│   │       ├── process-steps.njk # Numbered process steps (acquisitions)
│   │       ├── faq-accordion.njk # Expandable FAQ section
│   │       ├── cta-section.njk   # Call-to-action band
│   │       ├── form-field.njk    # Reusable form field (label + input + error)
│   │       └── section.njk       # Generic dark/light section wrapper
│   ├── brands/                   # Content collection: brands/*.md
│   │   ├── brands.json           # Collection-level defaults (layout, tags, permalink)
│   │   ├── example-driving-school.md
│   │   └── another-brand.md
│   ├── pages/                    # Core pages
│   │   ├── index.njk             # Home
│   │   ├── about.njk             # About
│   │   ├── our-group.njk         # Our Group (brand directory)
│   │   ├── acquisitions.njk      # Acquisitions
│   │   └── contact.njk           # Contact
│   ├── utility/                  # Utility/legal pages
│   │   ├── privacy-policy.md     # Privacy Policy
│   │   ├── terms.md              # Terms
│   │   ├── cookie-policy.md      # Cookie Policy
│   │   ├── accessibility.md      # Accessibility Statement
│   │   ├── sitemap.njk           # HTML Sitemap
│   │   ├── 404.njk               # 404 page
│   │   └── thank-you.njk         # Form confirmation
│   ├── assets/
│   │   ├── css/
│   │   │   ├── main.css          # Primary stylesheet
│   │   │   └── utilities.css     # Utility classes
│   │   ├── js/
│   │   │   ├── main.js           # Primary JS (nav toggle, scroll, Turnstile init)
│   │   │   └── faq.js            # FAQ accordion (Alpine.js or vanilla)
│   │   ├── images/               # Optimised images (processed by 11ty Image plugin)
│   │   └── fonts/                # Self-hosted web fonts
│   ├── feed.njk                  # (Phase 2 placeholder — RSS/Atom feed)
│   └── robots.txt.njk            # Robots.txt (template to set env-aware rules)
├── package.json
├── .nvmrc                        # Node version pin
├── wrangler.toml                 # Cloudflare Pages/Workers config
└── README.md
```

---

## 2. Content Model

### 2.1 Brands (Phase 1 — Active Collection)

**File location:** `src/brands/*.md`

**Collection-level defaults** (`src/brands/brands.json`):
```json
{
  "layout": "layouts/brand.njk",
  "tags": "brands",
  "permalink": "/our-group/{{ page.fileSlug }}/"
}
```

**Frontmatter schema:**
```yaml
---
title: "Example Driving School"          # Required. Brand display name.
region: "Queensland"                      # Required. Primary operating region.
service_areas:                            # Required. List of service areas.
  - "Brisbane"
  - "Gold Coast"
brand_summary: >                          # Required. 1-2 sentence summary.
  A premier driving school serving
  South East Queensland since 2005.
website_url: "https://example.com.au"     # Optional. External brand website.
featured_image: "/assets/images/brands/example.jpg"  # Optional. Hero/card image.
logo: "/assets/images/brands/example-logo.svg"       # Optional. Brand logo.
status: "published"                       # Required. "published" | "draft"
order: 1                                  # Required. Display order in directory.
date_acquired: "2024-06"                  # Optional. Acquisition date.
---

<!-- Body content: Extended brand description, rendered on the brand detail page. -->
```

### 2.2 Pages (Phase 1)

Core pages use Nunjucks templates directly (not markdown) because they have complex, section-based layouts. Frontmatter in `.njk` files defines metadata:

```yaml
---
title: "About TIC Group"
description: "Who we are, our story, leadership, and operating model."
layout: "layouts/page.njk"
permalink: "/about/"
seo:
  title: "About Us — TIC Group"
  description: "Learn about TIC Group's mission to acquire, operate, and support driving school businesses across Australia."
---
```

### 2.3 Utility Pages

Legal/utility pages use markdown with the `utility` layout:

```yaml
---
title: "Privacy Policy"
layout: "layouts/utility.njk"
permalink: "/privacy-policy/"
eleventyExcludeFromCollections: true
---
```

### 2.4 Future Content Types (Schema Defined, Not Built in Phase 1)

**Services** (`src/services/*.md` — Phase 2):
```yaml
---
title: "Fleet Management"
audience: "Driving school operators"
outcomes:
  - "Reduced vehicle downtime"
  - "Lower total cost of ownership"
features:
  - "Scheduled maintenance tracking"
  - "Replacement vehicle coordination"
cta: "Enquire about fleet management"
status: "draft"
order: 1
---
```

**Insights** (`src/insights/*.md` — Phase 2):
```yaml
---
title: "Why Driving School Owners Are Selling in 2026"
category: "industry"
summary: "A look at the factors driving consolidation in the Australian driving school industry."
author: "TIC Group"
published_date: 2026-03-15
related:
  - "the-acquisition-process-explained"
tags: ["insights"]
status: "draft"
---
```

**Case Studies** (`src/case-studies/*.md` — Phase 2):
```yaml
---
title: "How We Transformed ABC Driving School"
business_type: "Metropolitan driving school"
challenge: "Declining bookings and outdated systems"
intervention: "New booking platform, marketing overhaul, instructor recruitment"
outcomes:
  - "40% increase in monthly bookings"
  - "3 new instructors hired"
metrics:
  bookings_increase: 40
  instructors_added: 3
testimonial:
  quote: "TIC gave us the systems we needed to grow."
  name: "Jane Smith"
  role: "Former Owner, ABC Driving School"
status: "draft"
---
```

---

## 3. Template Architecture

### 3.1 Layout Hierarchy

```
base.njk
├── page.njk      (Home, About, Our Group, Acquisitions, Contact)
├── brand.njk     (Individual brand detail pages)
└── utility.njk   (Privacy, Terms, Cookie, Accessibility, Sitemap, 404, Thank You)
```

### 3.2 Base Layout (`base.njk`)

Responsibilities:
- `<!DOCTYPE html>` and `<html lang="en">`
- `<head>`: charset, viewport, title, `{% include "partials/seo.njk" %}`, `{% include "partials/json-ld.njk" %}`, stylesheet links, font preloads, `{% include "partials/analytics.njk" %}`
- Skip-to-content link
- `{% include "partials/header.njk" %}`
- `<main id="main-content">{% block content %}{% endblock %}</main>`
- `{% include "partials/footer.njk" %}`
- Script tags (deferred): `main.js`, Alpine.js (if used), GSAP (conditional)

### 3.3 Page Layout (`page.njk`)

Extends `base.njk`. Adds:
- Optional breadcrumb: `{% include "partials/breadcrumb.njk" %}`
- Content block renders the page template's body
- No additional structural wrapper — each page template controls its own sections

### 3.4 Brand Layout (`brand.njk`)

Extends `base.njk`. Adds:
- Breadcrumb: Home > Our Group > Brand Name
- Brand hero with featured image, title, region
- Body content from markdown
- Sidebar or inline metadata: service areas, website link, date acquired
- Back link to `/our-group/`

### 3.5 Utility Layout (`utility.njk`)

Extends `base.njk`. Adds:
- Narrow content column (max-width ~720px)
- No hero, no sidebar
- Simple typography-focused layout for legal text
- Last updated date from frontmatter

### 3.6 Key Partials

| Partial | Purpose |
|---------|---------|
| `header.njk` | Logo, primary nav from `navigation.json`, mobile menu toggle |
| `footer.njk` | Footer nav, legal links, copyright, social links |
| `seo.njk` | `<title>`, meta description, OG tags, Twitter card, canonical URL |
| `json-ld.njk` | Organisation JSON-LD on home page, BreadcrumbList on all pages |
| `breadcrumb.njk` | Visual breadcrumb trail, driven by page permalink hierarchy |
| `analytics.njk` | Cloudflare Web Analytics beacon script |
| `turnstile.njk` | Cloudflare Turnstile widget (included on form pages only) |

### 3.7 Key Components

| Component | Used On | Props/Data |
|-----------|---------|------------|
| `hero.njk` | Home, About, Acquisitions, Our Group | title, subtitle, cta_text, cta_url, image, variant (dark/light) |
| `proof-strip.njk` | Home | Array of { number, label } pairs (e.g., "12+ brands", "5 states") |
| `brand-card.njk` | Our Group | brand.data (title, region, brand_summary, featured_image, url) |
| `pillar-block.njk` | Home | pillar (Acquire/Operate/Support), description, icon |
| `process-steps.njk` | Acquisitions | Array of { step_number, title, description } |
| `faq-accordion.njk` | About, Acquisitions | Array of { question, answer } |
| `cta-section.njk` | Multiple | heading, body, cta_text, cta_url, variant |
| `form-field.njk` | Contact, Acquisitions | name, type, label, required, placeholder |
| `section.njk` | Multiple | variant (dark/light/accent), padding, id |

---

## 4. Data Flow

### 4.1 Build Pipeline

```
Source Content                  11ty Processing              Output
─────────────                   ───────────────              ──────
src/brands/*.md  ──────────┐
                           ├──> Collections (tags: "brands") ──> /our-group/:slug/index.html
src/brands/brands.json ────┘    + pagination on our-group.njk ──> /our-group/index.html

src/pages/*.njk  ──────────────> Direct template render ──────> /:slug/index.html
src/utility/*.md ──────────────> Markdown + layout render ────> /:slug/index.html
src/utility/*.njk ─────────────> Template render ─────────────> /:slug/index.html

src/_data/site.json ───────────> Global data: site.* ─────────> Available in all templates
src/_data/navigation.json ─────> Global data: navigation.* ──> header.njk, footer.njk
src/_data/organisation.json ───> Global data: organisation.* ─> json-ld.njk
src/_data/env.js ──────────────> Global data: env.* ──────────> Conditional logic (dev/prod)

src/assets/** ─────────────────> Passthrough copy ────────────> /assets/**
```

### 4.2 Collections

**`brands` collection** (the only active Phase 1 collection):

Defined in `.eleventy.js`:
```javascript
eleventyConfig.addCollection("brands", function(collectionApi) {
  return collectionApi
    .getFilteredByGlob("src/brands/*.md")
    .filter(item => item.data.status === "published")
    .sort((a, b) => (a.data.order || 999) - (b.data.order || 999));
});
```

Used in `our-group.njk`:
```nunjucks
{% for brand in collections.brands %}
  {% include "components/brand-card.njk" %}
{% endfor %}
```

### 4.3 Global Data Files

**`site.json`:**
```json
{
  "name": "TIC Group",
  "url": "https://ticgroup.com.au",
  "description": "A driving industry group that acquires, operates, and supports driving school businesses.",
  "tagline": "Acquire. Operate. Support.",
  "social": {
    "linkedin": "https://linkedin.com/company/tic-group"
  }
}
```

**`navigation.json`:**
```json
{
  "primary": [
    { "label": "About", "url": "/about/" },
    { "label": "Our Group", "url": "/our-group/" },
    { "label": "Acquisitions", "url": "/acquisitions/" },
    { "label": "Contact", "url": "/contact/" }
  ],
  "footer": [
    { "label": "Privacy Policy", "url": "/privacy-policy/" },
    { "label": "Terms", "url": "/terms/" },
    { "label": "Cookie Policy", "url": "/cookie-policy/" },
    { "label": "Accessibility", "url": "/accessibility/" },
    { "label": "Sitemap", "url": "/sitemap/" }
  ]
}
```

**`organisation.json`:**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TIC Group",
  "url": "https://ticgroup.com.au",
  "logo": "https://ticgroup.com.au/assets/images/tic-group-logo.svg",
  "description": "A driving industry group that acquires, operates, and supports driving school businesses across Australia.",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "general enquiry",
    "url": "https://ticgroup.com.au/contact/"
  }
}
```

### 4.4 Custom Filters and Shortcodes

Defined in `.eleventy.js`:

| Filter/Shortcode | Purpose |
|-------------------|---------|
| `dateFormat` filter | Format dates for display |
| `excerpt` filter | Extract first N characters of content for cards |
| `slugify` filter | Consistent URL slug generation |
| `image` shortcode | 11ty Image plugin — responsive image generation with `srcset`, `sizes`, WebP/AVIF output |
| `year` shortcode | Current year for copyright |

---

## 5. Deployment Architecture

### 5.1 Cloudflare Pages Configuration

**Build settings:**
| Setting | Value |
|---------|-------|
| Framework preset | None (custom) |
| Build command | `npx eleventy` |
| Build output directory | `_site` |
| Root directory | `/` |
| Node.js version | `20.x` (set via `.nvmrc` or environment variable) |

**Environment variables:**
| Variable | Purpose | Values |
|----------|---------|--------|
| `ELEVENTY_ENV` | Environment flag | `production` / `preview` |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile public key | Per-environment |
| `TURNSTILE_SECRET_KEY` | Turnstile server-side secret | Per-environment (secret) |
| `FORM_SUBMISSION_EMAIL` | Where form submissions are sent | Email address (secret) |

### 5.2 Branch/Preview Strategy

| Branch | Deployment | URL |
|--------|------------|-----|
| `main` | Production | `ticgroup.com.au` (custom domain) |
| `develop` | Staging | `develop.tic-group.pages.dev` |
| Feature branches | Preview | `<branch>.tic-group.pages.dev` |

Cloudflare Pages automatic preview deployments are enabled for all branches. Evals run against preview URLs before merge to `main`.

### 5.3 DNS and Domain

- Custom domain `ticgroup.com.au` pointed to Cloudflare Pages via CNAME.
- SSL/TLS managed by Cloudflare (automatic).
- `www.ticgroup.com.au` redirects to `ticgroup.com.au` (Cloudflare redirect rule).

### 5.4 Headers and Redirects

**`_site/_headers`** (generated by 11ty):
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com; frame-src https://challenges.cloudflare.com;
```

**`_site/_redirects`** (generated by 11ty):
```
# Old site redirects (populated during content audit — OQ-8)
# /old-training-page  /  301
# /courses/*           /  301
```

---

## 6. Form Handling

### 6.1 Architecture

```
Browser                    Cloudflare                     Backend
──────                     ──────────                     ───────
Form + Turnstile widget
       │
       ├──> POST /api/submit
       │         │
       │         ├──> Pages Function (functions/api/submit.js)
       │         │         │
       │         │         ├──> Verify Turnstile token (API call to Cloudflare)
       │         │         ├──> Validate form fields (server-side)
       │         │         ├──> Send email (via Mailchannels or email API)
       │         │         └──> Return 302 redirect to /thank-you/
       │         │
       │         └──> On failure: return 400 with error
       │
       └──> Redirect to /thank-you/
```

### 6.2 Form Types

| Form | Location | Fields | Submission Destination |
|------|----------|--------|----------------------|
| Confidential Acquisition Enquiry | `/acquisitions/` | name, email, phone, business_name, region, message, privacy_consent | Dedicated acquisition inbox |
| General Enquiry | `/contact/` | name, email, phone, message, privacy_consent | General inbox |
| Service Enquiry | `/contact/` | name, email, phone, business_name, service_interest, message, privacy_consent | Services inbox |
| Media/Partnerships | `/contact/` | name, email, organisation, enquiry_type, message, privacy_consent | Media inbox |

### 6.3 Cloudflare Pages Function

**`functions/api/submit.js`:**

Responsibilities:
1. Parse form data from `POST` body.
2. Verify Turnstile token via `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
3. Validate required fields server-side.
4. Determine form type from a hidden `form_type` field.
5. Route submission to appropriate recipient (email or webhook).
6. Return `302` redirect to `/thank-you/?form=<type>`.
7. On error: return `400` with JSON error response.

### 6.4 Turnstile Integration

- Turnstile widget loaded via `turnstile.njk` partial (included only on form pages).
- Widget renders inline before the submit button.
- Invisible mode preferred (managed challenge) for minimal user friction.
- Site key injected via 11ty global data (`env.js` reads environment variable).
- Secret key used only server-side in the Pages Function.

### 6.5 Thank-You Page

`/thank-you/` is a single confirmation page. The `form` query parameter customises the confirmation message:

```nunjucks
{% if query.form == "acquisition" %}
  <p>Your confidential enquiry has been received. A member of our acquisitions team will be in touch within 2 business days.</p>
{% elif query.form == "service" %}
  <p>Your service enquiry has been received. We'll be in touch shortly.</p>
{% else %}
  <p>Thank you for your message. We'll respond as soon as possible.</p>
{% endif %}
```

---

## 7. Phase Boundaries

### 7.1 Phase 1 (Current Scope — Ship Independently)

**Pages:** Home, About, Our Group, Acquisitions, Contact, Privacy Policy, Terms, Cookie Policy, Accessibility Statement, Sitemap, 404, Thank You.

**Collection:** `brands/*.md` only.

**Features:**
- Full brand directory with detail pages.
- Four form types with Turnstile protection.
- Organisation + Breadcrumb JSON-LD.
- WCAG 2.2 AA compliance.
- Core Web Vitals compliance.
- ASQA-compliant content (zero VET language).
- Cloudflare Web Analytics.
- Responsive mobile-first design.
- Dark/light section design system.

**What is built but empty:**
- `src/services/` directory exists with schema defined but no published content. Home page "services preview" is a static teaser section with hardcoded content.
- `src/insights/` directory exists with schema defined but no published content. Home page "insights preview" is a static teaser section or omitted entirely.

### 7.2 Phase 2 (Deferred — Architecture Accommodates)

**New pages:**
- `/services/` — Services hub page
- `/services/:slug/` — Individual service detail pages
- `/insights/` — Insights/blog hub
- `/insights/:slug/` — Individual insight/article pages
- `/case-studies/` — Case studies hub
- `/case-studies/:slug/` — Individual case study pages

**Architecture provisions:**
- Content schemas for `services/*.md`, `insights/*.md`, `case-studies/*.md` are defined in Phase 1.
- Collection-level `.json` files (layout, tags, permalink) are created but directories remain empty.
- Navigation data in `navigation.json` can be extended without template changes.
- Base layout and design system support new page types without modification.
- RSS/Atom feed template (`feed.njk`) is scaffolded.

**New collections in `.eleventy.js`:**
```javascript
// Phase 2 — uncomment when content is ready
// eleventyConfig.addCollection("services", ...);
// eleventyConfig.addCollection("insights", ...);
// eleventyConfig.addCollection("caseStudies", ...);
```

### 7.3 Phase 3 (Deferred — Architecture Accommodates)

**New features:**
- Interactive portfolio map (Alpine.js component, brand data as JSON)
- Acquisition fit self-check (multi-step form, client-side logic)
- Service maturity quiz (multi-step form, client-side scoring)
- Advanced brand directory filters (Alpine.js, filter by region/service area)
- Bookkeeping/accounting service pages (pending business validation)

**Architecture provisions:**
- Brand data is already structured with `region` and `service_areas` fields, enabling client-side filtering without backend changes.
- Alpine.js is in the approved stack and can be added incrementally.
- Interactive components can be added as new `components/*.njk` partials.
- No database or API changes needed — all data comes from the existing markdown content model.

### 7.4 Phase Boundary Rules

1. **Phase 1 ships alone.** The site must be fully functional and valuable with only Phase 1 content. No broken links to Phase 2 content.
2. **Teasers, not stubs.** Home page previews for services/insights are static teasers or "coming soon" sections, not links to empty pages.
3. **Schemas are forward-compatible.** Content model schemas are defined now even for Phase 2/3 content types, so content authors can begin drafting.
4. **Navigation is data-driven.** Adding Phase 2 pages to the nav requires only a `navigation.json` update, not template changes.
5. **Collections are opt-in.** Phase 2 collections are commented out in config. Uncommenting and adding content files activates them.
6. **No speculative code.** Phase 2/3 templates and components are not built in Phase 1. Only schemas and directory structures are prepared.

---

## Appendix A: 11ty Plugin Configuration

| Plugin | Purpose | Config |
|--------|---------|--------|
| `@11ty/eleventy-img` | Responsive images, WebP/AVIF generation | Widths: [300, 600, 900, 1200], formats: ['webp', 'avif', 'jpeg'] |
| `@11ty/eleventy-plugin-rss` | RSS feed generation (Phase 2) | Installed but inactive in Phase 1 |
| `eleventy-plugin-bundle` | CSS/JS bundling | Inline critical CSS, defer non-critical |
| `@11ty/eleventy-navigation` | Breadcrumb generation | Breadcrumb data from `eleventyNavigation` frontmatter key |

## Appendix B: CSS Architecture

**Approach:** Vanilla CSS with custom properties (CSS variables) for the design system.

```
src/assets/css/
├── main.css          # Imports all partials
├── reset.css         # Modern CSS reset
├── tokens.css        # Design tokens (colours, spacing, typography, breakpoints)
├── typography.css    # Base typography styles
├── layout.css        # Grid, container, section utilities
├── components.css    # Component-specific styles (hero, card, accordion, form)
└── utilities.css     # Utility classes (visually-hidden, skip-link, etc.)
```

**Design tokens example:**
```css
:root {
  /* Colours — dark/light layered sections */
  --color-bg-dark: #0a0a0a;
  --color-bg-light: #f5f5f0;
  --color-bg-accent: #1a1a2e;
  --color-text-on-dark: #f5f5f0;
  --color-text-on-light: #1a1a1a;
  --color-brand-primary: #2563eb;
  --color-brand-secondary: #f59e0b;
  
  /* Typography */
  --font-heading: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 2rem;
  --space-xl: 4rem;
  --space-2xl: 8rem;
  
  /* Container */
  --container-max: 1200px;
  --container-padding: 1.5rem;
}
```

## Appendix C: JavaScript Architecture

**Approach:** Vanilla JS as default. Alpine.js added only if multiple interactive components justify the 15KB overhead. GSAP added only for specific motion sequences (e.g., home page hero animation).

**`main.js` responsibilities:**
- Mobile navigation toggle (hamburger menu)
- Smooth scroll for anchor links
- Turnstile widget initialisation
- Form client-side validation (required fields, email format)
- Current year injection for copyright

**Conditional loading:**
```html
<!-- Alpine.js — loaded only on pages that need it -->
{% if alpine %}
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
{% endif %}

<!-- GSAP — loaded only on home page if motion is approved -->
{% if gsap %}
<script defer src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script defer src="/assets/js/animations.js"></script>
{% endif %}
```
