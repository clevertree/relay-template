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
 * Fetch TMDB API credentials from environment
 */
async function fetchTmdbCredentials() {
    try {
        const envResp = await fetch('/hooks/env.json');
        if (!envResp.ok) return null;
        const env = await envResp.json();
        return {
            apiKey: env.RELAY_PUBLIC_TMDB_API_KEY,
            bearerToken: env.RELAY_PUBLIC_TMDB_READ_ACCESS_ID,
        };
    } catch (err) {
        console.error('[tmdb-plugin] Error fetching credentials:', err);
        return null;
    }
}

/**
 * Fetch and cache genre mapping from TMDB
 */
async function fetchGenres(apiKey, bearerToken) {
    if (genreCache) return genreCache;

    try {
        const params = new URLSearchParams({language: 'en-US'});
        if (apiKey) params.set('api_key', apiKey);

        const url = `https://api.themoviedb.org/3/genre/movie/list?${params.toString()}`;
        const headers = {};
        if (bearerToken) {
            headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
        }

        const resp = await fetch(url, {headers});
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
    const params = new URLSearchParams({language: 'en-US'});
    if (apiKey) params.set('api_key', apiKey);

    const url = `https://api.themoviedb.org/3/movie/${id}?${params.toString()}`;
    const headers = {};
    if (bearerToken) {
        headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
    }

    const resp = await fetch(url, {headers});
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

    const resp = await fetch(url, {headers});
    if (!resp.ok) return {items: [], total: 0, page: 1};

    const data = await resp.json();
    const genreMap = await fetchGenres(apiKey, bearerToken);

    const items = (data.results || []).map((item) => ({
        ...item,
        source: 'tmdb',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        genre_names: (item.genre_ids || []).map((genreId) => genreMap[genreId]).filter(Boolean),
    }));

    return {items, total: data.total_results || 0, page: data.page || 1};
}

/**
 * GET Hook Handler
 * Handles GET requests that match TMDB patterns
 *
 * @param {string} path - The request path
 * @param {Object} ctx - Plugin context (React, helpers, etc.)
 * @returns {Object|null} - Rendered JSX or null if path doesn't match
 */
export async function handleGetRequest(path, ctx) {
    if (!path) return null;

    const {React, createElement: h, helpers} = ctx;
    if (!h) return null;

    // View route: /view/tmdb/[id]
    const viewMatch = path.match(/^\/view\/tmdb\/(\d+)$/);
    if (viewMatch) {
        const id = String(viewMatch[1]);
        console.debug('[tmdb-plugin] GET handler: view route for id:', id);

        try {
            const creds = await fetchTmdbCredentials();
            if (!creds || (!creds.apiKey && !creds.bearerToken)) {
                return h('div', {className: 'p-8 text-red-500'}, 'TMDB credentials not configured');
            }

            const movieViewComponent = await helpers.loadModule('./components/MovieView.jsx');
            const movie = await fetchTmdbMovie(id, creds.apiKey || '', creds.bearerToken || '');

            if (!movie) {
                return h('div', {className: 'p-8 text-red-500'}, `TMDB unavailable or movie not found: ${id}`);
            }

            const onBack = () => {
                if (helpers.navigate) helpers.navigate('/');
            };

            const onAddToLibrary = () => {
                if (helpers.navigate) helpers.navigate(`/create/tmdb/${id}`);
            };

            const renderView = movieViewComponent?.renderMovieView;
            if (!renderView) {
                return h('div', {className: 'p-4'}, 'Movie view component missing');
            }

            return renderView(h, movie, onBack, onAddToLibrary, helpers.navigate);
        } catch (err) {
            console.error('[tmdb-plugin] Error loading movie view:', err);
            return h('div', {className: 'p-8 text-red-500'}, `Error: ${err.message}`);
        }
    }

    // Create from TMDB: /create/tmdb/[id]
    const createTmdbMatch = path.match(/^\/create\/tmdb\/(\d+)$/);
    if (createTmdbMatch) {
        const id = String(createTmdbMatch[1]);
        console.debug('[tmdb-plugin] GET handler: create from TMDB for id:', id);

        try {
            const creds = await fetchTmdbCredentials();
            if (!creds || (!creds.apiKey && !creds.bearerToken)) {
                return h('div', {className: 'p-8 text-red-500'}, 'TMDB credentials not configured');
            }

            const movie = await fetchTmdbMovie(id, creds.apiKey || '', creds.bearerToken || '');
            if (!movie) {
                return h('div', {className: 'p-8 text-red-500'}, `Movie not found: ${id}`);
            }

            const createViewComponent = await helpers.loadModule('./components/CreateView.jsx');
            const onBack = () => {
                if (helpers.navigate) helpers.navigate(`/view/tmdb/${id}`);
            };

            const onSubmit = async (formData) => {
                console.debug('[tmdb-plugin] Create form submitted:', formData);
                alert(`Movie "${formData.title}" would be saved to library!\n\nData: ${JSON.stringify(formData, null, 2)}`);
                if (helpers.navigate) helpers.navigate('/');
            };

            const renderCreateView = createViewComponent?.renderCreateView;
            if (!renderCreateView) {
                return h('div', {className: 'p-4'}, 'Create view component missing');
            }

            return renderCreateView(h, movie, onBack, onSubmit);
        } catch (err) {
            console.error('[tmdb-plugin] Error loading create view:', err);
            return h('div', {className: 'p-8 text-red-500'}, `Error: ${err.message}`);
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
export async function handleQuery(query, options, ctx) {
    if (!query || typeof query !== 'string') return null;

    const source = options?.source || 'tmdb';
    if (source !== 'tmdb' && source !== 'all') return null;

    console.debug('[tmdb-plugin] QUERY handler: searching for:', query);

    try {
        const creds = await fetchTmdbCredentials();
        if (!creds || (!creds.apiKey && !creds.bearerToken)) {
            console.warn('[tmdb-plugin] TMDB credentials not configured, skipping search');
            return null;
        }

        const results = await searchTmdb(query, creds.apiKey || '', creds.bearerToken || '');
        return {
            ...results,
            source: 'tmdb',
        };
    } catch (err) {
        console.error('[tmdb-plugin] Error searching TMDB:', err);
        return null;
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
