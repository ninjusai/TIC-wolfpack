/**
 * Global test setup for PeakProtocol eval harness.
 *
 * Configures the test environment before any test file runs.
 * API tests require a running dev server at API_BASE_URL
 * (default: http://localhost:8787). Start it with:
 *
 *   cd peakprotocol/packages/api && npx wrangler dev --local
 *
 * Unit tests import pure functions directly and need no server.
 */

// Validate environment for API tests (skipped for unit-only runs)
beforeAll(() => {
  const baseUrl = process.env["API_BASE_URL"];
  if (!baseUrl) {
    console.warn(
      "[setup] API_BASE_URL not set. API integration tests will use http://localhost:8787",
    );
  }
});
