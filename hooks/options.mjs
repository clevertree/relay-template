#!/usr/bin/env node
// Relay repository options hook
// Returns a JSON response body with server details, repository list, and branch information
// Called via OPTIONS HTTP method by clients to discover available repos and branches

import { execSync } from 'node:child_process';
import path from 'node:path';

function env(name, def) {
  const v = process.env[name];
  if (v == null) return def;
  return v;
}

function git(args, opts = {}) {
  const gitDir = env('GIT_DIR');
  if (!gitDir) {
    throw new Error('options.mjs: GIT_DIR environment variable not set');
  }
  const fullArgs = ['--git-dir', gitDir, ...args];
  return execSync(`git ${fullArgs.map(a => `"${a}"`).join(' ')}`, {
    encoding: 'utf8',
    ...opts
  });
}

function getBranches() {
  try {
    const output = git(['branch', '-r']);
    return output
      .split('\n')
      .filter(line => line.trim() && !line.includes('HEAD'))
      .map(line => line.trim().replace(/^origin\//, ''))
      .filter((branch, idx, arr) => arr.indexOf(branch) === idx); // unique
  } catch {
    return [];
  }
}

function getBranchHeads() {
  const branches = getBranches();
  const heads = {};
  for (const branch of branches) {
    try {
      const sha = git(['rev-parse', `origin/${branch}`]).trim();
      heads[branch] = sha;
    } catch {
      // Branch doesn't exist or isn't accessible
    }
  }
  return heads;
}

function main() {
  const gitDir = env('GIT_DIR');
  const repoName = path.basename(gitDir, '.git');
  const branch = env('BRANCH', 'main');
  const branches = getBranches();
  const branchHeads = getBranchHeads();

  const response = {
    server: {
      name: 'Relay Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
    repository: {
      name: repoName,
      path: gitDir,
      type: 'bare',
      currentBranch: branch,
    },
    repos: [repoName], // can be extended to support multiple repos
    branches: branches,
    branchHeads: branchHeads,
    capabilities: {
      supports: ['GET', 'PUT', 'DELETE', 'OPTIONS', 'QUERY'],
      validation: 'hooks/pre-commit.mjs and hooks/pre-receive.mjs',
      hooks: {
        preCommit: 'hooks/pre-commit.mjs (executed on PUT)',
        preReceive: 'hooks/pre-receive.mjs (executed on git push)',
      },
    },
  };

  // Output as JSON
  console.log(JSON.stringify(response, null, 2));
}

try {
  main();
} catch (e) {
  console.error('Error in options.mjs:', e?.message || String(e));
  process.exit(1);
}
