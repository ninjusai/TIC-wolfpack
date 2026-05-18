// Lighthouse CI config - SC-3 / EVL-P2-005/6/7 / WRK-TIC-P2-023
//
// Drives Lighthouse runs against the full Phase 2 route surface. Targets per
// the Phase 2 build plan and the parent eval spec:
//   - Performance >= 90
//   - LCP < 2.5s
//   - CLS < 0.1
//   - INP < 200ms (Lighthouse 12+ reports Interaction to Next Paint)
//   - Accessibility >= 100, zero critical / serious axe-core violations
//
// Run mode: static. We assume `_site` has already been built. A simple
// static file server is started on port 8080 (configurable via
// LHCI_PORT env var) and Lighthouse runs against it.
//
// Usage:
//   npm i -g @lhci/cli  (one-time install on the runner)
//   npx eleventy
//   lhci autorun --config=evals/lighthouserc.js
//
// In CI: see .github/workflows/lighthouse.yml (Phase 2E follow-up).
//
// NOTE: this file deliberately contains zero U+2014 characters per CR-1.

const PORT = process.env.LHCI_PORT || "8080";
const HOST = `http://localhost:${PORT}`;

// Full Phase 2 route surface per eval-spec-phase2.md section 2.
const ROUTES = [
  "/",
  "/about/",
  "/our-group/",
  "/our-group/affordable-driving-school/",
  "/our-group/easyas-driver-training/",
  "/our-group/learners-driver-training/",
  "/our-group/metro-driving-school/",
  "/our-group/rac-school-of-motoring/",
  "/our-group/driving-instructor-car-hire/",
  "/acquisitions/",
  "/industry-services/",
  "/agencies/",
  "/instructor-opportunities/",
  "/contact/",
  "/privacy-policy/",
  "/terms/",
  "/cookie-policy/",
  "/accessibility/",
  "/thank-you/",
];

module.exports = {
  ci: {
    collect: {
      // Start static server pointing at _site, then run Lighthouse.
      staticDistDir: "./_site",
      url: ROUTES.map((r) => `${HOST}${r}`),
      // Three runs per page, take median - LHCI default.
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        chromeFlags: "--headless=new --no-sandbox --disable-gpu",
      },
    },
    assert: {
      assertions: {
        // Phase 2 performance / vitals targets.
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 1.0 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        // INP shows as "interactive" in LH desktop; total blocking time is a
        // close static-context proxy and is the recommended LHCI assertion.
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
      },
    },
    upload: {
      // Local filesystem only. CI may swap to temporary-public-storage.
      target: "filesystem",
      outputDir: "./evals/lighthouse-reports",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
};
