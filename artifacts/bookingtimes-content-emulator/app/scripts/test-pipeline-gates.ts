/**
 * Test script for pipeline stage gate enforcement.
 *
 * Run from app/ directory:
 *   npx tsx scripts/test-pipeline-gates.ts
 *
 * Tests the core gate logic directly (no HTTP server needed).
 */

import { advanceSiteStage, canAdvance, getPipelineStatus } from '../src/lib/server/pipeline-gates';
import db from '../src/lib/db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

// --- Setup: reset all sites to not_started for a clean test ---
console.log('\n=== Pipeline Stage Gate Tests ===\n');
console.log('Resetting all sites to not_started...');
db.prepare("UPDATE sites SET pipeline_stage = 'not_started', updated_at = datetime('now')").run();

// --- Test 1: Get initial status ---
console.log('\n--- Test 1: Initial status (all sites should be not_started) ---');
const status = getPipelineStatus();
console.log(`  Found ${status.length} sites`);
assert(status.length > 0, 'At least one site exists');
assert(status.every((s) => s.currentStage === 'not_started'), 'All sites are not_started');
assert(status.every((s) => s.canAdvance === true), 'All sites can advance');
assert(status.every((s) => s.nextStage === 'stage_1'), 'Next stage is stage_1 for all');

const testSiteId = status[0].siteId;
console.log(`  Using site id=${testSiteId} (${status[0].siteName}) for remaining tests`);

// --- Test 2: Advance site to stage_1 (should succeed) ---
console.log('\n--- Test 2: Advance to stage_1 ---');
const r1 = advanceSiteStage(testSiteId);
assert(r1.success === true, 'Transition not_started → stage_1 succeeds');
assert(r1.fromStage === 'not_started', 'fromStage is not_started');
assert(r1.toStage === 'stage_1', 'toStage is stage_1');

// --- Test 3: Try to skip to stage_3 (should fail — can't skip) ---
console.log('\n--- Test 3: Try to skip to stage_3 (should fail) ---');
// The advanceSiteStage only advances one step, so calling it would go to stage_2, not stage_3.
// To test "no skipping", we verify canAdvance returns stage_2 as the next stage, not stage_3.
const checkAfterStage1 = canAdvance(testSiteId);
assert(checkAfterStage1.canAdvance === true, 'Site can advance from stage_1');
const statusAfterStage1 = getPipelineStatus().find((s) => s.siteId === testSiteId)!;
assert(statusAfterStage1.nextStage === 'stage_2', 'Next stage is stage_2 (cannot skip to stage_3)');

// --- Test 4: Advance site to stage_2 (should succeed) ---
console.log('\n--- Test 4: Advance to stage_2 ---');
const r2 = advanceSiteStage(testSiteId);
assert(r2.success === true, 'Transition stage_1 → stage_2 succeeds');
assert(r2.fromStage === 'stage_1', 'fromStage is stage_1');
assert(r2.toStage === 'stage_2', 'toStage is stage_2');

// --- Test 5: Advance through remaining stages ---
console.log('\n--- Test 5: Advance through stage_3, stage_4, stage_5, maintaining ---');
const r3 = advanceSiteStage(testSiteId);
assert(r3.success && r3.toStage === 'stage_3', 'stage_2 → stage_3');

const r4 = advanceSiteStage(testSiteId);
assert(r4.success && r4.toStage === 'stage_4', 'stage_3 → stage_4');

const r5 = advanceSiteStage(testSiteId);
assert(r5.success && r5.toStage === 'stage_5', 'stage_4 → stage_5');

const r6 = advanceSiteStage(testSiteId);
assert(r6.success && r6.toStage === 'maintaining', 'stage_5 → maintaining');

// --- Test 6: Try to advance past maintaining (should fail) ---
console.log('\n--- Test 6: Cannot advance past maintaining ---');
const r7 = advanceSiteStage(testSiteId);
assert(r7.success === false, 'Cannot advance past maintaining');
assert(r7.error !== undefined, 'Error message provided');

const checkMaintaining = canAdvance(testSiteId);
assert(checkMaintaining.canAdvance === false, 'canAdvance returns false at maintaining');

// --- Test 7: Non-existent site ---
console.log('\n--- Test 7: Non-existent site ---');
const r8 = advanceSiteStage(99999);
assert(r8.success === false, 'Non-existent site fails');
assert(r8.error!.includes('not found'), 'Error mentions not found');

const checkMissing = canAdvance(99999);
assert(checkMissing.canAdvance === false, 'canAdvance returns false for missing site');

// --- Test 8: Verify scribe checkpoints were created ---
console.log('\n--- Test 8: Scribe checkpoints ---');
const checkpoints = db
  .prepare(
    "SELECT * FROM scribe_checkpoints WHERE site_id = ? AND checkpoint_type = 'stage_complete' ORDER BY id"
  )
  .all(testSiteId) as Array<{ stage: string }>;
assert(checkpoints.length === 6, `6 checkpoints created (got ${checkpoints.length})`);
const expectedStages = ['not_started', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5'];
assert(
  checkpoints.every((cp, i) => cp.stage === expectedStages[i]),
  'Checkpoint stages are in correct order'
);

// --- Cleanup: reset test site ---
console.log('\n--- Cleanup ---');
db.prepare("UPDATE sites SET pipeline_stage = 'not_started', updated_at = datetime('now') WHERE id = ?").run(
  testSiteId
);
db.prepare("DELETE FROM scribe_checkpoints WHERE site_id = ? AND checkpoint_type = 'stage_complete'").run(
  testSiteId
);
console.log('  Reset test site to not_started and cleaned up checkpoints');

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
