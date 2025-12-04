#!/usr/bin/env node
/**
 * Client-side query hook - runs in the browser
 * Queries TMDB API directly and returns results for rendering
 */

// Genre cache
let genreCache = null;

async function fetchGenres(apiKey, bearerToken) {
  if (genreCache) {
    console.debug('[query-client] Using cached genres');
    return genreCache;
  }

  try {
    const params_qs = new URLSearchParams({
      language: 'en-US',
    });

    if (apiKey) {
      params_qs.set('api_key', apiKey);
    }

    const url = `https://api.themoviedb.org/3/genre/movie/list?${params_qs.toString()}`;
    const headers = {};
    if (bearerToken) {
      const token = /^Bearer\s+/i.test(bearerToken) ? bearerToken : `Bearer ${bearerToken}`;
      headers['Authorization'] = token;
    }

    console.debug('[query-client] Fetching genres from TMDB...');
    const resp = await fetch(url, { headers });

    if (!resp.ok) {
      console.warn('[query-client] Failed to fetch genres:', resp.statusText);
      return {};
    }

    const data = await resp.json();
    const genreMap = {};
    (data.genres || []).forEach((genre) => {
      genreMap[genre.id] = genre.name;
    });

    genreCache = genreMap;
    console.debug('[query-client] Cached genres:', genreCache);
    return genreCache;
  } catch (err) {
    console.error('[query-client] Error fetching genres:', err);
    return {};
  }
}

export default async function queryHook(ctx) {
  const { React, createElement: h, FileRenderer, Layout, params, helpers } = ctx;
  const { q } = params;

  if (!q) {
    return h(
      'div',
      { style: { padding: '1rem' } },
      h('p', null, 'No search query provided')
    );
  }

  try {
    console.debug('[query-client] Searching for:', q);

    // Fetch environment variables from server (for TMDB API key)
    const envResp = await fetch('/hooks/env.json').catch(() => null);

    const env = envResp?.ok ? await envResp.json() : {};
    console.debug('[query-client] Env loaded:', { hasApiKey: !!env.RELAY_PUBLIC_TMDB_API_KEY });

    // Build TMDB auth
    const apiKey = env.RELAY_PUBLIC_TMDB_API_KEY;
    const bearerToken = env.RELAY_PUBLIC_TMDB_BEARER || env.RELAY_PUBLIC_TMDB_READ_ACCESS_ID;
    
    if (!apiKey && !bearerToken) {
      console.warn('[query-client] No TMDB credentials found');
      return h(
        'div',
        { style: { color: 'orange', padding: '1rem' } },
        h('p', null, 'TMDB API credentials not configured')
      );
    }

    // Fetch and cache genres
    const genreMap = await fetchGenres(apiKey, bearerToken);

    // Query TMDB
    const params_qs = new URLSearchParams({
      query: q,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });

    if (apiKey) {
      params_qs.set('api_key', apiKey);
    }

    const url = `https://api.themoviedb.org/3/search/movie?${params_qs.toString()}`;
    const headers = {};
    if (bearerToken) {
      const token = /^Bearer\s+/i.test(bearerToken) ? bearerToken : `Bearer ${bearerToken}`;
      headers['Authorization'] = token;
    }

    console.debug('[query-client] Fetching from TMDB...');
    const resp = await fetch(url, { headers });

    console.debug('[query-client] TMDB Response:', { status: resp.status, ok: resp.ok });

    if (!resp.ok) {
      return h(
        'div',
        { style: { color: 'red', padding: '1rem' } },
        h('p', null, `TMDB query failed: ${resp.statusText}`)
      );
    }

    const data = await resp.json();
    console.debug('[query-client] Results:', data);

    const items = (data.results || []).map((item) => ({
      ...item,
      // Add full URLs for poster and backdrop images
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
      // Map genre IDs to names instead of showing IDs
      genre_names: (item.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
    }));
    const total = data.total_results || 0;

    if (items.length === 0) {
      return h(
        'div',
        { style: { padding: '1rem' } },
        h('p', null, `No results found for "${q}"`)
      );
    }

    // Return structured data for RepoBrowser to handle rendering
    // The client will detect items/results and render as search results grid
    return {
      items: items,
      total: total,
      page: data.page || 0,
    };
  } catch (err) {
    console.error('[query-client] Error:', err);
    return h(
      'div',
      { style: { color: 'red', padding: '1rem' } },
      h('p', null, `Error: ${err instanceof Error ? err.message : String(err)}`)
    );
  }
}
