/**
 * Client-side router hook for Relay
 * 
 * Routes based on path:
 * - /view/[source]/[id] — Single item detail view (e.g., movie from TMDB)
 * - /search/[query] — Search results UI
 * - Everything else — Default file rendering
 * 
 * Receives context with:
 * - React, createElement, FileRenderer, Layout, params, helpers
 *   - helpers.loadModule(path) — Load another local module by path
 * 
 * Should return a React element, structured data, or false if not applicable
 */

// Lazy-loaded modules cache
let tmdbClient = null;
let movieViewComponent = null;
let searchUIHelpers = null;
let createViewComponent = null;

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
    console.error('[router] Error fetching credentials:', err);
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
    console.error('[router] Error fetching genres:', err);
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
function renderMovieView(h, movie, onBack, onAddToLibrary) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;
  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;

  return h('div', { className: 'movie-detail space-y-6' },
    // Back button and Add to Library button
    h('div', { className: 'flex gap-2' },
      h('button', {
        onClick: onBack,
        className: 'px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700',
      }, '← Back'),
      onAddToLibrary && h('button', {
        onClick: onAddToLibrary,
        className: 'px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700',
      }, '➕ Add to Library'),
    ),

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

/**
 * Render create movie form (inline fallback)
 */
function renderCreateView(h, movie, onBack, onSubmit) {
  const posterUrl = movie?.poster_path
    ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    if (data.runtime) data.runtime = parseInt(data.runtime, 10);
    if (data.budget) data.budget = parseInt(data.budget, 10);
    if (data.revenue) data.revenue = parseInt(data.revenue, 10);
    if (data.vote_average) data.vote_average = parseFloat(data.vote_average);
    if (data.genres) {
      data.genres = data.genres.split(',').map(g => g.trim()).filter(Boolean);
    }
    
    if (onSubmit) onSubmit(data);
  };

  return h('div', { className: 'create-movie-form space-y-6 max-w-4xl mx-auto' },
    h('div', { className: 'flex items-center justify-between' },
      h('button', {
        type: 'button',
        onClick: onBack,
        className: 'px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700',
      }, '← Back'),
      h('h1', { className: 'text-2xl font-bold text-gray-900 dark:text-white' }, 'Add Movie to Library'),
      h('div', { className: 'w-20' }),
    ),

    movie?.id && h('div', { className: 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4' },
      h('p', { className: 'text-sm text-blue-700 dark:text-blue-300' },
        `Pre-filled from TMDB ID: ${movie.id}. You can edit any field before saving.`
      ),
    ),

    h('form', { 
      onSubmit: handleSubmit,
      className: 'space-y-6',
    },
      h('div', { className: 'flex flex-col md:flex-row gap-6' },
        posterUrl && h('div', { className: 'flex-shrink-0' },
          h('img', {
            src: posterUrl,
            alt: movie?.title || 'Movie poster',
            className: 'w-32 md:w-48 rounded-lg shadow-lg',
          }),
        ),

        h('div', { className: 'flex-1 space-y-4' },
          h('div', { className: 'space-y-1' },
            h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'title' }, 'Title'),
            h('input', { type: 'text', id: 'title', name: 'title', defaultValue: movie?.title || '', placeholder: 'Movie title', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
          ),
          h('div', { className: 'space-y-1' },
            h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'release_date' }, 'Release Date'),
            h('input', { type: 'date', id: 'release_date', name: 'release_date', defaultValue: movie?.release_date || '', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
          ),
        ),
      ),

      h('div', { className: 'space-y-1' },
        h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'overview' }, 'Overview'),
        h('textarea', { id: 'overview', name: 'overview', defaultValue: movie?.overview || '', rows: 4, placeholder: 'Movie synopsis', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
      ),

      h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
        h('div', { className: 'space-y-1' },
          h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'runtime' }, 'Runtime (min)'),
          h('input', { type: 'number', id: 'runtime', name: 'runtime', defaultValue: movie?.runtime || '', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
        ),
        h('div', { className: 'space-y-1' },
          h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'budget' }, 'Budget ($)'),
          h('input', { type: 'number', id: 'budget', name: 'budget', defaultValue: movie?.budget || '', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
        ),
        h('div', { className: 'space-y-1' },
          h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'revenue' }, 'Revenue ($)'),
          h('input', { type: 'number', id: 'revenue', name: 'revenue', defaultValue: movie?.revenue || '', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
        ),
      ),

      h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        h('div', { className: 'space-y-1' },
          h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'vote_average' }, 'Rating (0-10)'),
          h('input', { type: 'number', id: 'vote_average', name: 'vote_average', step: '0.1', defaultValue: movie?.vote_average?.toFixed(1) || '', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
        ),
        h('div', { className: 'space-y-1' },
          h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'original_language' }, 'Language'),
          h('input', { type: 'text', id: 'original_language', name: 'original_language', defaultValue: movie?.original_language?.toUpperCase() || '', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
        ),
      ),

      h('div', { className: 'space-y-1' },
        h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'genres' }, 'Genres (comma-separated)'),
        h('input', { type: 'text', id: 'genres', name: 'genres', defaultValue: movie?.genres?.map(g => g.name || g).join(', ') || '', placeholder: 'Action, Drama, Sci-Fi', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
      ),

      h('div', { className: 'space-y-1' },
        h('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300', htmlFor: 'homepage' }, 'Homepage URL'),
        h('input', { type: 'url', id: 'homepage', name: 'homepage', defaultValue: movie?.homepage || '', placeholder: 'https://...', className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-800 dark:text-white focus:ring-blue-500 focus:border-blue-500' }),
      ),

      h('div', { className: 'flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700' },
        h('button', {
          type: 'submit',
          className: 'px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors',
        }, '💾 Save to Library'),
        h('button', {
          type: 'button',
          onClick: onBack,
          className: 'px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors',
        }, 'Cancel'),
      ),
    ),
  );
}

export default async function router(context) {
  const { React, createElement: h, FileRenderer, Layout, params, helpers } = context;
  const path = params.path || '';

  console.debug('[router] Processing path:', path);

  // Lazy load modules if needed
  if (helpers.loadModule) {
    if (!tmdbClient) {
      try {
        tmdbClient = await helpers.loadModule('./lib/tmdb-client.mjs');
        console.debug('[router] Loaded tmdb-client module');
      } catch (err) {
        console.warn('[router] Failed to load tmdb-client, using inline functions:', err);
      }
    }
    if (!movieViewComponent) {
      try {
        movieViewComponent = await helpers.loadModule('./lib/components/MovieView.mjs');
        console.debug('[router] Loaded MovieView component');
      } catch (err) {
        console.warn('[router] Failed to load MovieView, using inline function:', err);
      }
    }
    if (!searchUIHelpers) {
      try {
        searchUIHelpers = await helpers.loadModule('./lib/components/SearchUI.mjs');
        console.debug('[router] Loaded SearchUI helpers');
      } catch (err) {
        console.warn('[router] Failed to load SearchUI, using inline objects:', err);
      }
    }
    if (!createViewComponent) {
      try {
        createViewComponent = await helpers.loadModule('./lib/components/CreateView.mjs');
        console.debug('[router] Loaded CreateView component');
      } catch (err) {
        console.warn('[router] Failed to load CreateView:', err);
      }
    }
  }

  // Route: /view/[source]/[id] — Single item detail view
  const viewMatch = path.match(/^\/view\/([^/]+)\/(\d+)$/);
  if (viewMatch) {
    const [, source, id] = viewMatch;
    console.debug('[router] View route matched:', { source, id });

    if (source === 'tmdb') {
      const fetchCreds = tmdbClient?.fetchTmdbCredentials || fetchTmdbCredentials;
      const fetchMovie = tmdbClient?.fetchTmdbMovie || fetchTmdbMovie;
      const renderView = movieViewComponent?.renderMovieView || renderMovieView;

      const creds = await fetchCreds();
      if (!creds || (!creds.apiKey && !creds.bearerToken)) {
        return h('div', { className: 'p-8 text-red-500' }, 'TMDB credentials not configured');
      }

      const movie = await fetchMovie(id, creds.apiKey, creds.bearerToken);
      if (!movie) {
        return h('div', { className: 'p-8 text-red-500' }, `Movie not found: ${id}`);
      }

      const onBack = () => {
        if (helpers.navigate) {
          helpers.navigate('/');
        } else if (typeof window !== 'undefined') {
          window.history.back();
        }
      };

      const onAddToLibrary = () => {
        if (helpers.navigate) {
          helpers.navigate(`/create/tmdb/${id}`);
        }
      };

      return renderView(h, movie, onBack, onAddToLibrary);
    }

    // source: local — future implementation
    if (source === 'local') {
      return h('div', { className: 'p-8 text-yellow-500' }, 'Local source view not yet implemented');
    }

    return h('div', { className: 'p-8 text-red-500' }, `Unknown source: ${source}`);
  }

  // Route: /create/tmdb/[id] — Create form pre-filled with TMDB data
  const createTmdbMatch = path.match(/^\/create\/tmdb\/(\d+)$/);
  if (createTmdbMatch) {
    const [, id] = createTmdbMatch;
    console.debug('[router] Create from TMDB route matched:', { id });

    const fetchCreds = tmdbClient?.fetchTmdbCredentials || fetchTmdbCredentials;
    const fetchMovie = tmdbClient?.fetchTmdbMovie || fetchTmdbMovie;
    const renderCreate = createViewComponent?.renderCreateView || renderCreateView;

    const creds = await fetchCreds();
    if (!creds || (!creds.apiKey && !creds.bearerToken)) {
      return h('div', { className: 'p-8 text-red-500' }, 'TMDB credentials not configured');
    }

    const movie = await fetchMovie(id, creds.apiKey, creds.bearerToken);
    if (!movie) {
      return h('div', { className: 'p-8 text-red-500' }, `Movie not found: ${id}`);
    }

    const onBack = () => {
      if (helpers.navigate) {
        helpers.navigate(`/view/tmdb/${id}`);
      } else if (typeof window !== 'undefined') {
        window.history.back();
      }
    };

    const onSubmit = async (formData) => {
      console.debug('[router] Create form submitted:', formData);
      // TODO: Send to server API to save movie
      // For now, just log and show success message
      alert(`Movie "${formData.title}" would be saved to library!\n\nData: ${JSON.stringify(formData, null, 2)}`);
      if (helpers.navigate) {
        helpers.navigate('/');
      }
    };

    return renderCreate(h, movie, onBack, onSubmit);
  }

  // Route: /create — Empty create form
  if (path === '/create') {
    console.debug('[router] Empty create route');

    const renderCreate = createViewComponent?.renderCreateView || renderCreateView;

    const onBack = () => {
      if (helpers.navigate) {
        helpers.navigate('/');
      } else if (typeof window !== 'undefined') {
        window.history.back();
      }
    };

    const onSubmit = async (formData) => {
      console.debug('[router] Create form submitted:', formData);
      // TODO: Send to server API to save movie
      alert(`Movie "${formData.title}" would be saved to library!\n\nData: ${JSON.stringify(formData, null, 2)}`);
      if (helpers.navigate) {
        helpers.navigate('/');
      }
    };

    return renderCreate(h, null, onBack, onSubmit);
  }

  // Route: /search/[query] — Search results
  const searchMatch = path.match(/^\/search\/(.+)$/);
  if (searchMatch) {
    const query = decodeURIComponent(searchMatch[1]);
    console.debug('[router] Search route matched, query:', query);

    const fetchCreds = tmdbClient?.fetchTmdbCredentials || fetchTmdbCredentials;
    const doSearch = tmdbClient?.searchTmdb || searchTmdb;
    const createSearchUI = searchUIHelpers?.createSearchUIResponse;
    const createSearchError = searchUIHelpers?.createSearchErrorResponse;

    const creds = await fetchCreds();
    if (!creds || (!creds.apiKey && !creds.bearerToken)) {
      if (createSearchError) {
        return createSearchError('TMDB credentials not configured');
      }
      return {
        type: 'search-ui',
        items: [],
        total: 0,
        error: 'TMDB credentials not configured',
      };
    }

    const results = await doSearch(query, creds.apiKey, creds.bearerToken);
    if (createSearchUI) {
      return createSearchUI(results.items, results.total, results.page, query);
    }
    return {
      type: 'search-ui',
      items: results.items,
      total: results.total,
      page: results.page,
      query,
    };
  }

  // Route: /search — Empty search (show search UI without results)
  if (path === '/search') {
    console.debug('[router] Empty search route');
    const createEmpty = searchUIHelpers?.createEmptySearchResponse;
    if (createEmpty) {
      return createEmpty();
    }
    return {
      type: 'search-ui',
      items: [],
      total: 0,
      message: 'Enter a search query above',
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
    console.error('[router] Error fetching file:', error);
    return false;
  }
}
