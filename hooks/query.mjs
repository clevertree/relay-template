#!/usr/bin/env node
// query.mjs — generic query over primary index (relay_index.json) with TMDB source support
// Env:
//  - GIT_DIR: path to bare git dir (where relay_index.json resides)
//  - BRANCH: branch name to filter by (or "all" to include all)
// Input (stdin JSON): { page, pageSize, filter, source }
// Output (stdout JSON): { items, total, page, pageSize, branch }

import fs from 'node:fs';
import path from 'node:path';
import { queryFromTmdb } from './lib/sources/tmdb.mjs';

function env(name, def) { const v = process.env[name]; return v == null ? def : v; }
const GIT_DIR = env('GIT_DIR');
const BRANCH = env('BRANCH', 'main');
if (!GIT_DIR) { console.error('missing GIT_DIR'); process.exit(2); }

function readStdin() {
  let data = '';
  try { data = fs.readFileSync(0, 'utf8'); } catch {}
  if (!data) return {};
  try { return JSON.parse(data); } catch { return {}; }
}

function loadIndex() {
  const p = path.join(GIT_DIR, 'relay_index.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { items: [] }; }
}

function matchesFilter(item, filter) {
  if (!filter || typeof filter !== 'object') return true;
  // Simple key:value equality or $text: substring search across string fields
  for (const [k, v] of Object.entries(filter)) {
    if (k === '$text' && typeof v === 'string') {
      const needle = v.toLowerCase();
      const hit = Object.values(item).some((val) =>
        typeof val === 'string' && val.toLowerCase().includes(needle)
      );
      if (!hit) return false;
    } else {
      if (item[k] !== v) return false;
    }
  }
  return true;
}

function main() {
  const req = readStdin();
  const page = Number.isFinite(req.page) ? req.page : 0;
  const pageSize = Number.isFinite(req.pageSize) ? req.pageSize : 25;
  const filter = req.filter || req.params || null;
  const source = req.source || null;
  
  // If TMDB source is requested, query TMDB API directly
  if (source === 'tmdb' && filter && filter.$text) {
    queryTmdb(filter.$text, page, pageSize);
    return;
  }
  
  const idx = loadIndex();
  let items = Array.isArray(idx.items) ? idx.items : [];
  if (BRANCH !== 'all') items = items.filter((it) => it && it._branch === BRANCH);
  if (filter) items = items.filter((it) => matchesFilter(it, filter));
  const total = items.length;
  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = items.slice(start, end);
  const out = { items: pageItems, total, page, pageSize, branch: BRANCH };
  process.stdout.write(JSON.stringify(out));
}

async function queryTmdb(searchQuery, page, pageSize) {
  try {
    const result = await queryFromTmdb(searchQuery, page, pageSize);
    const out = {
      items: result.results || [],
      total: result.total || 0,
      page: result.page || page,
      pageSize,
      branch: BRANCH,
      source: 'tmdb'
    };
    process.stdout.write(JSON.stringify(out));
  } catch (err) {
    console.error('TMDB query error:', err);
    process.stdout.write(JSON.stringify({ items: [], total: 0, page, pageSize, branch: BRANCH, error: String(err) }));
  }
}

try { main(); } catch (e) { console.error(String(e && e.message || e)); process.exit(1); }

try { main(); } catch (e) { console.error(String(e && e.message || e)); process.exit(1); }
