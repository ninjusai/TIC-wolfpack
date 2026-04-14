/**
 * Stage 1 "Run All" Orchestration — POST /api/stage/run-all-1/:siteId
 *
 * Runs the entire Stage 1 (Audit) pipeline in sequence:
 *   1. Scrape CSS
 *   2. Classify CSS
 *   3. Scrape Content
 *   4. Build Inventory
 *   5. Infer Brand Voice (Claude — may fail gracefully)
 *   6. Run SEO Audit
 *   7. Run GEO Audit
 *   8. Run Schema Audit
 *   9. Complete Stage 1
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeSiteCSS } from '$lib/server/css-scraper';
import { classifySiteCSS } from '$lib/server/css-classifier';
import { snapshotCurrentCatalogue, detectCssChanges } from '$lib/server/css-change-detector';
import { scrapeSiteContent } from '$lib/server/content-scraper';
import { inventorySite } from '$lib/server/sitemap-crawler';
import { inferBrandVoice } from '$lib/server/brand-inference';
import { auditSiteSeo } from '$lib/server/seo-auditor';
import { auditSiteGeo } from '$lib/server/geo-auditor';
import { analyzeSiteSchema } from '$lib/server/schema-detector';
import { completeStage1 } from '$lib/server/stage-checkpoints';
import db from '$lib/db';

interface StepResult {
  name: string;
  status: 'done' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  data?: unknown;
}

async function runStep(
  name: string,
  fn: () => unknown | Promise<unknown>,
  options?: { allowFailure?: boolean }
): Promise<StepResult> {
  const start = Date.now();
  try {
    const data = await fn();
    return { name, status: 'done', duration: Date.now() - start, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (options?.allowFailure) {
      return { name, status: 'skipped', duration: Date.now() - start, error };
    }
    return { name, status: 'failed', duration: Date.now() - start, error };
  }
}

export const POST: RequestHandler = async ({ params }) => {
  const siteId = Number(params.siteId);

  if (!Number.isInteger(siteId) || siteId <= 0) {
    return json(
      { error: 'siteId must be a positive integer', steps: [], overall: 'failed' },
      { status: 400 }
    );
  }

  // Look up the site URL for the CSS scrape step
  const site = db
    .prepare('SELECT id, url FROM sites WHERE id = ?')
    .get(siteId) as { id: number; url: string } | undefined;

  if (!site) {
    return json(
      { error: `Site with id ${siteId} not found`, steps: [], overall: 'failed' },
      { status: 404 }
    );
  }

  const steps: StepResult[] = [];
  let hasCriticalFailure = false;

  // Step 1: Scrape CSS
  const scrapeResult = await runStep('Scrape CSS', () => scrapeSiteCSS(site.url));
  steps.push(scrapeResult);
  if (scrapeResult.status === 'failed') hasCriticalFailure = true;

  // Step 2: Classify CSS (depends on scrape)
  if (!hasCriticalFailure) {
    const classifyResult = await runStep('Classify CSS', async () => {
      // Snapshot existing catalogue if present
      const existingCount = (
        db.prepare('SELECT COUNT(*) as cnt FROM css_audit WHERE site_id = ?').get(siteId) as { cnt: number }
      ).cnt;
      if (existingCount > 0) {
        snapshotCurrentCatalogue(siteId);
      }

      const result = await classifySiteCSS(siteId);

      // Non-fatal change detection
      if (existingCount > 0) {
        try { detectCssChanges(siteId); } catch { /* non-fatal */ }
      }

      return result;
    });
    steps.push(classifyResult);
    if (classifyResult.status === 'failed') hasCriticalFailure = true;
  } else {
    steps.push({ name: 'Classify CSS', status: 'skipped', duration: 0, error: 'Skipped — CSS scrape failed' });
  }

  // Step 3: Scrape Content (independent of CSS steps for the most part)
  const contentResult = await runStep('Scrape Content', () => scrapeSiteContent(siteId));
  steps.push(contentResult);

  // Step 4: Build Inventory
  const inventoryResult = await runStep('Build Inventory', () => inventorySite(siteId));
  steps.push(inventoryResult);

  // Step 5: Infer Brand Voice (uses Claude — allowed to fail)
  const brandResult = await runStep(
    'Infer Brand Voice',
    () => inferBrandVoice(siteId),
    { allowFailure: true }
  );
  steps.push(brandResult);

  // Step 6: Run SEO Audit (depends on content scrape)
  if (contentResult.status === 'done') {
    const seoResult = await runStep('Run SEO Audit', () => auditSiteSeo(siteId));
    steps.push(seoResult);
  } else {
    steps.push({ name: 'Run SEO Audit', status: 'skipped', duration: 0, error: 'Skipped — content scrape failed' });
  }

  // Step 7: Run GEO Audit (depends on content scrape)
  if (contentResult.status === 'done') {
    const geoResult = await runStep('Run GEO Audit', () => auditSiteGeo(siteId));
    steps.push(geoResult);
  } else {
    steps.push({ name: 'Run GEO Audit', status: 'skipped', duration: 0, error: 'Skipped — content scrape failed' });
  }

  // Step 8: Run Schema Audit (depends on content scrape)
  if (contentResult.status === 'done') {
    const schemaResult = await runStep('Run Schema Audit', () => analyzeSiteSchema(siteId));
    steps.push(schemaResult);
  } else {
    steps.push({ name: 'Run Schema Audit', status: 'skipped', duration: 0, error: 'Skipped — content scrape failed' });
  }

  // Step 9: Complete Stage 1
  const completeResult = await runStep('Complete Stage 1', () => completeStage1(siteId));
  steps.push(completeResult);

  // Determine overall status
  const failedCount = steps.filter((s) => s.status === 'failed').length;
  const skippedCount = steps.filter((s) => s.status === 'skipped').length;
  const overall = failedCount === 0 && skippedCount === 0
    ? 'complete'
    : failedCount > 0
      ? 'partial'
      : 'complete'; // skipped-only (like brand voice) is still considered complete

  // Strip verbose data from response to keep payload manageable
  const cleanSteps = steps.map(({ name, status, duration, error }) => ({
    name,
    status,
    duration,
    ...(error ? { error } : {}),
  }));

  return json({
    siteId,
    steps: cleanSteps,
    overall,
    totalDuration: steps.reduce((sum, s) => sum + s.duration, 0),
    summary: {
      done: steps.filter((s) => s.status === 'done').length,
      failed: failedCount,
      skipped: skippedCount,
    },
  });
};
