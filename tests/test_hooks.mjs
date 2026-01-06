// Integration test for relay-template server hooks
// Simulates the pre-receive execution environment

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_PATH = path.join(REPO_ROOT, 'hooks/server/pre-receive.mjs');

// Mock context that would normally come from relay-hook-handler
const mockContext = {
  branch: 'main',
  repo_path: REPO_ROOT,
  old_commit: '0000000000000000000000000000000000000000',
  new_commit: '4b4942c4f28a57933a20992d7a97ce307a585ab6',
  files: {
    '.relay/validation.mjs': Buffer.from(fs.readFileSync(path.join(REPO_ROOT, '.relay/validation.mjs'))).toString('base64'),
    'data/2026/test-movie/meta.yaml': Buffer.from(JSON.stringify({
      title: 'Test Movie',
      release_date: '2026-01-06',
      genre: ['Action']
    })).toString('base64')
  }
};

function runHook(context) {
  console.log('--- Running Pre-Receive Hook Mock ---');
  const child = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(context),
    env: {
      ...process.env,
      GIT_DIR: REPO_ROOT,
      OLD_COMMIT: context.old_commit,
      NEW_COMMIT: context.new_commit,
      BRANCH: context.branch
    },
    encoding: 'utf8'
  });

  return child;
}

// Test 1: Successful Validation
console.log('Test 1: Valid changes...');
const res1 = runHook(mockContext);
console.log('Stdout:', res1.stdout);
console.log('Stderr:', res1.stderr);
if (res1.status === 0 && res1.stdout.includes('pre-receive validation passed')) {
  console.log('✅ Test 1 Passed');
} else {
  console.error('❌ Test 1 Failed');
  process.exit(1);
}

// Test 2: Validation Failure (Invalid Path)
console.log('\nTest 2: Invalid path rejection...');
const failContext = {
  ...mockContext,
  files: {
    ...mockContext.files,
    'unauthorized.file': 'should be rejected'
  }
};
const res2 = runHook(failContext);
if (res2.status !== 0 && res2.stderr.includes('Path not allowed')) {
  console.log('✅ Test 2 Passed (Correctly Rejected)');
} else {
  console.error('❌ Test 2 Failed:', res2.stderr);
  process.exit(1);
}

console.log('\nAll integration tests passed!');
