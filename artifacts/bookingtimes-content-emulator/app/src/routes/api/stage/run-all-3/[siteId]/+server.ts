/**
 * Stage 3 "Run All" Orchestration — POST /api/stage/run-all-3/:siteId
 *
 * Runs the entire Stage 3 (Gap Analysis) pipeline in sequence:
 *   1. Run Gap Analysis
 *   2. Generate Work Backlog
 *   3. Build Link Graph
 *   4. Generate Anchor Bank
 *   5. Complete Stage 3
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeGaps } from '$lib/server/gap-engine';
import { identifyMissingPages } from '$lib/server/missing-pages';
import { buildLinkGraph } from '$lib/server/link-graph';
import { generateAnchorBank } from '$lib/server/anchor-bank';
import { completeStage3 } from '$lib/server/stage-checkpoints';
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

  // Step 1: Run Gap Analysis
  const gapResult = await runStep('Run Gap Analysis', () => analyzeGaps(siteId));
  steps.push(gapResult);

  // Step 2: Generate Work Backlog (depends on gap analysis)
  if (gapResult.status === 'done') {
    const backlogResult = await runStep('Generate Work Backlog', () => identifyMissingPages(siteId));
    steps.push(backlogResult);
  } else {
    steps.push({ name: 'Generate Work Backlog', status: 'skipped', duration: 0, error: 'Skipped — gap analysis failed' });
  }

  // Step 3: Build Link Graph
  const linkResult = await runStep('Build Link Graph', () => buildLinkGraph(siteId));
  steps.push(linkResult);

  // Step 4: Generate Anchor Bank (depends on link graph)
  if (linkResult.status === 'done') {
    const anchorResult = await runStep('Generate Anchor Bank', () => generateAnchorBank(siteId));
    steps.push(anchorResult);
  } else {
    steps.push({ name: 'Generate Anchor Bank', status: 'skipped', duration: 0, error: 'Skipped — link graph failed' });
  }

  // Step 5: Complete Stage 3
  const completeResult = await runStep('Complete Stage 3', () => completeStage3(siteId));
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
