#!/usr/bin/env node
// get.mjs — Git-first resolver with optional IPFS fallback for files and TMDB support
// Env:
//  - GIT_DIR: path to bare git dir
//  - BRANCH: branch name (default: main)
//  - REL_PATH: path within repo (may have leading/trailing slashes)
// Behavior:
//  - If the request targets a directory (REL_PATH empty or ends with '/'), DO NOT query IPFS.
//    Return a Markdown document that lists directory entries from Git only.
//  - If the request targets a file:
//      • Serve from Git if it exists.
//      • Otherwise, if a root IPFS CID is configured, attempt to fetch the file from IPFS.
//  - If not found, return { kind: 'miss' }.
// Output (JSON to stdout):
//  { kind: "file", contentType, bodyBase64 }
//  { kind: "miss" }

import { execFileSync, spawnSync } from 'node:child_process';
import { getFromTmdb } from './lib/sources/tmdb.mjs';

function env(name, def) { const v = process.env[name]; return v == null ? def : v; }
const GIT_DIR = env('GIT_DIR');
const BRANCH = env('BRANCH', 'main');
const RAW_REL = env('REL_PATH', '') || '';
if (!GIT_DIR) { console.error('missing GIT_DIR'); process.exit(2); }

function git(args, opts={}) { return execFileSync('git', ['--git-dir', GIT_DIR, ...args], { encoding: 'utf8', ...opts }); }

function getRootCid() {
  try {
    const out = git(['show', `${BRANCH}:hooks/root.ipfs`]);
    const cid = out.trim();
    if (!cid) return null;
    return cid;
  } catch { return null; }
}

// Determine if a path exists in Git and whether it's a blob (file) or tree (directory)
function gitPathType(rel) {
  if (rel === '') return 'tree';
  try {
    const t = git(['cat-file', '-t', `${BRANCH}:${rel}`]).trim();
    if (t === 'blob') return 'blob';
    if (t === 'tree') return 'tree';
    return null;
  } catch {
    return null;
  }
}

function gitReadFile(rel) {
  try {
    const buf = execFileSync('git', ['--git-dir', GIT_DIR, 'show', `${BRANCH}:${rel}`]);
    return Buffer.from(buf);
  } catch { return null; }
}

function gitListDir(rel) {
  try {
    const out = git(['ls-tree', `${BRANCH}:${rel}`]);
    const lines = out.split(/\r?\n/).filter(Boolean);
    const items = [];
    for (const line of lines) {
      // format: "<mode> <type> <object>\t<file>"
      const [left, name] = line.split('\t');
      if (!left || !name) continue;
      const parts = left.trim().split(/\s+/);
      const type = parts[1];
      items.push({ name, type });
    }
    return items;
  } catch {
    return [];
  }
}

function ipfsCat(cid, rel, timeoutMs=10000) {
  const p = spawnSync('ipfs', ['cat', `${cid}/${rel}`], { encoding: 'buffer', timeout: timeoutMs });
  if (p.status === 0 && p.stdout && p.stdout.length) {
    return Buffer.from(p.stdout);
  }
  return null;
}

function guessContentType(p) {
  const low = p.toLowerCase();
  if (low.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (low.endsWith('.html') || low.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (low.endsWith('.json')) return 'application/json';
  if (low.endsWith('.yaml') || low.endsWith('.yml')) return 'application/x-yaml';
  if (low.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (low.endsWith('.png')) return 'image/png';
  if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg';
  if (low.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

// Directory Markdown rendering (Git only)
function renderDirMarkdown(rel, items) {
  const pathDisplay = ('/' + (rel || '')).replace(/\/+/, '/');
  const header = `# Index of ${pathDisplay}`;
  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1; // folders first
    return a.name.localeCompare(b.name);
  });
  const lines = sorted.map((it) => {
    const label = it.type === 'tree' ? `${it.name}/` : it.name;
    const href = it.type === 'tree' ? `./${it.name}/` : `./${it.name}`;
    return `- [${label}](${href})`;
  });
  return [header, '', ...lines, ''].join('\n');
}

// TMDB movie Markdown rendering
function renderTmdbMarkdown(movie) {
  const lines = [];
  if (movie.title) lines.push(`# ${movie.title}`);
  if (movie.release_year) lines.push(`**Year:** ${movie.release_year}`);
  if (movie.genre && movie.genre.length > 0) lines.push(`**Genres:** ${movie.genre.join(', ')}`);
  if (movie.overview) lines.push(`\n${movie.overview}`);
  if (movie.poster_path) lines.push(`\n![Poster](${movie.poster_path})`);
  return lines.join('\n') || 'No data available';
}

function main() {
  const cid = getRootCid();
  const isDirHint = RAW_REL === '' || RAW_REL.endsWith('/');
  const REL = (RAW_REL.replace(/^\/+/, '')).replace(/\/+$/, '');

  const type = REL === '' && isDirHint ? 'tree' : gitPathType(REL);

  // If directory requested (hint) or Git says it's a tree: render Markdown directory listing from Git only
  if (isDirHint || type === 'tree') {
    // If rel is empty and repo root, list root.
    const items = gitListDir(REL);
    if (!items || items.length === 0) {
      // Directory doesn't exist in Git — do not query IPFS for directories
      console.log(JSON.stringify({ kind: 'miss' }));
      return;
    }
    const md = renderDirMarkdown(REL, items);
    const bodyBase64 = Buffer.from(md, 'utf8').toString('base64');
    console.log(JSON.stringify({ kind: 'file', contentType: 'text/markdown; charset=utf-8', bodyBase64 }));
    return;
  }

  // If it's a file in Git, serve it
  if (type === 'blob') {
    const buf = gitReadFile(REL);
    if (buf) {
      const ct = guessContentType(REL);
      console.log(JSON.stringify({ kind: 'file', contentType: ct, bodyBase64: buf.toString('base64') }));
      return;
    }
  }

  // Not found in Git and not a directory request — optionally try IPFS for file fallback
  if (!isDirHint && cid) {
    const fileBuf = ipfsCat(cid, REL, 10000);
    if (fileBuf) {
      const ct = guessContentType(REL);
      console.log(JSON.stringify({ kind: 'file', contentType: ct, bodyBase64: fileBuf.toString('base64') }));
      return;
    }
  }

  // Miss
  console.log(JSON.stringify({ kind: 'miss' }));
}

async function main() {
  const cid = getRootCid();
  const isDirHint = RAW_REL === '' || RAW_REL.endsWith('/');
  const REL = (RAW_REL.replace(/^\/+/, '')).replace(/\/+$/, '');

  // Try TMDB lookup if path looks like a movie ID (numeric)
  if (!isDirHint && /^\d+$/.test(REL)) {
    try {
      const movie = await getFromTmdb(REL);
      if (movie) {
        const md = renderTmdbMarkdown(movie);
        const bodyBase64 = Buffer.from(md, 'utf8').toString('base64');
        console.log(JSON.stringify({ kind: 'file', contentType: 'text/markdown; charset=utf-8', bodyBase64 }));
        return;
      }
    } catch (err) {
      // Fall through to git/ipfs
    }
  }

  const type = REL === '' && isDirHint ? 'tree' : gitPathType(REL);

  // If directory requested (hint) or Git says it's a tree: render Markdown directory listing from Git only
  if (isDirHint || type === 'tree') {
    // If rel is empty and repo root, list root.
    const items = gitListDir(REL);
    if (!items || items.length === 0) {
      // Directory doesn't exist in Git — do not query IPFS for directories
      console.log(JSON.stringify({ kind: 'miss' }));
      return;
    }
    const md = renderDirMarkdown(REL, items);
    const bodyBase64 = Buffer.from(md, 'utf8').toString('base64');
    console.log(JSON.stringify({ kind: 'file', contentType: 'text/markdown; charset=utf-8', bodyBase64 }));
    return;
  }

  // If it's a file in Git, serve it
  if (type === 'blob') {
    const buf = gitReadFile(REL);
    if (buf) {
      const ct = guessContentType(REL);
      console.log(JSON.stringify({ kind: 'file', contentType: ct, bodyBase64: buf.toString('base64') }));
      return;
    }
  }

  // Not found in Git and not a directory request — optionally try IPFS for file fallback
  if (!isDirHint && cid) {
    const fileBuf = ipfsCat(cid, REL, 10000);
    if (fileBuf) {
      const ct = guessContentType(REL);
      console.log(JSON.stringify({ kind: 'file', contentType: ct, bodyBase64: fileBuf.toString('base64') }));
      return;
    }
  }

  // Miss
  console.log(JSON.stringify({ kind: 'miss' }));
}

try { main(); } catch (e) { console.log(JSON.stringify({ kind: 'miss', error: String(e && e.message || e) })); }
