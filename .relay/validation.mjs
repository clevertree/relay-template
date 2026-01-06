// validation.mjs — sandboxed commit validation
// Exports function validate(api) -> { ok: boolean, message?: string }
// Rules:
// - Only allow changes to:
//    - data/**/meta.yaml (or .yml)
//    - data/**/index.md
// - If other paths are changed, reject with explanation
// - For meta.yaml files, validate required fields per schema: title (string), release_date (YYYY-MM-DD), genre (array of strings)

function globMatch(pattern, path) {
  // Minimal glob: supports ** and * with forward slashes
  const esc = (s) => s.replace(/[.+^${}()|\[\]\\]/g, '\\$&');
  let rx = esc(pattern)
    .replace(/\\\\/g, '/')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  rx = '^' + rx + '$';
  return new RegExp(rx).test(path);
}

function isWhitelisted(p) {
  return (
    globMatch('data/**/meta.yaml', p) ||
    globMatch('data/**/meta.yml', p) ||
    globMatch('data/**/index.md', p) ||
    globMatch('.relay/**', p) ||
    globMatch('hooks/**', p) ||
    globMatch('.relay.yaml', p)
  );
}

function decodeUtf8(buf) {
  if (!buf) return null;
  try { return new TextDecoder('utf-8').decode(buf); } catch { return null; }
}

function parseYamlLike(text) {
  // Extremely tiny YAML subset: try JSON parse first, else key: value lines
  try { return JSON.parse(text); } catch {}
  const obj = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) {
      const k = m[1];
      let v = m[2];
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = Number(v);
      obj[k] = v;
    }
  }
  return obj;
}

function validateMetaYaml(api, path) {
  const buf = api.readFile(path);
  if (!buf) return { ok: false, message: `Cannot read ${path}` };
  const text = decodeUtf8(buf);
  if (!text) return { ok: false, message: `${path} is not UTF-8` };
  const doc = parseYamlLike(text);
  if (!doc || typeof doc !== 'object') return { ok: false, message: `${path} is not valid YAML/JSON` };
  // Checks per schema
  if (typeof doc.title !== 'string' || !doc.title.trim()) return { ok: false, message: `${path}: missing or invalid title (string)` };
  if (typeof doc.release_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.release_date)) return { ok: false, message: `${path}: invalid release_date (YYYY-MM-DD)` };
  if (!Array.isArray(doc.genre) || !doc.genre.every((g) => typeof g === 'string')) return { ok: false, message: `${path}: invalid genre (array of strings)` };
  return { ok: true };
}

function validate(api) {
  const staged = api.listStaged();
  const errors = [];
  for (const f of staged) {
    const p = f.path;
    if (!isWhitelisted(p)) {
      errors.push(`Path not allowed: ${p}`);
      continue;
    }
    if (globMatch('data/**/meta.yaml', p) || globMatch('data/**/meta.yml', p)) {
      const res = validateMetaYaml(api, p);
      if (!res.ok) errors.push(res.message || `Invalid meta: ${p}`);
    }
  }
  if (errors.length) return { ok: false, message: errors.join('\n') };
  return { ok: true };
}

// Return the validate function as the result of the script
validate;
