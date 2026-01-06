// Shared utilities for relay hooks
// Provides common functions for git operations, validation, and index management

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Parse injected context from stdin (from Rust dispatcher)
let __hook_context = null;
try {
  // Use a small read since context might not be provided for every tool call
  const buf = fs.readFileSync(0); 
  if (buf && buf.length > 0) {
    __hook_context = JSON.parse(buf.toString('utf8'));
  }
} catch (_) {
  // If not valid JSON or no stdin, fallback remains available
}

export function env(name, def) {
  if (__hook_context && __hook_context[name.toLowerCase()]) {
    return __hook_context[name.toLowerCase()];
  }
  const v = process.env[name];
  if (v == null) return def;
  return v;
}

export function git(gitDir, args, opts = {}) {
  const fullArgs = ['--git-dir', gitDir, ...args];
  const out = execFileSync('git', fullArgs, { encoding: 'utf8', ...opts });
  return out;
}

export function listChanged(gitDir, oldCommit, newCommit) {
  if (__hook_context && __hook_context.files) {
    // If context is provided, we can reconstruct the list
    return Object.keys(__hook_context.files).map(p => ({
      status: 'M', // Assume Modified if provided in context
      path: p
    }));
  }

  // -z for NUL delimited, name-status to detect deletions
  const out = git(gitDir, ['diff', '--name-status', '-z', oldCommit, newCommit]);
  const parts = out.split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < parts.length; i += 2) {
    const status = parts[i];
    const file = parts[i + 1];
    if (!status || !file) break;
    entries.push({ status: status.trim()[0], path: file });
  }
  return entries;
}

export function readFromTree(gitDir, commit, filePath) {
  // Always check injected context first to avoid Git Quarantine issues
  if (__hook_context && __hook_context.files && __hook_context.files[filePath]) {
    return Buffer.from(__hook_context.files[filePath], 'base64');
  }

  try {
    const content = git(gitDir, ['show', `${commit}:${filePath}`], { encoding: 'buffer' });
    return Buffer.from(content);
  } catch (_) {
    return null;
  }
}

export function collectAllowedSigners(gitDir, newCommit, readFromTreeFn) {
  // Read allowed SSH public keys from repo tree: first try .relay/.ssh/* then .ssh/*
  const dirs = ['.relay/.ssh', '.ssh'];
  const blobs = [];
  for (const d of dirs) {
    let listing = '';
    try {
      listing = git(gitDir, ['ls-tree', '--name-only', `${newCommit}:${d}`]);
    } catch {
      listing = '';
    }
    if (!listing) continue;
    for (const name of listing.split(/\r?\n/).filter(Boolean)) {
      const p = `${d}/${name}`;
      const buf = readFromTreeFn(p);
      if (buf) blobs.push(buf.toString('utf8'));
    }
  }
  if (blobs.length === 0) return null;
  const content = blobs.join('\n');
  const tmp = path.join(require('os').tmpdir(), `relay-allowed-signers-${newCommit}.txt`);
  try {
    fs.writeFileSync(tmp, content);
    return tmp;
  } catch {
    return null;
  }
}

export function verifyCommitWithAllowedSigners(gitDir, newCommit, collectAllowedSignersFn) {
  try {
    // First try generic verify-commit (supports GPG/SSH depending on commit)
    git(gitDir, ['verify-commit', newCommit]);
    return true;
  } catch {}
  
  const allowed = collectAllowedSignersFn(gitDir, newCommit, (p) => readFromTree(gitDir, newCommit, p));
  if (!allowed) return false;
  
  try {
    // Force SSH verification with provided allowed signers file
    execFileSync('git', [
      '-c', `gpg.ssh.allowedSignersFile=${allowed}`,
      '-c', 'gpg.format=ssh',
      '--git-dir', gitDir,
      'verify-commit', newCommit
    ], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  } finally {
    try {
      if (allowed) fs.unlinkSync(allowed);
    } catch {}
  }
}

export function yamlToJson(buf) {
  try {
    // Try node execution if js-yaml might be available in node_modules or globally
    const js = execSync('node -e "const fs=require(\'fs\');const yaml=require(\'js-yaml\');const d=fs.readFileSync(0,\'utf8\');process.stdout.write(JSON.stringify(yaml.load(d)))"', { input: buf });
    return JSON.parse(js.toString('utf8'));
  } catch {
    try {
      return JSON.parse(buf.toString('utf8'));
    } catch {
      return null;
    }
  }
}

export function upsertIndex(gitDir, newCommit, changes, readFileFn, branch = 'main') {
  const indexPath = path.join(gitDir, 'relay_index.json');
  let index = { items: [] };
  if (fs.existsSync(indexPath)) {
    try {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch {
      index = { items: [] };
    }
  }
  const items = Array.isArray(index.items) ? index.items : [];
  
  const key = (branch, metaDir) => `${branch}::${metaDir}`;
  const pos = new Map();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it && typeof it === 'object') pos.set(key(it._branch, it._meta_dir), i);
  }
  
  for (const ch of changes) {
    if (ch.path.endsWith('/meta.yaml') || ch.path.endsWith('/meta.yml') || 
        ch.path.endsWith('meta.yaml') || ch.path.endsWith('meta.yml')) {
      const metaDir = path.posix.dirname(ch.path);
      if (ch.status === 'D') {
        const k = key(branch, metaDir);
        if (pos.has(k)) {
          const i = pos.get(k);
          items.splice(i, 1);
        }
        continue;
      }
      const buf = readFileFn(ch.path);
      if (!buf) continue;
      const json = yamlToJson(buf);
      if (!json) continue;
      const doc = {
        ...json,
        _branch: branch,
        _meta_dir: metaDir,
        _updated_at: new Date().toISOString()
      };
      if (!('_created_at' in doc)) doc._created_at = new Date().toISOString();
      const k = key(branch, metaDir);
      if (pos.has(k)) {
        items[pos.get(k)] = doc;
      } else {
        pos.set(k, items.length);
        items.push(doc);
      }
    }
  }
  index.items = items;
  fs.writeFileSync(indexPath, JSON.stringify(index));
}
  try {
    // First try generic verify-commit (supports GPG/SSH depending on commit)
    git(gitDir, ['verify-commit', newCommit]);
    return true;
  } catch {}

  const allowed = collectAllowedSignersFn();
  if (!allowed) return false;

  try {
    // Force SSH verification with provided allowed signers file
    execFileSync('git', [
      '-c', `gpg.ssh.allowedSignersFile=${allowed}`,
      '-c', 'gpg.format=ssh',
      '--git-dir', gitDir,
      'verify-commit', newCommit
    ], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  } finally {
    try {
      if (allowed) fs.unlinkSync(allowed);
    } catch {}
  }
}

export function yamlToJson(buf) {
  // Minimal YAML support: if js-yaml present in PATH environment where script runs, try it; otherwise attempt JSON parse
  try {
    const js = execSync('node -e "const fs=require(\'fs\');const yaml=require(\'js-yaml\');const d=fs.readFileSync(0,\'utf8\');process.stdout.write(JSON.stringify(yaml.load(d)))"', { input: buf });
    return JSON.parse(js.toString('utf8'));
  } catch {
    try {
      return JSON.parse(buf.toString('utf8'));
    } catch {
      return null;
    }
  }
}

export function upsertIndex(gitDir, branch, changes, readFromTreeFn) {
  // Maintain relay_index.json stored under GIT_DIR
  const indexPath = path.join(gitDir, 'relay_index.json');
  let index = { items: [] };
  if (fs.existsSync(indexPath)) {
    try {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch {
      index = { items: [] };
    }
  }
  const items = Array.isArray(index.items) ? index.items : [];

  // Map for quick lookup by (branch + meta_dir)
  const key = (branch, metaDir) => `${branch}::${metaDir}`;
  const pos = new Map();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it && typeof it === 'object') pos.set(key(it._branch, it._meta_dir), i);
  }

  for (const ch of changes) {
    if (ch.path.endsWith('/meta.yaml') || ch.path.endsWith('/meta.yml') ||
      ch.path.endsWith('meta.yaml') || ch.path.endsWith('meta.yml')) {
      const metaDir = path.posix.dirname(ch.path);
      if (ch.status === 'D') {
        const k = key(branch, metaDir);
        if (pos.has(k)) {
          const i = pos.get(k);
          items.splice(i, 1);
        }
        continue;
      }
      const buf = readFromTreeFn(ch.path);
      if (!buf) continue;
      const json = yamlToJson(buf);
      if (!json) continue;
      const doc = {
        ...json,
        _branch: branch,
        _meta_dir: metaDir,
        _updated_at: new Date().toISOString()
      };
      if (!('_created_at' in doc)) doc._created_at = new Date().toISOString();
      const k = key(branch, metaDir);
      if (pos.has(k)) {
        items[pos.get(k)] = doc;
      } else {
        pos.set(k, items.length);
        items.push(doc);
      }
    }
  }
  index.items = items;
  fs.writeFileSync(indexPath, JSON.stringify(index));
}
