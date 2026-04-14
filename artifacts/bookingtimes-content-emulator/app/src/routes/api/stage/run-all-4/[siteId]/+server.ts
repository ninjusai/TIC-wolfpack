/**
 * Stage 4 "Run All" Orchestration — POST /api/stage/run-all-4/:siteId
 *
 * Runs the entire Stage 4 (Design) pipeline in sequence:
 *   1. Generate Blueprints
 *   2. Generate Section Specs (for all blueprints)
 *   3. Generate CSS Decisions
 *   4. Generate JSON-LD Specs
 *   5. Complete Stage 4
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateBlueprints } from '$lib/server/blueprint-generator';
import { generateAllSectionSpecs } from '$lib/server/section-spec-generator';
import { assignCssTiers } from '$lib/server/css-tier-engine';
import { generateJsonLdSpecs } from '$lib/server/jsonld-spec-generator';
import { completeStage4 } from '$lib/server/stage-checkpoints';
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

  // Step 1: Generate Blueprints
  const blueprintResult = await runStep('Generate Blueprints', () => generateBlueprints(siteId));
  steps.push(blueprintResult);

  // Step 2: Generate Section Specs for all blueprints (depends on blueprints)
  if (blueprintResult.status === 'done') {
    const specResult = await runStep('Generate Section Specs', () => generateAllSectionSpecs(siteId));
    steps.push(specResult);
  } else {
    steps.push({ name: 'Generate Section Specs', status: 'skipped', duration: 0, error: 'Skipped — blueprint generation failed' });
  }

  // Step 3: Generate CSS Decisions (depends on section specs)
  const specsExist = steps.find((s) => s.name === 'Generate Section Specs');
  if (specsExist && specsExist.status === 'done') {
    const cssResult = await runStep('Generate CSS Decisions', () => assignCssTiers(siteId));
    steps.push(cssResult);
  } else {
    steps.push({ name: 'Generate CSS Decisions', status: 'skipped', duration: 0, error: 'Skipped — section spec generation failed or was skipped' });
  }

  // Step 4: Generate JSON-LD Specs (depends on blueprints)
  if (blueprintResult.status === 'done') {
    const jsonldResult = await runStep('Generate JSON-LD Specs', () => generateJsonLdSpecs(siteId));
    steps.push(jsonldResult);
  } else {
    steps.push({ name: 'Generate JSON-LD Specs', status: 'skipped', duration: 0, error: 'Skipped — blueprint generation failed' });
  }

  // Step 5: Complete Stage 4
  const completeResult = await runStep('Complete Stage 4', () => completeStage4(siteId));
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
