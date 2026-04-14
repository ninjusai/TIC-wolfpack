/**
 * Integration Test Runner — WRK-BCE2-052
 *
 * Runs all cross-layer integration tests and produces a summary report.
 * Execute with: npx tsx tests/integration/run-all.ts
 *
 * Or run individual tests:
 *   npx tsx tests/integration/01-stage-gate-transitions.test.ts
 *   npx tsx tests/integration/02-feedback-creates-rules.test.ts
 *   npx tsx tests/integration/03-export-validation.test.ts
 *   npx tsx tests/integration/04-preview-css-site-isolation.test.ts
 *   npx tsx tests/integration/05-multi-site-isolation.test.ts
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

const TEST_DIR = __dirname;
const TEST_FILES = [
  '01-stage-gate-transitions.test.ts',
  '02-feedback-creates-rules.test.ts',
  '03-export-validation.test.ts',
  '04-preview-css-site-isolation.test.ts',
  '05-multi-site-isolation.test.ts',
];

interface SuiteResult {
  name: string;
  passed: boolean;
  output: string;
}

const results: SuiteResult[] = [];

console.log('\n' + '='.repeat(70));
console.log('  BCE V2.1 — Cross-Layer Integration Tests (WRK-BCE2-052)');
console.log('='.repeat(70) + '\n');

for (const file of TEST_FILES) {
  const filePath = path.join(TEST_DIR, file);
  const name = file.replace('.test.ts', '');

  try {
    const output = execSync(`npx tsx "${filePath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.resolve(TEST_DIR, '../../app'),
      timeout: 30000,
      env: { ...process.env, NODE_PATH: path.resolve(TEST_DIR, '../../app/node_modules') },
    });
    results.push({ name, passed: true, output });
    console.log(`  [SUITE PASS] ${name}`);
  } catch (err) {
    const output = (err as { stdout?: string; stderr?: string }).stdout ?? '';
    const stderr = (err as { stdout?: string; stderr?: string }).stderr ?? '';
    results.push({ name, passed: false, output: output + stderr });
    console.log(`  [SUITE FAIL] ${name}`);
  }
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('  OVERALL SUMMARY');
console.log('='.repeat(70));

const totalPassed = results.filter(r => r.passed).length;
const totalFailed = results.filter(r => !r.passed).length;

console.log(`  Suites: ${totalPassed} passed, ${totalFailed} failed, ${results.length} total`);

if (totalFailed > 0) {
  console.log('\n  Failed suites:');
  for (const r of results.filter(r => !r.passed)) {
    console.log(`    - ${r.name}`);
  }
}

console.log('='.repeat(70) + '\n');

process.exit(totalFailed > 0 ? 1 : 0);
