#!/usr/bin/env node
// tmdb.mjs — TMDB API source plugin for GET and QUERY hooks
// Provides functions to fetch movies from TMDB API by ID or search query

function env(name, def) { const v = process.env[name]; return v == null ? def : v; }

// Load TMDB API credentials from environment
function getTmdbAuth() {
  const apiKey = env('RELAY_PUBLIC_TMDB_API_KEY') || env('TMDB_API_KEY');
  const bearerToken = env('RELAY_PUBLIC_TMDB_BEARER') || env('RELAY_PUBLIC_TMDB_READ_ACCESS_ID') || env('TMDB_BEARER_TOKEN');
  
  if (apiKey) {
    return { type: 'key', apiKey };
  }
  if (bearerToken) {
    const token = /^Bearer\s+/i.test(bearerToken) ? bearerToken : `Bearer ${bearerToken}`;
    return { type: 'bearer', token };
  }
  return null;
}

// Build fetch headers for TMDB API
function buildHeaders(auth) {
  const headers = { 'Accept': 'application/json' };
  if (!auth) return headers;
  
  if (auth.type === 'bearer') {
    headers['Authorization'] = auth.token;
  }
  return headers;
}

// Build TMDB API URL with authentication
function buildTmdbUrl(endpoint, auth, params = {}) {
  const base = `https://api.themoviedb.org/3${endpoint}`;
  const qs = new URLSearchParams(params);
  
  if (auth?.type === 'key') {
    qs.set('api_key', auth.apiKey);
  }
  
  const url = qs.toString() ? `${base}?${qs.toString()}` : base;
  return url;
}

// Fetch a movie from TMDB by ID
export async function getFromTmdb(movieId) {
  if (!movieId) return null;
  
  const auth = getTmdbAuth();
  if (!auth) {
    console.error('TMDB: No API credentials found');
    return null;
  }
  
  try {
    const url = buildTmdbUrl(`/movie/${encodeURIComponent(String(movieId).trim())}`, auth, {
      language: 'en-US'
    });
    const headers = buildHeaders(auth);
    
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      console.error(`TMDB: GET failed (${resp.status}): ${resp.statusText}`);
      return null;
    }
    
    const movie = await resp.json();
    return mapTmdbMovie(movie);
  } catch (err) {
    console.error('TMDB: GET error:', err);
    return null;
  }
}

// Search TMDB for movies by query
export async function queryFromTmdb(searchQuery, page = 0, limit = 10) {
  if (!searchQuery || typeof searchQuery !== 'string') {
    return { results: [], total: 0 };
  }
  
  const auth = getTmdbAuth();
  if (!auth) {
    console.error('TMDB: No API credentials found');
    return { results: [], total: 0 };
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
      return { results: [], total: 0 };
    }
    
    const data = await resp.json();
    const results = (Array.isArray(data.results) ? data.results : [])
      .slice(0, limit)
      .map(mapTmdbMovie);
    
    return {
      results,
      total: data.total_results || 0,
      page: data.page || page
    };
  } catch (err) {
    console.error('TMDB: QUERY error:', err);
    return { results: [], total: 0 };
  }
}

// Map TMDB API response to pass through TMDB's native format
function mapTmdbMovie(movie) {
  // Return TMDB's native format - let the repository/consumer decide how to use it
  return movie;
}
