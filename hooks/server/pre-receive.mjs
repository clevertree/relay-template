#!/usr/bin/env node
// Relay repository pre-receive hook (Node module)
// Triggered by git push/receive operations before accepting commits
// Responsibilities:
//  - Validate commits meet repository requirements
//  - If this commit changes hooks/pre-commit.mjs or hooks/pre-receive.mjs, require a signed commit
//  - Run validation.mjs in a restricted sandbox to enforce whitelist + validation
//  - Maintain a lightweight JSON index (relay_index.json) for changed meta.yaml

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function env(name, def) {
  const v = process.env[name];
  if (v == null) return def;
  return v;
}

const GIT_DIR = env('GIT_DIR');
const OLD_COMMIT = env('OLD_COMMIT', '0000000000000000000000000000000000000000');
const NEW_COMMIT = env('NEW_COMMIT');
const REFNAME = env('REFNAME', 'refs/heads/main');
const BRANCH = env('BRANCH', 'main');

if (!GIT_DIR || !NEW_COMMIT) {
  console.error('pre-receive.mjs: missing required env (GIT_DIR, NEW_COMMIT)');
  process.exit(2);
}

function git(args, opts = {}) {
  const fullArgs = ['--git-dir', GIT_DIR, ...args];
  const out = execFileSync('git', fullArgs, { encoding: 'utf8', ...opts });
  return out;
}

function listChanged() {
  // -z for NUL delimited, name-status to detect deletions
  const out = git(['diff', '--name-status', '-z', OLD_COMMIT, NEW_COMMIT]);
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

function readFromTree(filePath) {
  try {
    const content = git(['show', `${NEW_COMMIT}:${filePath}`], { encoding: 'buffer' });
    return Buffer.from(content);
  } catch (_) {
    return null;
  }
}

function requireSignedIfChangingHooks(changes) {
  const changedHook = changes.some((e) => 
    e.path === '.relay/pre-commit.mjs' || 
    e.path === '.relay/pre-receive.mjs'
  );
  if (!changedHook) return;
  
  // If the commit modifies hook scripts, require a signed commit
  if (!verifyCommitWithAllowedSigners()) {
    console.error('Commit modifies .relay hook scripts but is not signed (git verify-commit failed).');
    process.exit(1);
  }
}

function runValidationSandbox(changes) {
  const validationCode = readFromTree('.relay/validation.mjs');
  if (!validationCode) {
    // If no validation.mjs, allow by default
    return { ok: true };
  }

  const api = {
    listStaged: () => changes.map((c) => ({ status: c.status, path: c.path })),
    readFile: (p) => {
      const buf = readFromTree(p);
      if (!buf) return null;
      return buf;
    },
  };

  const contextObj = { api, console: console, Buffer };
  const context = vm.createContext(contextObj, { name: 'validation-sandbox' });
  const code = `${validationCode.toString()}\n//# sourceURL=validation.mjs`;
  const script = new vm.Script(code, { filename: 'validation.mjs' });

  try {
    const result = script.runInContext(context, { timeout: 2000 });
    let validateFn = context.validate || (result && result.validate);
    
    if (!validateFn && typeof contextObj.module?.exports?.validate === 'function') {
      validateFn = contextObj.module.exports.validate;
    }
    if (typeof validateFn !== 'function') {
      validateFn = context.default || result?.default;
    }
    if (typeof validateFn !== 'function') {
      const vr = context.validationResult || result?.validationResult;
      if (vr && typeof vr === 'object') return vr;
      return { ok: true };
    }

    const vr = validateFn(api);
    if (vr && typeof vr.then === 'function') {
      throw new Error('validation.mjs returned a Promise; async not supported');
    }
    return vr || { ok: true };
  } catch (e) {
    return { ok: false, message: `validation.mjs error: ${e.message || e}` };
  }
}

function yamlToJson(buf) {
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

function upsertIndex(changes) {
  // Maintain relay_index.json stored under GIT_DIR
  const indexPath = path.join(GIT_DIR, 'relay_index.json');
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
        const k = key(BRANCH, metaDir);
        if (pos.has(k)) {
          const i = pos.get(k);
          items.splice(i, 1);
        }
        continue;
      }
      const buf = readFromTree(ch.path);
      if (!buf) continue;
      const json = yamlToJson(buf);
      if (!json) continue;
      const doc = {
        ...json,
        _branch: BRANCH,
        _meta_dir: metaDir,
        _updated_at: new Date().toISOString()
      };
      if (!('_created_at' in doc)) doc._created_at = new Date().toISOString();
      const k = key(BRANCH, metaDir);
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

function collectAllowedSigners() {
  // Read allowed SSH public keys from repo tree: first try .relay/.ssh/* then .ssh/*
  const dirs = ['.relay/.ssh', '.ssh'];
  const blobs = [];
  for (const d of dirs) {
    let listing = '';
    try {
      listing = git(['ls-tree', '--name-only', `${NEW_COMMIT}:${d}`]);
    } catch {
      listing = '';
    }
    if (!listing) continue;
    for (const name of listing.split(/\r?\n/).filter(Boolean)) {
      const p = `${d}/${name}`;
      const buf = readFromTree(p);
      if (buf) blobs.push(buf.toString('utf8'));
    }
  }
  if (blobs.length === 0) return null;
  const content = blobs.join('\n');
  const tmp = path.join(require('os').tmpdir(), `relay-allowed-signers-${NEW_COMMIT}.txt`);
  try {
    fs.writeFileSync(tmp, content);
    return tmp;
  } catch {
    return null;
  }
}

function verifyCommitWithAllowedSigners() {
  try {
    // First try generic verify-commit (supports GPG/SSH depending on commit)
    git(['verify-commit', NEW_COMMIT]);
    return true;
  } catch {}
  
  const allowed = collectAllowedSigners();
  if (!allowed) return false;
  
  try {
    // Force SSH verification with provided allowed signers file
    execFileSync('git', [
      '-c', `gpg.ssh.allowedSignersFile=${allowed}`,
      '-c', 'gpg.format=ssh',
      '--git-dir', GIT_DIR,
      'verify-commit', NEW_COMMIT
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

function main() {
  const changes = listChanged();
  
  // Require signed commits if hook scripts are changed
  requireSignedIfChangingHooks(changes);
  
  // Run validation
  const result = runValidationSandbox(changes);
  if (!result || result.ok === false) {
    // If validation failed, allow override if commit is signed by allowed signer
    if (!verifyCommitWithAllowedSigners()) {
      const msg = result?.message || 'validation failed';
      console.error(msg);
      process.exit(1);
    }
  }
  
  // Maintain index for meta.yaml changes
  upsertIndex(changes);
  
  console.log('pre-receive validation passed');
}

try {
  main();
} catch (e) {
  console.error(e?.message || String(e));
  process.exit(1);
}
