#!/usr/bin/env node
// Relay repository pre-commit hook (Node module)
// Triggered by server PUT operations before committing new files
// Responsibilities:
//  - Run validation.mjs in a restricted sandbox to enforce whitelist + validation
//  - Validate file format and allowed paths

import { env, listChanged, readFromTree, upsertIndex } from './lib/utils.mjs';
import { runValidationSandbox } from './lib/validation-util.mjs';

const GIT_DIR = env('GIT_DIR');
const OLD_COMMIT = env('OLD_COMMIT', '0000000000000000000000000000000000000000');
const NEW_COMMIT = env('NEW_COMMIT');
const BRANCH = env('BRANCH', 'main');

if (!GIT_DIR || !NEW_COMMIT) {
  process.exit(0);
}

function main() {
  const changes = listChanged(GIT_DIR, OLD_COMMIT, NEW_COMMIT);
  
  // Run validation sandbox
  const validationCode = readFromTree(GIT_DIR, NEW_COMMIT, '.relay/validation.mjs');
  const readFileFn = (p) => readFromTree(GIT_DIR, NEW_COMMIT, p);
  const result = runValidationSandbox(validationCode, changes, readFileFn);

  if (result && result.ok === false) {
    console.error(result.message || 'validation failed');
    process.exit(1);
  }
  
  // Maintain index for meta.yaml changes (pre-commit also updates index for local server edits)
  upsertIndex(GIT_DIR, NEW_COMMIT, changes, readFileFn, BRANCH);

  console.log('pre-commit validation passed');
}

try {
  main();
} catch (e) {
  console.error(e?.message || String(e));
  process.exit(1);
}
