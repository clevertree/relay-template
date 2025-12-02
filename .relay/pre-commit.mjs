#!/usr/bin/env node
// Relay repository pre-commit hook (Node module)
// Triggered by server PUT operations before committing new files
// Responsibilities:
//  - Run validation.mjs in a restricted sandbox to enforce whitelist + validation
//  - Validate file format and allowed paths

import { env, git, listChanged, readFromTree } from './.relay/lib/utils.mjs';
import { runValidationSandbox } from './.relay/lib/validation.mjs';

const GIT_DIR = env('GIT_DIR');
const OLD_COMMIT = env('OLD_COMMIT', '0000000000000000000000000000000000000000');
const NEW_COMMIT = env('NEW_COMMIT');
const BRANCH = env('BRANCH', 'main');

if (!GIT_DIR || !NEW_COMMIT) {
  console.error('pre-commit.mjs: missing required env (GIT_DIR, NEW_COMMIT)');
  process.exit(2);
}

function main() {
  const changes = listChanged(GIT_DIR, OLD_COMMIT, NEW_COMMIT);
  
  const validationCode = readFromTree(GIT_DIR, NEW_COMMIT, '.relay/validation.mjs');
  const readFileFn = (filePath) => readFromTree(GIT_DIR, NEW_COMMIT, filePath);
  
  const result = runValidationSandbox(validationCode, changes, readFileFn);

  if (!result || result.ok === false) {
    const msg = result?.message || 'validation failed';
    console.error(msg);
    process.exit(1);
  }

  console.log('pre-commit validation passed');
}

try {
  main();
} catch (e) {
  console.error(e?.message || String(e));
  process.exit(1);
}
