/**
 * Stage 2 "Run All" Orchestration — POST /api/stage/run-all-2/:siteId
 *
 * Runs the entire Stage 2 (Benchmark) pipeline in sequence:
 *   1. Seed SEO Benchmarks
 *   2. Seed GEO Benchmarks
 *   3. Seed Schema Benchmarks
 *   4. Build Taxonomy (with silo definitions for this site)
 *   5. Complete Stage 2
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedSeoBenchmarks } from '$lib/server/seo-benchmarks';
import { seedGeoBenchmarks } from '$lib/server/geo-benchmarks';
import { seedSchemaBenchmarks } from '$lib/server/schema-benchmarks';
import { seedPageTaxonomy, seedSiloDefinitions } from '$lib/server/taxonomy-silo';
import { completeStage2 } from '$lib/server/stage-checkpoints';
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

  // Validate site exists
  const site = db
    .prepare('SELECT id FROM sites WHERE id = ?')
    .get(siteId) as { id: number } | undefined;

  if (!site) {
    return json(
      { error: `Site with id ${siteId} not found`, steps: [], overall: 'failed' },
      { status: 404 }
    );
  }

  const steps: StepResult[] = [];

  // Step 1: Seed SEO Benchmarks
  const seoResult = await runStep('Seed SEO Benchmarks', () => seedSeoBenchmarks());
  steps.push(seoResult);

  // Step 2: Seed GEO Benchmarks
  const geoResult = await runStep('Seed GEO Benchmarks', () => seedGeoBenchmarks());
  steps.push(geoResult);

  // Step 3: Seed Schema Benchmarks
  const schemaResult = await runStep('Seed Schema Benchmarks', () => seedSchemaBenchmarks());
  steps.push(schemaResult);

  // Step 4: Build Taxonomy (page taxonomy + silo definitions for this site)
  const taxonomyResult = await runStep('Build Taxonomy', () => {
    const taxResult = seedPageTaxonomy();
    const siloResult = seedSiloDefinitions(siteId);
    return { taxonomy: taxResult, silos: siloResult };
  });
  steps.push(taxonomyResult);

  // Step 5: Complete Stage 2
  const completeResult = await runStep('Complete Stage 2', () => completeStage2());
  steps.push(completeResult);

  // Determine overall status
  const failedCount = steps.filter((s) => s.status === 'failed').length;
  const skippedCount = steps.filter((s) => s.status === 'skipped').length;
  const overall = failedCount === 0 ? 'complete' : 'partial';

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
