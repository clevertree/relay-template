#!/usr/bin/env node
// tmdb.tsx — TMDB API source plugin for GET and QUERY hooks (client-side friendly)

function env(name: string, def?: string) {
  const v = typeof process !== 'undefined'
    ? (process as unknown as { env?: Record<string, string | undefined> }).env?.[name]
    : undefined
  return v == null ? def : v
}

// Load TMDB API credentials from environment (Node) or from /hooks/env.json (browser)
export type TmdbAuth = { type: 'key'; apiKey: string } | { type: 'bearer'; token: string }
export async function getTmdbAuth(): Promise<null | TmdbAuth> {
  try {
    const apiKey = env('RELAY_PUBLIC_TMDB_API_KEY') || env('TMDB_API_KEY');
    const bearerToken = env('RELAY_PUBLIC_TMDB_BEARER') || env('RELAY_PUBLIC_TMDB_READ_ACCESS_ID') || env('TMDB_BEARER_TOKEN');
    if (apiKey) return { type: 'key', apiKey };
    if (bearerToken) {
      const token = /^Bearer\s+/i.test(bearerToken) ? bearerToken : `Bearer ${bearerToken}`;
      return { type: 'bearer', token } as const;
    }
  } catch {}

  // Browser path: fetch env.json
  try {
    const resp = await fetch('/hooks/env.json');
    if (resp && resp.ok) {
      const envj = await resp.json();
      const apiKey = envj.RELAY_PUBLIC_TMDB_API_KEY || envj.TMDB_API_KEY;
      const bearer = envj.RELAY_PUBLIC_TMDB_BEARER || envj.RELAY_PUBLIC_TMDB_READ_ACCESS_ID || envj.TMDB_BEARER_TOKEN;
      if (apiKey) return { type: 'key', apiKey };
      if (bearer) {
        const token = /^Bearer\s+/i.test(bearer) ? bearer : `Bearer ${bearer}`;
        return { type: 'bearer', token } as const;
      }
    }
  } catch {}
  return null;
}

function buildHeaders(auth?: Awaited<ReturnType<typeof getTmdbAuth>> | null): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (!auth) return headers;
  if (auth.type === 'bearer') headers['Authorization'] = auth.token;
  return headers;
}

function buildTmdbUrl(endpoint: string, auth: Awaited<ReturnType<typeof getTmdbAuth>> | null, params: Record<string, string> = {}) {
  const base = `https://api.themoviedb.org/3${endpoint}`;
  const qs = new URLSearchParams(params);
  if (auth?.type === 'key') qs.set('api_key', auth.apiKey);
  const url = qs.toString() ? `${base}?${qs.toString()}` : base;
  return url;
}

// Fetch a movie from TMDB by ID
import type { TMDBMovie } from '../../types'
export async function getFromTmdb(movieId: string | number): Promise<TMDBMovie | null> {
  if (!movieId) return null;
  const auth = await getTmdbAuth();
  if (!auth) {
    console.error('TMDB: No API credentials found');
    return null;
  }
  try {
    const url = buildTmdbUrl(`/movie/${encodeURIComponent(String(movieId).trim())}`, auth, { language: 'en-US' });
    const headers = buildHeaders(auth);
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      console.error(`TMDB: GET failed (${resp.status}): ${resp.statusText}`);
      return null;
    }
    const movie = (await resp.json()) as unknown
    return mapTmdbMovie(movie);
  } catch (err) {
    console.error('TMDB: GET error:', err);
    return null;
  }
}

// Search TMDB for movies by query
export interface TmdbQueryResult { results: TMDBMovie[]; total: number; page: number }
export async function queryFromTmdb(searchQuery: string, page = 0, limit = 10): Promise<TmdbQueryResult> {
  if (!searchQuery || typeof searchQuery !== 'string') {
    return { results: [], total: 0, page: 0 };
  }
  const auth = await getTmdbAuth();
  if (!auth) {
    console.error('TMDB: No API credentials found');
    return { results: [], total: 0, page: 0 };
  }
  try {
    const url = buildTmdbUrl('/search/movie', auth, {
      query: searchQuery.trim(),
      include_adult: 'false',
      language: 'en-US',
      page: String(Math.max(1, Number(page || 0) + 1))
    });
    const headers = buildHeaders(auth);
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      console.error(`TMDB: QUERY failed (${resp.status}): ${resp.statusText}`);
      return { results: [], total: 0, page };
    }
    const data = (await resp.json()) as unknown as { results?: unknown[]; total_results?: number; page?: number }
    const results = (Array.isArray(data.results) ? data.results : [])
      .slice(0, limit)
      .map((m) => mapTmdbMovie(m))
    return { results, total: data.total_results || 0, page: (data.page as number) || page };
  } catch (err) {
    console.error('TMDB: QUERY error:', err);
    return { results: [], total: 0, page };
  }
}

function mapTmdbMovie(movie: unknown): TMDBMovie {
  return (movie || {}) as TMDBMovie
}
