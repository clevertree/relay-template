/**
 * query-client.tsx — Repository-owned UI for search/query routes
 * JSX is transpiled by RepoBrowser using @babel/standalone
 */
import type { HookContext, TMDBMovie } from './types'

export default async function queryHook(ctx: HookContext) {
  const { createElement: h, params } = ctx
  const qRaw = params?.q
  const source = (params?.source as string) || 'tmdb'

  if (!qRaw || typeof qRaw !== 'string' || !qRaw.trim()) {
    return <div className="p-4 text-gray-600">Enter a search query</div>
  }
  const q = qRaw.trim()

  try {
    let results: TMDBMovie[] = []
    let total = 0

    if (source === 'tmdb') {
      const mod = await import('./lib/sources/tmdb.ts')
      const out = await mod.queryFromTmdb(q, 0, 20)
      results = out.results || []
      total = out.total || 0
    } else {
      return <div className="p-4 text-red-500">Unknown source: {String(source)}</div>
    }

    if (!Array.isArray(results) || results.length === 0) {
      return <div className="p-4">No results for "{q}"</div>
    }

    return (
      <div className="p-4">
        <div className="mb-3 text-sm text-gray-600">{total} results for "{q}"</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {results.map((item) => {
            const id = item.id ?? item.tmdb_id
            const img = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null
            const title = item.title ?? item.name ?? `#${id}`
            return (
              <a key={String(id)} href={`/view/${source}/${id}`} className="no-underline text-inherit block group">
                <div className="rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                  {img ? (
                    <img src={img} alt={title} className="w-full aspect-[2/3] object-cover group-hover:opacity-90 transition" />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500">No image</div>
                  )}
                  <div className="p-2 text-sm truncate">{title}</div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    )
  } catch (err) {
    console.error('[query-client] Error:', err)
    return <div className="p-4 text-red-600">Error: {err instanceof Error ? err.message : String(err)}</div>
  }
}
