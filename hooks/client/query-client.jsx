/**
 * query-client.jsx — Repository-owned UI for search/query routes with pagination and source filters
 */

export default async function queryHook({ params, navigate, env } = {}) {
  const qRaw = params?.q
  const page = parseInt(params?.page || '1', 10)
  const pageSize = parseInt(params?.pageSize || '20', 10)

  if (!qRaw || typeof qRaw !== 'string' || !qRaw.trim()) {
    return <div className="p-4 text-gray-500">Enter a search query</div>
  }
  const q = qRaw.trim()

  function parseFilters(input) {
    const filters = {}
    const terms = []
    String(input || '').split(/\s+/).forEach((part) => {
      const m = part.match(/^([a-zA-Z0-9_\-]+):(.*)$/)
      if (m) filters[m[1].toLowerCase()] = m[2]
      else if (part) terms.push(part)
    })
    return { text: terms.join(' ').trim(), filters }
  }

  try {
    const { text, filters } = parseFilters(q)
    const requestedSource = (filters.source || params?.source || 'tmdb').toLowerCase()

    // Load components
    const movieResultsComponent = await import('./components/MovieResults.jsx')

    let results = []
    let total = 0
    let sourceUsed = requestedSource

    async function runTmdb() {
      const mod = await import('./plugin/tmdb.mjs')
      const out = await mod.handleQuery(text || q, { source: 'tmdb', page, pageSize }, env)
      return out || { items: [], total: 0 }
    }
    async function runYts() {
      const mod = await import('./plugin/yts.mjs')
      const out = await mod.handleQuery(q, { source: 'yts', page, pageSize }, env)
      return out || { items: [], total: 0 }
    }

    if (requestedSource === 'yts') {
      const out = await runYts()
      if (out?.error) {
        return <div className="p-4 text-red-500">YTS error: {out.error}</div>
      }
      results = out.items || []
      total = out.total || results.length
      sourceUsed = 'yts'
    } else if (requestedSource === 'tmdb') {
      const out = await runTmdb()
      if (out?.error) {
        return <div className="p-4 text-red-500">TMDB error: {out.error}</div>
      }
      results = out.items || out.results || []
      total = out.total || (out.items ? out.items.length : 0)
      sourceUsed = 'tmdb'
    } else if (requestedSource === 'all') {
      const [tm, yt] = await Promise.all([runTmdb(), runYts()])
      const errors = [tm?.error, yt?.error].filter(Boolean)
      if (errors.length === 2) {
        return <div className="p-4 text-red-500">Errors: {errors.join(' | ')}</div>
      }
      results = [...(tm.items || tm.results || []), ...(yt.items || [])]
      total = (tm.total || 0) + (yt.total || 0)
      sourceUsed = 'all'
    } else {
      return <div className="p-4 text-red-500">Unknown source: {String(requestedSource)}</div>
    }

    if (!Array.isArray(results) || results.length === 0) {
      return <div className="p-4">No results for "{q}" on page {page}</div>
    }

    const onViewMovie = (id, viewSource) => {
      if (!navigate) return
      const src = viewSource || sourceUsed
      if (src === 'yts') {
        navigate(`/view/yts/${encodeURIComponent(id || (text || q))}`)
      } else if (src === 'tmdb') {
        navigate(`/view/tmdb/${id}`)
      }
    }

    const resultsUI = movieResultsComponent?.renderMovieResults(results, sourceUsed, null, onViewMovie)
    return (
      <div className="p-4">
        <div className="text-sm text-gray-500 mb-3">{total} results for "{q}"</div>
        {resultsUI}
      </div>
    )
  } catch (err) {
    console.error('[query-client] Error:', err)
    return <div className="p-4 text-red-600">Error: {err instanceof Error ? err.message : String(err)}</div>
  }
}
