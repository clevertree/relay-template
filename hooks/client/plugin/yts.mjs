/**
 * YTS Plugin - lightweight browser scraper for YTS
 * Provides GET and QUERY hook handlers for Relay protocol
 *
 * QUERY Hook:
 *   - Search YTS by movie title embedded in the query. Supports filters like: "Alien source:yts"
 * GET Hooks:
 *   - /view/yts/{title} — Display a basic movie view with discovered torrent sources
 */

// Utilities borrowed and adapted from template-ui/site/movies/yts/query_yts.js
function getDomainFromEnv(env) {
  const d = (env && env.RELAY_PUBLIC_YTS_DOMAIN) ? String(env.RELAY_PUBLIC_YTS_DOMAIN).trim() : ''
  return d || 'yts.lt'
}

// Prefer repo-aware fetch from context when available
const repoFetch = (typeof window !== 'undefined' && window.__ctx__ && window.__ctx__.helpers && window.__ctx__.helpers.fetch)
  ? window.__ctx__.helpers.fetch
  : fetch;

async function loadEnvOnce() {
  if (typeof loadEnvOnce._cache !== 'undefined') return loadEnvOnce._cache
  try {
    const ctx = (typeof window !== 'undefined' && window.__ctx__ && window.__ctx__.helpers) ? window.__ctx__.helpers : null
    if (ctx && typeof ctx.fetchJson === 'function') {
      return (loadEnvOnce._cache = await ctx.fetchJson('/hooks/env.json'))
    }
    const res = await repoFetch('/hooks/env.json')
    if (!res.ok) return (loadEnvOnce._cache = {})
    return (loadEnvOnce._cache = await res.json())
  } catch (e) {
    return (loadEnvOnce._cache = {})
  }
}

function buildYtsBrowseUrl(domain, title) {
  const t = encodeURIComponent(String(title || '').trim())
  return `https://${domain}/browse-movies/${t}/all/all/0/latest/0/all`
}

function extractMoviePageUrl(html, domain) {
  if (!html) return null
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const a = doc.querySelector('a.browse-movie-link[href*="/movies/"]')
    if (a) {
      const href = a.getAttribute('href') || ''
      if (href.startsWith('http')) return href
      if (href.startsWith('//')) return 'https:' + href
      if (href.startsWith('/')) return `https://${domain}${href}`
    }
    const any = doc.querySelector('a[href*="/movies/"]')
    if (any) {
      const href = any.getAttribute('href') || ''
      if (href.startsWith('http')) return href
      if (href.startsWith('//')) return 'https:' + href
      if (href.startsWith('/')) return `https://${domain}${href}`
    }
  } catch { }
  const d = domain.replace(/\./g, '\\.')
  const reHref = new RegExp(`<a[^>]+href=["'](https?:\/\/[^"']*\/movies\/[^"']+|\/\/[^"']*\/movies\/[^"']+|\/movies\/[^"']+)["'][^>]*>`, 'i')
  const mHref = html.match(reHref)
  if (mHref && mHref[1]) {
    const href = mHref[1]
    if (href.startsWith('http')) return href
    if (href.startsWith('//')) return 'https:' + href
    if (href.startsWith('/')) return `https://${domain}${href}`
  }
  const reAbs = new RegExp(`https?://${d}/movies/[^"'<>\s]+`, 'i')
  const mAbs = html.match(reAbs)
  if (mAbs && mAbs[0]) return mAbs[0]
  return null
}

function base32ToHex(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of s.toUpperCase()) {
    const v = alphabet.indexOf(ch)
    if (v < 0) return null
    bits += v.toString(2).padStart(5, '0')
  }
  let out = ''
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const nibble = parseInt(bits.slice(i, i + 4), 2)
    out += nibble.toString(16)
  }
  if (out.length >= 40) return out.slice(0, 40)
  return out.padEnd(40, '0')
}

function normalizeInfoHash(btih) {
  if (!btih) return null
  const s = String(btih).trim()
  if (/^[a-fA-F0-9]{40}$/.test(s)) return s.toLowerCase()
  if (/^[a-zA-Z2-7]{32}$/.test(s)) {
    const hex = base32ToHex(s)
    return hex ? hex.toLowerCase() : null
  }
  const m = s.match(/urn:btih:([^&]+)/i)
  if (m) return normalizeInfoHash(decodeURIComponent(m[1]))
  return null
}

function extractTorrents(html, domain) {
  const results = []
  const seen = new Set()
  const reDl = new RegExp(`https?://${domain.replace(/\./g, '\\.')}/torrent/download/([a-fA-F0-9]{40})`, 'g')
  for (const m of html.matchAll(reDl)) {
    const hash = (m[1] || '').toLowerCase()
    if (!hash || seen.has(hash)) continue
    seen.add(hash)
    const idx = m.index || 0
    const ctx = html.slice(Math.max(0, idx - 300), Math.min(html.length, idx + 300))
    const quality = (ctx.match(/\b(2160p|1080p|720p|480p)\b/i) || [])[0] || ''
    const size = (ctx.match(/\b(\d+(?:\.\d+)?\s?(?:GB|MB))\b/i) || [])[0] || ''
    const desc = [quality.toUpperCase(), size.toUpperCase()].filter(Boolean).join(' ').trim()
    results.push({ hash, description: desc || 'YTS download', href_download: m[0], href_magnet: null, source: 'yts' })
  }
  const reMag = /href\s*=\s*"(magnet:\?[^"\s]+)"/gi
  for (const m of html.matchAll(reMag)) {
    const href = m[1]
    let hash = null
    try {
      const url = new URL(href)
      const xt = url.searchParams.get('xt') || ''
      const mm = xt.match(/urn:btih:([^&]+)/i)
      if (mm) hash = normalizeInfoHash(decodeURIComponent(mm[1]))
      if (!hash) continue
      if (seen.has(hash)) continue
      seen.add(hash)
      const name = url.searchParams.get('dn') || ''
      const quality = (name.match(/\b(2160p|1080p|720p|480p)\b/i) || [])[0] || ''
      const desc = [name, quality.toUpperCase()].filter(Boolean).join(' ').trim()
      results.push({ hash, description: desc || 'Magnet', href_download: null, href_magnet: href, source: 'yts' })
    } catch { }
  }
  return results
}

async function queryYtsForTorrents(title) {
  const t = String(title || '').trim()
  if (!t) return { domain: null, browseUrl: null, movieUrl: null, torrents: [] }
  const env = await loadEnvOnce()
  const domain = getDomainFromEnv(env)
  const browseUrl = buildYtsBrowseUrl(domain, t)
  try {
    const res = await fetch(browseUrl, { method: 'GET' })
    if (!res.ok) return { domain, browseUrl, movieUrl: null, torrents: [] }
    const html1 = await res.text()
    const movieUrl = extractMoviePageUrl(html1, domain)
    if (!movieUrl) return { domain, browseUrl, movieUrl: null, torrents: [] }
    const res2 = await fetch(movieUrl, { method: 'GET' })
    if (!res2.ok) return { domain, browseUrl, movieUrl, torrents: [] }
    const html2 = await res2.text()
    const torrents = extractTorrents(html2, domain)
    return { domain, browseUrl, movieUrl, torrents }
  } catch {
    return { domain, browseUrl, movieUrl: null, torrents: [] }
  }
}

function parseQueryFilters(raw) {
  const filters = {}
  const terms = []
  String(raw || '').split(/\s+/).forEach((part) => {
    const m = part.match(/^([a-zA-Z0-9_\-]+):(.*)$/)
    if (m) {
      filters[m[1].toLowerCase()] = m[2]
    } else if (part) {
      terms.push(part)
    }
  })
  return { text: terms.join(' ').trim(), filters }
}

function mapYtsItemsToInternal(title, yts) {
  const items = (yts.torrents || []).map((t, idx) => ({
    id: title,
    title,
    year: null,
    source: 'yts',
    poster_url: null,
    backdrop_url: null,
    overview: t.description || 'Torrent from YTS',
    seeds: undefined,
    peers: undefined,
    torrents: [{ hash: t.hash, description: t.description, href_download: t.href_download, href_magnet: t.href_magnet }],
    sources: [`torrent://${t.hash}`],
  }))
  return { items, total: items.length, page: 1 }
}

export async function handleQuery(query, options, ctx) {
  if (!query || typeof query !== 'string') return null
  const { text, filters } = parseQueryFilters(query)
  if (filters.source && String(filters.source).toLowerCase() !== 'yts') {
    // This plugin only handles yts-filtered searches
    return null
  }
  const title = text || query
  const yts = await queryYtsForTorrents(title)
  return mapYtsItemsToInternal(title, yts)
}

export async function handleGetRequest(path, { createElement: h, helpers }) {
  // /view/yts/{title}
  const m = path.match(/^\/view\/yts\/(.+)$/)
  if (!m) return null
  const title = decodeURIComponent(m[1])
  const yts = await queryYtsForTorrents(title)
  const mapped = mapYtsItemsToInternal(title, yts)

  // Try to reuse MovieView renderer if available
  let movieView = null
  try {
    const comp = await import('../components/MovieView.jsx')
    movieView = comp && comp.renderMovieView
  } catch { }

  const movie = {
    title,
    overview: `YTS results for ${title}.`,
    sources: mapped.items.flatMap((i) => i.sources || []),
  }

  if (movieView) {
    return movieView(
      h,
      movie,
      () => helpers.navigate && helpers.navigate('/'),
      null,
      helpers.navigate
    )
  }

  // Fallback minimal UI
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      {movie.sources && movie.sources.length > 0 ? (
        <div className="text-sm text-gray-300">Found {movie.sources.length} source(s)</div>
      ) : (
        <div className="text-sm text-gray-300">No sources found</div>
      )}
    </div>
  )
}

export default {
  handleQuery,
  handleGetRequest,
}
