/**
 * Client-side GET hook for Relay
 * 
 * Routes based on path:
 * - /view/[source]/[id] — Single item detail view (e.g., movie from TMDB)
 * - /search?q=[query] — Search results UI
 * - Everything else — Default file rendering
 * 
 * Receives context with:
 * - React, createElement, FileRenderer, Layout, params, helpers
 * 
 * Should return a React element, structured data, or false if not applicable
 */

// Genre cache for TMDB
let genreCache = null;

async function fetchTmdbCredentials() {
  try {
    const envResp = await fetch('/hooks/env.json');
    if (!envResp.ok) return null;
    const env = await envResp.json();
    return {
      apiKey: env.RELAY_PUBLIC_TMDB_API_KEY,
      bearerToken: env.RELAY_PUBLIC_TMDB_BEARER || env.RELAY_PUBLIC_TMDB_READ_ACCESS_ID,
    };
  } catch (err) {
    console.error('[get-client] Error fetching credentials:', err);
    return null;
  }
}

async function fetchGenres(apiKey, bearerToken) {
  if (genreCache) return genreCache;

  try {
    const params = new URLSearchParams({ language: 'en-US' });
    if (apiKey) params.set('api_key', apiKey);

    const url = `https://api.themoviedb.org/3/genre/movie/list?${params.toString()}`;
    const headers = {};
    if (bearerToken) {
      headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) return {};

    const data = await resp.json();
    genreCache = {};
    (data.genres || []).forEach((g) => { genreCache[g.id] = g.name; });
    return genreCache;
  } catch (err) {
    console.error('[get-client] Error fetching genres:', err);
    return {};
  }
}

async function fetchTmdbMovie(id, apiKey, bearerToken) {
  const params = new URLSearchParams({ language: 'en-US' });
  if (apiKey) params.set('api_key', apiKey);

  const url = `https://api.themoviedb.org/3/movie/${id}?${params.toString()}`;
  const headers = {};
  if (bearerToken) {
    headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  }

  const resp = await fetch(url, { headers });
  if (!resp.ok) return null;
  return resp.json();
}

async function searchTmdb(query, apiKey, bearerToken) {
  const params = new URLSearchParams({
    query,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  });
  if (apiKey) params.set('api_key', apiKey);

  const url = `https://api.themoviedb.org/3/search/movie?${params.toString()}`;
  const headers = {};
  if (bearerToken) {
    headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  }

  const resp = await fetch(url, { headers });
  if (!resp.ok) return { items: [], total: 0 };

  const data = await resp.json();
  const genreMap = await fetchGenres(apiKey, bearerToken);

  const items = (data.results || []).map((item) => ({
    ...item,
    source: 'tmdb',
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
    genre_names: (item.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
  }));

  return { items, total: data.total_results || 0, page: data.page || 1 };
}

/**
 * Render single movie detail view
 */
function renderMovieView(h, movie, onBack) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;
  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;

  return h('div', { className: 'movie-detail space-y-6' },
    // Back button
    h('button', {
      onClick: onBack,
      className: 'px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700',
    }, '← Back'),

    // Backdrop
    backdropUrl && h('div', { className: 'relative w-full h-64 md:h-96 overflow-hidden rounded-lg' },
      h('img', {
        src: backdropUrl,
        alt: `${movie.title} backdrop`,
        className: 'w-full h-full object-cover',
      }),
      h('div', { className: 'absolute inset-0 bg-gradient-to-t from-black/60 to-transparent' }),
    ),

    // Main content
    h('div', { className: 'flex flex-col md:flex-row gap-6' },
      // Poster
      posterUrl && h('div', { className: 'flex-shrink-0' },
        h('img', {
          src: posterUrl,
          alt: movie.title,
          className: 'w-48 md:w-64 rounded-lg shadow-lg',
        }),
      ),

      // Info
      h('div', { className: 'flex-1 space-y-4' },
        h('h1', { className: 'text-3xl font-bold text-gray-900 dark:text-white' }, movie.title),
        movie.tagline && h('p', { className: 'text-lg italic text-gray-600 dark:text-gray-400' }, movie.tagline),

        h('div', { className: 'flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400' },
          movie.release_date && h('span', null, `📅 ${movie.release_date}`),
          movie.runtime && h('span', null, `⏱️ ${movie.runtime} min`),
          movie.vote_average && h('span', null, `⭐ ${movie.vote_average.toFixed(1)}/10`),
          movie.status && h('span', null, `🎬 ${movie.status}`),
        ),

        movie.genres && movie.genres.length > 0 && h('div', { className: 'flex flex-wrap gap-2' },
          movie.genres.map((g) =>
            h('span', {
              key: g.id,
              className: 'px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm',
            }, g.name)
          )
        ),

        h('div', { className: 'space-y-2' },
          h('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-white' }, 'Overview'),
          h('p', { className: 'text-gray-700 dark:text-gray-300 leading-relaxed' }, movie.overview || 'No overview available.'),
        ),

        // Additional details
        h('div', { className: 'grid grid-cols-2 gap-4 text-sm' },
          movie.budget > 0 && h('div', null,
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Budget: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, `$${movie.budget.toLocaleString()}`),
          ),
          movie.revenue > 0 && h('div', null,
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Revenue: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, `$${movie.revenue.toLocaleString()}`),
          ),
          movie.original_language && h('div', null,
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Language: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, movie.original_language.toUpperCase()),
          ),
          movie.production_companies && movie.production_companies.length > 0 && h('div', { className: 'col-span-2' },
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Production: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, movie.production_companies.map((c) => c.name).join(', ')),
          ),
        ),

        // External links
        h('div', { className: 'flex gap-4 pt-4' },
          movie.homepage && h('a', {
            href: movie.homepage,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700',
          }, '🌐 Official Site'),
          movie.imdb_id && h('a', {
            href: `https://www.imdb.com/title/${movie.imdb_id}`,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600',
          }, '🎬 IMDb'),
        ),
      ),
    ),
  );
}

export default async function get(context) {
  const { React, createElement: h, FileRenderer, Layout, params, helpers } = context;
  const path = params.path || '';

  console.debug('[get-client] Processing path:', path);

  // Route: /view/[source]/[id] — Single item detail view
  const viewMatch = path.match(/^\/view\/([^/]+)\/(\d+)$/);
  if (viewMatch) {
    const [, source, id] = viewMatch;
    console.debug('[get-client] View route matched:', { source, id });

    if (source === 'tmdb') {
      const creds = await fetchTmdbCredentials();
      if (!creds || (!creds.apiKey && !creds.bearerToken)) {
        return h('div', { className: 'p-8 text-red-500' }, 'TMDB credentials not configured');
      }

      const movie = await fetchTmdbMovie(id, creds.apiKey, creds.bearerToken);
      if (!movie) {
        return h('div', { className: 'p-8 text-red-500' }, `Movie not found: ${id}`);
      }

      const onBack = () => {
        if (helpers.navigate) {
          helpers.navigate('/search');
        } else if (typeof window !== 'undefined') {
          window.history.back();
        }
      };

      return renderMovieView(h, movie, onBack);
    }

    // source: local — future implementation
    if (source === 'local') {
      return h('div', { className: 'p-8 text-yellow-500' }, 'Local source view not yet implemented');
    }

    return h('div', { className: 'p-8 text-red-500' }, `Unknown source: ${source}`);
  }

  // Route: /search* — Search results
  if (path.startsWith('/search')) {
    const query = params.q || '';
    console.debug('[get-client] Search route matched, query:', query);

    if (!query) {
      return {
        type: 'search-ui',
        items: [],
        total: 0,
        message: 'Enter a search query above',
      };
    }

    const creds = await fetchTmdbCredentials();
    if (!creds || (!creds.apiKey && !creds.bearerToken)) {
      return {
        type: 'search-ui',
        items: [],
        total: 0,
        error: 'TMDB credentials not configured',
      };
    }

    const results = await searchTmdb(query, creds.apiKey, creds.bearerToken);
    return {
      type: 'search-ui',
      items: results.items,
      total: results.total,
      page: results.page,
      query,
    };
  }

  // Default: fetch and render file
  if (!path) {
    return false;
  }

  try {
    const url = helpers.buildPeerUrl(path);
    const headers = {
      'X-Relay-Branch': params.branch || 'main',
      'X-Relay-Repo': params.repo || 'template',
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get('content-type');
    const content = await response.text();

    return h(
      FileRenderer,
      {
        content,
        contentType,
        path,
        branch: params.branch,
      },
      null
    );
  } catch (error) {
    console.error('[get-client] Error fetching file:', error);
    return false;
  }
}
