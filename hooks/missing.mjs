#!/usr/bin/env node
// missing.mjs — 404/Not Found response handler
// Env:
//  - GIT_DIR: path to bare git dir
//  - BRANCH: branch name
//  - REL_PATH: path within repo that was not found
// Output: JSON to stdout
//  { contentType: "text/markdown; charset=utf-8", bodyBase64 }
//
// This script is called when a resource is not found in the repository.
// It should return a markdown response in bodyBase64 format.
// The contentType can be customized but other headers are not configurable.

import { execFileSync } from 'node:child_process';

function env(name, def) { const v = process.env[name]; return v == null ? def : v; }
const GIT_DIR = env('GIT_DIR');
const BRANCH = env('BRANCH', 'main');
const REL_PATH = env('REL_PATH', '');

if (!GIT_DIR) { console.error('missing GIT_DIR'); process.exit(2); }

function git(args, opts={}) { return execFileSync('git', ['--git-dir', GIT_DIR, ...args], { encoding: 'utf8', ...opts }); }

function getDefaultMarkdown() {
  return `# Not Found

The requested resource was not found in this repository.

**Path:** \`${REL_PATH || '/'}\`  
**Branch:** \`${BRANCH}\`

## Suggestions
- Check the spelling of the path
- Browse the repository root to see available files
- Visit the main branch if you're on a different branch
`;
}

try {
  const markdown = getDefaultMarkdown();
  const bodyBase64 = Buffer.from(markdown, 'utf8').toString('base64');
  console.log(JSON.stringify({
    contentType: 'text/markdown; charset=utf-8',
    bodyBase64
  }));
  process.exit(0);
} catch (e) {
  console.error('Error in missing.mjs:', e.message);
  process.exit(1);
}
