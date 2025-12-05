/**
 * Client-side TMDB API utilities (TypeScript)
 * Runs in the browser and fetches data from TMDB API
 */

type Credentials = { apiKey?: string; bearerToken?: string } | null

let genreCache: Record<string, string> | null = null

export async function fetchTmdbCredentials(): Promise<Credentials> {
  try {
    const envResp = await fetch('/hooks/env.json')
    if (!envResp.ok) return null
    const env = await envResp.json()
    return {
      apiKey: env.RELAY_PUBLIC_TMDB_API_KEY as string | undefined,
      bearerToken: (env.RELAY_PUBLIC_TMDB_BEARER || env.RELAY_PUBLIC_TMDB_READ_ACCESS_ID) as string | undefined,
    }
  } catch (err) {
    console.error('[tmdb-client] Error fetching credentials:', err)
    return null
  }
}

export async function fetchGenres(apiKey?: string, bearerToken?: string): Promise<Record<string, string>> {
  if (genreCache) return genreCache

  try {
    const params = new URLSearchParams({ language: 'en-US' })
    if (apiKey) params.set('api_key', apiKey)

    const url = `https://api.themoviedb.org/3/genre/movie/list?${params.toString()}`
    const headers: Record<string, string> = {}
    if (bearerToken) {
      headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`
    }

    const resp = await fetch(url, { headers })
    if (!resp.ok) return {}

    const data = (await resp.json()) as { genres?: Array<{ id: number; name: string }> }
    genreCache = {}
    ;(data.genres || []).forEach((g) => { (genreCache as Record<string,string>)[g.id] = g.name })
    return genreCache
  } catch (err) {
    console.error('[tmdb-client] Error fetching genres:', err)
    return {}
  }
}

export async function fetchTmdbMovie(id: string | number, apiKey?: string, bearerToken?: string): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ language: 'en-US' })
  if (apiKey) params.set('api_key', apiKey)

  const url = `https://api.themoviedb.org/3/movie/${encodeURIComponent(String(id))}?${params.toString()}`
  const headers: Record<string, string> = {}
  if (bearerToken) {
    headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`
  }

  const resp = await fetch(url, { headers })
  if (!resp.ok) return null
  return (await resp.json()) as Record<string, unknown>
}

export async function searchTmdb(query: string, apiKey?: string, bearerToken?: string): Promise<{ items: Array<Record<string, unknown>>; total: number; page: number }>
{
  const params = new URLSearchParams({
    query,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  })
  if (apiKey) params.set('api_key', apiKey)

  const url = `https://api.themoviedb.org/3/search/movie?${params.toString()}`
  const headers: Record<string, string> = {}
  if (bearerToken) {
    headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`
  }

  const resp = await fetch(url, { headers })
  if (!resp.ok) return { items: [], total: 0, page: 1 }

  const data = (await resp.json()) as { results?: unknown[]; total_results?: number; page?: number }
  const genreMap = await fetchGenres(apiKey, bearerToken)

  const items = (data.results || []).map((item) => ({
    ...item,
    source: 'tmdb',
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
    genre_names: (item.genre_ids || []).map((id: number) => genreMap[id]).filter(Boolean),
  }))

  return { items, total: data.total_results || 0, page: data.page || 1 }
}
