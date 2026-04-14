---
title: "TIC Group Website — Eval Specification"
version: "1.0.0"
status: draft
date: "2026-04-11"
author: architect
project: tic-group-website
problem-ref: PRB-tic-group-website-001
---

# TIC Group Website — Eval Specification

This document defines the eval-first validation framework for the TIC Group Website rebuild. Every success criterion from the problem definition (PRB-tic-group-website-001) maps to concrete, automatable tests with explicit pass/fail thresholds.

---

## Eval Categories

| Category | Purpose | When |
|----------|---------|------|
| Deployment | Site builds, deploys, all routes respond | Build + post-deploy |
| Compliance | ASQA content audit — zero VET/training language | Build + post-deploy |
| Performance | Core Web Vitals (LCP, CLS, INP) | Post-deploy |
| Accessibility | WCAG 2.2 AA via axe-core | Build + post-deploy |
| Functional | Forms, brand directory, navigation | Post-deploy |
| SEO / Structured Data | JSON-LD validates, meta tags present | Build + post-deploy |

---

## Phase 1 Routes (Test Surface)

All evals run against the following Phase 1 route set:

| Route | Page |
|-------|------|
| `/` | Home |
| `/about/` | About |
| `/our-group/` | Our Group (brand directory) |
| `/our-group/:slug/` | Brand detail (one per `brands/*.md`) |
| `/acquisitions/` | Acquisitions |
| `/contact/` | Contact |
| `/privacy-policy/` | Privacy Policy |
| `/terms/` | Terms |
| `/cookie-policy/` | Cookie Policy |
| `/accessibility/` | Accessibility Statement |
| `/sitemap/` | HTML Sitemap |
| `/404.html` | 404 page |
| `/thank-you/` | Form confirmation |

---

## SC-1: Deployment — All Phase 1 Pages Live

**What to test:** Site launches on pages.dev with all Phase 1 pages live and responding.

**How to test:**
1. Run `npx eleventy --dryrun` to verify build completes without errors.
2. After deploy, HTTP GET every route in the Phase 1 route table.
3. Verify `404.html` returns HTTP 404 (not 200).
4. Verify all other routes return HTTP 200 with non-empty HTML body.
5. Verify `sitemap.xml` exists and contains all Phase 1 URLs.

**Pass/fail threshold:**
- Build: zero errors, zero warnings from 11ty build.
- Deploy: 100% of routes return expected HTTP status codes.
- `sitemap.xml` contains all Phase 1 canonical URLs.

**When to test:**
- Build time: `eleventy --dryrun` in CI.
- Post-deploy: HTTP status checks against production URL.

**Automation:**
```yaml
# CI script (pseudo)
- name: Build check
  run: npx eleventy --dryrun

- name: Route check (post-deploy)
  run: |
    ROUTES="/ /about/ /our-group/ /acquisitions/ /contact/ /privacy-policy/ /terms/ /cookie-policy/ /accessibility/ /sitemap/ /thank-you/"
    for route in $ROUTES; do
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL$route")
      if [ "$STATUS" != "200" ]; then echo "FAIL: $route ($STATUS)"; exit 1; fi
    done
    # 404 check
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL/nonexistent-page/")
    if [ "$STATUS" != "404" ]; then echo "FAIL: 404 page ($STATUS)"; exit 1; fi
```

**Full automation potential:** Yes. Build check runs in CI on every push. Route check runs as a post-deploy step in Cloudflare Pages deploy hook or GitHub Actions.

---

## SC-2: Compliance — Zero VET/Training Language

**What to test:** Zero compliance risk — no page implies TIC delivers VET or nationally recognised training.

**How to test:**
1. Content grep across all built HTML files for a defined blocklist of terms and phrases.
2. Blocklist includes (case-insensitive):
   - `nationally recognised`
   - `registered training organisation` / `RTO`
   - `VET` (as standalone term, not substring)
   - `TLI41222` or any training package codes matching `/TLI\d+/`
   - `Certificate IV` / `Cert IV` / `Certificate 4`
   - `we train` / `we deliver training` / `training provider`
   - `enrol` / `enroll` / `enrollment` / `enrolment` (in training context)
   - `nationally accredited`
   - `qualification` / `qualifications` (in VET context)
   - `complete your` (followed by training/cert/qualification)
   - `course` (as primary offering, not in "of course")
3. Manual review pass on flagged content for false positives (e.g., "of course").

**Pass/fail threshold:**
- Zero matches against the blocklist in any built HTML file.
- Any match is a blocking failure requiring content change before deploy.

**When to test:**
- Build time: automated grep on `_site/**/*.html`.
- Pre-deploy gate: must pass before Cloudflare Pages publish.

**Automation:**
```bash
# compliance-check.sh
BLOCKLIST=(
  "nationally recognised"
  "registered training organisation"
  "\bRTO\b"
  "\bVET\b"
  "TLI[0-9]+"
  "Certificate IV"
  "Cert IV"
  "Certificate 4"
  "we train"
  "we deliver training"
  "training provider"
  "nationally accredited"
  "complete your.*(training|cert|qualification)"
)

FAIL=0
for pattern in "${BLOCKLIST[@]}"; do
  MATCHES=$(grep -riP "$pattern" _site/**/*.html 2>/dev/null)
  if [ -n "$MATCHES" ]; then
    echo "COMPLIANCE FAIL: '$pattern' found:"
    echo "$MATCHES"
    FAIL=1
  fi
done
exit $FAIL
```

**Full automation potential:** Yes. Runs in CI as a build-time gate. The blocklist is maintained as a config file (`evals/compliance-blocklist.txt`) so it can be updated without code changes.

---

## SC-3: Performance — Core Web Vitals

**What to test:** Core Web Vitals pass on all Phase 1 pages.

**How to test:**
1. Run Lighthouse CI against every Phase 1 route.
2. Extract LCP, CLS, and INP metrics.
3. Compare against thresholds.

**Pass/fail threshold:**
| Metric | Threshold | Applies to |
|--------|-----------|------------|
| LCP (Largest Contentful Paint) | < 2.5 s | All Phase 1 routes |
| CLS (Cumulative Layout Shift) | < 0.1 | All Phase 1 routes |
| INP (Interaction to Next Paint) | < 200 ms | All Phase 1 routes |
| Lighthouse Performance score | >= 90 | All Phase 1 routes |

- Any single page failing any metric is a blocking failure.

**When to test:**
- Post-deploy: Lighthouse CI against staging/preview URL.
- Post-production-deploy: Lighthouse CI against production URL.

**Automation:**
```yaml
# lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        '${DEPLOY_URL}/',
        '${DEPLOY_URL}/about/',
        '${DEPLOY_URL}/our-group/',
        '${DEPLOY_URL}/acquisitions/',
        '${DEPLOY_URL}/contact/',
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'interactive': ['error', { maxNumericValue: 200 }],
        'categories:performance': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

**Full automation potential:** Yes. Lighthouse CI runs in GitHub Actions post-deploy. Use `@lhci/cli` with the config above. Cloudflare Pages preview URLs enable testing before production publish.

---

## SC-4: Accessibility — WCAG 2.2 AA

**What to test:** WCAG 2.2 AA accessibility compliance on all Phase 1 pages.

**How to test:**
1. Run axe-core via `@axe-core/cli` or Playwright + `axe-core` against every Phase 1 route.
2. Check for critical and serious violations.
3. Verify specific WCAG 2.2 AA requirements:
   - All images have alt text.
   - Colour contrast ratios meet AA (4.5:1 normal text, 3:1 large text).
   - All interactive elements are keyboard accessible.
   - Focus indicators are visible.
   - Form inputs have associated labels.
   - ARIA attributes are valid.
   - Page has a single `<h1>`, heading hierarchy is correct.
   - Skip-to-content link is present.

**Pass/fail threshold:**
- Zero critical violations across all pages.
- Zero serious violations across all pages.
- Minor/moderate violations are logged but non-blocking for Phase 1 (must be addressed before Phase 2).

**When to test:**
- Build time: axe-core against locally-served build.
- Post-deploy: axe-core against preview/production URLs.

**Automation:**
```bash
# a11y-check.sh
npx serve _site --listen 8080 &
SERVER_PID=$!
sleep 2

ROUTES="/ /about/ /our-group/ /acquisitions/ /contact/ /privacy-policy/ /terms/ /accessibility/"

for route in $ROUTES; do
  npx @axe-core/cli "http://localhost:8080$route" \
    --tags wcag2a,wcag2aa,wcag22aa \
    --exit
  if [ $? -ne 0 ]; then
    kill $SERVER_PID
    exit 1
  fi
done

kill $SERVER_PID
```

Alternative: Playwright test suite with `@axe-core/playwright` for richer reporting and screenshot capture on failure.

**Full automation potential:** Yes. Runs in CI on every build. Playwright-based approach preferred for CI since it handles page rendering more reliably than CLI.

---

## SC-5: Functional — Acquisition Enquiry Form

**What to test:** Acquisition enquiry form works end-to-end with Turnstile validation and confirmation.

**How to test:**
1. **Form presence:** Assert the acquisition enquiry form exists on `/acquisitions/` with all required fields.
2. **Turnstile widget:** Assert Cloudflare Turnstile widget renders on form pages.
3. **Submission flow:** Submit form with valid test data, verify:
   - Turnstile token is included in submission.
   - Server responds with success (HTTP 200/302).
   - User is redirected to `/thank-you/`.
   - Thank-you page displays confirmation message.
4. **Validation:** Submit with empty required fields, verify client-side validation prevents submission.
5. **Contact page forms:** Repeat for general enquiry, service enquiry, and media/partnerships forms on `/contact/`.

**Pass/fail threshold:**
- Form exists with all required fields: PASS/FAIL.
- Turnstile widget loads: PASS/FAIL.
- Valid submission reaches confirmation: PASS/FAIL.
- Empty required fields are blocked: PASS/FAIL.
- All four form types (acquisition, general, service, media) function: PASS/FAIL.

**When to test:**
- Post-deploy: Playwright end-to-end test against preview URL.
- Cannot be fully tested at build time (requires Turnstile and server-side form handler).

**Automation:**
```javascript
// forms.spec.ts (Playwright)
test('acquisition form submits and confirms', async ({ page }) => {
  await page.goto('/acquisitions/');
  
  // Fill form
  await page.fill('[name="name"]', 'Test Owner');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="phone"]', '0400000000');
  await page.fill('[name="business_name"]', 'Test Driving School');
  await page.fill('[name="message"]', 'Interested in discussing a sale.');
  
  // Turnstile renders (check iframe exists)
  await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toBeVisible();
  
  // Submit (Turnstile bypass needed for CI — use test keys)
  await page.click('[type="submit"]');
  
  // Confirm redirect
  await page.waitForURL('**/thank-you/');
  await expect(page.locator('h1')).toContainText('Thank');
});
```

**Full automation potential:** Partially. Form presence and validation can be fully automated. End-to-end submission requires Cloudflare Turnstile test site keys in CI. The actual delivery of the submission (email/webhook) requires a manual smoke test or a test endpoint.

---

## SC-6: Functional — Brand Directory

**What to test:** Brand directory renders all brands from the markdown content model.

**How to test:**
1. Count `brands/*.md` files in the source content directory.
2. Build the site and count rendered brand entries on `/our-group/`.
3. For each brand, verify:
   - Title is rendered.
   - Region is displayed.
   - Summary text is present.
   - Link to brand detail page (`/our-group/:slug/`) works (HTTP 200).
   - Brand detail page contains correct content from frontmatter.
4. Verify brands with `status: draft` are excluded from the rendered output.

**Pass/fail threshold:**
- Count of rendered brands on `/our-group/` equals count of `brands/*.md` files with `status: published`.
- Each brand card displays title, region, and summary: PASS/FAIL.
- Each brand detail link returns HTTP 200: PASS/FAIL.
- Zero draft brands appear in production build: PASS/FAIL.

**When to test:**
- Build time: Assert against built HTML (parse and count).
- Post-deploy: Playwright test against live URL.

**Automation:**
```bash
# brand-directory-check.sh
# Count source brands
BRAND_COUNT=$(find src/brands -name "*.md" -exec grep -l "status: published" {} \; | wc -l)

# Count rendered brand cards (uses a data attribute or consistent CSS class)
RENDERED_COUNT=$(grep -c 'data-brand-card' _site/our-group/index.html)

if [ "$BRAND_COUNT" -ne "$RENDERED_COUNT" ]; then
  echo "FAIL: $BRAND_COUNT brands in source, $RENDERED_COUNT rendered"
  exit 1
fi

# Check each brand detail page exists
for brand_dir in _site/our-group/*/; do
  if [ ! -f "$brand_dir/index.html" ]; then
    echo "FAIL: Missing brand detail page: $brand_dir"
    exit 1
  fi
done
```

**Full automation potential:** Yes. Build-time validation in CI. Playwright test for post-deploy with visual regression optional.

---

## SC-7: SEO / Structured Data — JSON-LD Validation

**What to test:** Organisation and breadcrumb JSON-LD pass validation with zero errors.

**How to test:**
1. Extract all `<script type="application/ld+json">` blocks from every Phase 1 page.
2. Parse as JSON — must be valid JSON.
3. Validate Organisation schema:
   - `@type` is `Organization`.
   - Required fields present: `name`, `url`, `logo`, `description`, `contactPoint`.
   - `logo` URL is reachable (HTTP 200).
4. Validate BreadcrumbList schema:
   - `@type` is `BreadcrumbList`.
   - `itemListElement` array is non-empty.
   - Each item has `@type: ListItem`, `position`, `name`, `item` (URL).
   - Breadcrumb trail matches page hierarchy.
5. Validate against Google's Rich Results Test API (or structured-data-testing-tool).

**Pass/fail threshold:**
- Every page has valid JSON-LD (parseable, no syntax errors): PASS/FAIL.
- Home page has Organisation JSON-LD with all required fields: PASS/FAIL.
- Every page has BreadcrumbList JSON-LD matching its URL hierarchy: PASS/FAIL.
- Zero errors from schema.org validation: PASS/FAIL.
- Zero errors from Google Rich Results validator: PASS/FAIL.

**When to test:**
- Build time: Parse and validate JSON-LD from built HTML.
- Post-deploy: Google Rich Results Test (manual or API).

**Automation:**
```javascript
// structured-data-check.js
const { JSDOM } = require('jsdom');
const fs = require('fs');
const glob = require('glob');

const files = glob.sync('_site/**/*.html');
let failures = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf-8');
  const dom = new JSDOM(html);
  const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
  
  if (scripts.length === 0) {
    console.error(`FAIL: No JSON-LD found in ${file}`);
    failures++;
    continue;
  }
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      // Validate required fields based on @type
      if (data['@type'] === 'Organization') {
        for (const field of ['name', 'url', 'logo', 'description']) {
          if (!data[field]) {
            console.error(`FAIL: Organization missing '${field}' in ${file}`);
            failures++;
          }
        }
      }
      if (data['@type'] === 'BreadcrumbList') {
        if (!data.itemListElement || data.itemListElement.length === 0) {
          console.error(`FAIL: Empty BreadcrumbList in ${file}`);
          failures++;
        }
      }
    } catch (e) {
      console.error(`FAIL: Invalid JSON-LD in ${file}: ${e.message}`);
      failures++;
    }
  }
}

process.exit(failures > 0 ? 1 : 0);
```

**Full automation potential:** Yes. JSON parsing and schema validation run at build time in CI. Google Rich Results Test is manual or semi-automated via their API (rate-limited).

---

## Eval Execution Summary

| Eval | CI Automated | Manual Required | Blocking |
|------|-------------|-----------------|----------|
| SC-1 Deployment | Yes (build + curl) | No | Yes |
| SC-2 Compliance | Yes (grep blocklist) | Final legal review | Yes |
| SC-3 Performance | Yes (Lighthouse CI) | No | Yes |
| SC-4 Accessibility | Yes (axe-core) | Keyboard/screen reader spot check | Yes |
| SC-5 Forms | Partial (Playwright + test keys) | Email delivery smoke test | Yes |
| SC-6 Brand Directory | Yes (count + parse) | Visual review | Yes |
| SC-7 Structured Data | Yes (JSON parse + schema check) | Google Rich Results manual test | Yes |

---

## CI Pipeline Integration

```
Push to main/PR
  |
  +-- 11ty build (--dryrun then full build)
  |     |
  |     +-- SC-1: Build succeeds (zero errors)
  |     +-- SC-2: Compliance blocklist grep
  |     +-- SC-6: Brand count validation
  |     +-- SC-7: JSON-LD parse + schema check
  |
  +-- Serve built site locally
  |     |
  |     +-- SC-4: axe-core scan all routes
  |
  +-- Deploy to Cloudflare Pages preview
  |     |
  |     +-- SC-1: Route HTTP status checks
  |     +-- SC-3: Lighthouse CI (3 runs per page)
  |     +-- SC-5: Playwright form tests (Turnstile test keys)
  |     +-- SC-7: JSON-LD presence on live pages
  |
  +-- All pass? -> Promote to production
        |
        +-- SC-1: Production route checks
        +-- SC-3: Production Lighthouse run
        +-- Manual: SC-2 legal sign-off, SC-5 email delivery
```

---

## Test Data Requirements

| Requirement | Details |
|-------------|---------|
| Brand fixtures | Minimum 3 `brands/*.md` files with `status: published` and 1 with `status: draft` for testing exclusion |
| Form test data | Name, email, phone, business name, message — using test values |
| Turnstile test keys | Cloudflare provides [test site keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) for CI: `1x00000000000000000000AA` (always passes) |
| Compliance blocklist | Maintained in `evals/compliance-blocklist.txt`, one pattern per line |

---

## Tooling Dependencies

| Tool | Purpose | Install |
|------|---------|---------|
| `@lhci/cli` | Lighthouse CI | `npm install -D @lhci/cli` |
| `@axe-core/cli` or `@axe-core/playwright` | Accessibility scanning | `npm install -D @axe-core/playwright` |
| `playwright` | End-to-end form testing | `npm install -D playwright` |
| `jsdom` | JSON-LD extraction and parsing | `npm install -D jsdom` |
| `glob` | File matching for build-time checks | `npm install -D glob` |
