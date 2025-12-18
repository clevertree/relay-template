/**
 * TMDB Plugin - Handles all TMDB-related logic
 * Provides GET and QUERY hook handlers for Relay protocol
 *
 * GET Hooks:
 *   - /view/tmdb/{id} — Display movie details
 *   - /create/tmdb/{id} — Pre-fill form from TMDB
 *
 * QUERY Hook:
 *   - Search movies across TMDB
 */

let genreCache = null;

/**
 * Extract TMDB API credentials from environment
 */
function getTmdbCredentials(env) {
    if (!env) {
        return { error: 'No environment provided' };
    }
    if (env.error) {
        return { error: env.error };
    }
    return {
        apiKey: env.RELAY_PUBLIC_TMDB_API_KEY,
        bearerToken: env.RELAY_PUBLIC_TMDB_READ_ACCESS_ID,
    };
}

/**
 * Fetch and cache genre mapping from TMDB
 */
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
        (data.genres || []).forEach((g) => {
            genreCache[g.id] = g.name;
        });
        return genreCache;
    } catch (err) {
        console.error('[tmdb-plugin] Error fetching genres:', err);
        return {};
    }
}

/**
 * Fetch a single movie by ID from TMDB
 */
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

/**
 * Search TMDB for movies matching a query
 */
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
    if (!resp.ok) return { items: [], total: 0, page: 1 };

    const data = await resp.json();
    const genreMap = await fetchGenres(apiKey, bearerToken);

    const items = (data.results || []).map((item) => ({
        ...item,
        source: 'tmdb',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        genre_names: (item.genre_ids || []).map((genreId) => genreMap[genreId]).filter(Boolean),
    }));

    return { items, total: data.total_results || 0, page: data.page || 1 };
}

/**
 * GET Hook Handler
 * Handles GET requests that match TMDB patterns
 *
 * @param {string} path - The request path
 * @param {Object} ctx - Plugin context (React, createElement, FileRenderer, Layout)
 * @returns {Object|null} - Rendered JSX or null if path doesn't match
 */
export async function handleGetRequest(path, { navigate, env } = {}) {
    if (!path) return null;

    // View route: /view/tmdb/[id]
    const viewMatch = path.match(/^\/view\/tmdb\/(\d+)$/);
    if (viewMatch) {
        const id = String(viewMatch[1]);
        console.debug('[tmdb-plugin] GET handler: view route for id:', id);

        try {
            const creds = getTmdbCredentials(env);
            if (creds?.error) {
                return <div className="p-8 text-red-500">TMDB credentials error: {creds.error}</div>;
            }
            if (!creds || (!creds.apiKey && !creds.bearerToken)) {
                return <div className="p-8 text-red-500">TMDB credentials not configured</div>;
            }

            const movieViewComponent = await import('../components/MovieView.jsx');
            const movie = await fetchTmdbMovie(id, creds.apiKey || '', creds.bearerToken || '');

            if (!movie) {
                return <div className="p-8 text-red-500">TMDB unavailable or movie not found: {id}</div>;
            }

            const onBack = () => navigate && navigate('/');

            const onAddToLibrary = () => navigate && navigate(`/create/tmdb/${id}`);

            const renderView = movieViewComponent?.renderMovieView;
            if (!renderView) {
                return <div className="p-4">Movie view component missing</div>;
            }

            return renderView(movie, onBack, onAddToLibrary, navigate);
        } catch (err) {
            console.error('[tmdb-plugin] Error loading movie view:', err);
            return <div className="p-8 text-red-500">Error: {err.message}</div>;
        }
    }

    // Create from TMDB: /create/tmdb/[id]
    const createTmdbMatch = path.match(/^\/create\/tmdb\/(\d+)$/);
    if (createTmdbMatch) {
        const id = String(createTmdbMatch[1]);
        console.debug('[tmdb-plugin] GET handler: create from TMDB for id:', id);

        try {
            const creds = getTmdbCredentials(env);
            if (creds?.error) {
                return <div className="p-8 text-red-500">TMDB credentials error: {creds.error}</div>;
            }
            if (!creds || (!creds.apiKey && !creds.bearerToken)) {
                return <div className="p-8 text-red-500">TMDB credentials not configured</div>;
            }

            const movie = await fetchTmdbMovie(id, creds.apiKey || '', creds.bearerToken || '');
            if (!movie) {
                return <div className="p-8 text-red-500">Movie not found: {id}</div>;
            }

            const createViewComponent = await import('../components/CreateView.jsx');
            const onBack = () => navigate && navigate(`/view/tmdb/${id}`);

            const onSubmit = async (formData) => {
                console.debug('[tmdb-plugin] Create form submitted:', formData);
                alert(`Movie "${formData.title}" would be saved to library!\n\nData: ${JSON.stringify(formData, null, 2)}`);
                if (navigate) navigate('/');
            };

            const renderCreateView = createViewComponent?.renderCreateView;
            if (!renderCreateView) {
                return h('div', { className: 'p-4' }, 'Create view component missing');
            }

            return renderCreateView(movie, onBack, onSubmit);
        } catch (err) {
            console.error('[tmdb-plugin] Error loading create view:', err);
            return <div className="p-8 text-red-500">Error: {err.message}</div>;
        }
    }

    // No match for this plugin
    return null;
}

/**
 * QUERY Hook Handler
 * Handles search requests and combines TMDB results with other sources
 *
 * @param {string} query - Search query string
 * @param {Object} options - Search options (page, source, etc.)
 * @param {Object} ctx - Plugin context
 * @returns {Object|null} - Search results {items, total, page, source} or null if not applicable
 */
export async function handleQuery(query, options, env) {
    if (!query || typeof query !== 'string') return null;

    const source = options?.source || 'tmdb';
    if (source !== 'tmdb' && source !== 'all') return null;

    console.debug('[tmdb-plugin] QUERY handler: searching for:', query);

    try {
        const creds = getTmdbCredentials(env);
        if (creds?.error) {
            console.warn('[tmdb-plugin] TMDB credentials error:', creds.error);
            return { error: `TMDB credentials error: ${creds.error}` };
        }
        if (!creds || (!creds.apiKey && !creds.bearerToken)) {
            console.warn('[tmdb-plugin] TMDB credentials not configured, skipping search');
            return { error: 'TMDB credentials not configured' };
        }

        const results = await searchTmdb(query, creds.apiKey || '', creds.bearerToken || '');
        return {
            ...results,
            source: 'tmdb',
        };
    } catch (err) {
        console.error('[tmdb-plugin] Error searching TMDB:', err);
        return { error: err?.message || String(err) };
    }
}

/**
 * Plugin metadata and exports
 */
export const tmdbPlugin = {
    name: 'tmdb',
    version: '1.0.0',
    handleGetRequest,
    handleQuery,
};

export default tmdbPlugin;
