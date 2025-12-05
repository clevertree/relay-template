/* @jsx h */
/**
 * get-client.tsx — Repository-owned UI for GET routes
 */
import type { HookContext, TMDBMovie } from './types'

let tmdbClient: { getFromTmdb?: (id: string|number)=>Promise<TMDBMovie|null> } | null = null
let movieViewComponent: { renderMovieView?: (h: typeof import('react').createElement, movie: TMDBMovie, onBack?: ()=>void, onAdd?: ()=>void)=>JSX.Element } | null = null
let createViewComponent: { renderCreateView?: (h: typeof import('react').createElement, movie: TMDBMovie|Record<string,unknown>, onBack: ()=>void, onSubmit: (data: Record<string,unknown>)=>void)=>JSX.Element } | null = null
let layoutComponent: { default?: React.ComponentType<unknown> } | null = null

let genreCache: Record<string, string> | null = null

async function fetchTmdbCredentials(): Promise<{ apiKey?: string; bearerToken?: string } | null> {
  try {
    const envResp = await fetch('/hooks/env.json');
    if (!envResp.ok) return null;
    const env = await envResp.json();
    return {
      apiKey: env.RELAY_PUBLIC_TMDB_API_KEY,
      bearerToken: env.RELAY_PUBLIC_TMDB_BEARER || env.RELAY_PUBLIC_TMDB_READ_ACCESS_ID,
    };
  } catch (err) {
    console.error('[getClient] Error fetching credentials:', err);
    return null;
  }
}

async function fetchGenres(apiKey?: string, bearerToken?: string): Promise<Record<string,string>> {
  if (genreCache) return genreCache;
  try {
    const params = new URLSearchParams({ language: 'en-US' });
    if (apiKey) params.set('api_key', apiKey);
    const url = `https://api.themoviedb.org/3/genre/movie/list?${params.toString()}`;
    const headers: Record<string, string> = {};
    if (bearerToken) headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return {} as Record<string, string>;
    const data = await resp.json();
    genreCache = {};
    (data.genres || []).forEach((g: { id: number; name: string }) => { (genreCache as Record<string,string>)[g.id] = g.name; });
    return genreCache;
  } catch (err) {
    console.error('[getClient] Error fetching genres:', err);
    return {} as Record<string, string>;
  }
}

async function fetchTmdbMovie(id: string, apiKey?: string, bearerToken?: string): Promise<TMDBMovie | null> {
  const params = new URLSearchParams({ language: 'en-US' });
  if (apiKey) params.set('api_key', apiKey);
  const url = `https://api.themoviedb.org/3/movie/${id}?${params.toString()}`;
  const headers: Record<string, string> = {};
  if (bearerToken) headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return null;
  return resp.json();
}

async function searchTmdb(query: string, apiKey?: string, bearerToken?: string): Promise<{ items: Array<Record<string,unknown>>; total: number; page: number }> {
  const params = new URLSearchParams({
    query,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  });
  if (apiKey) params.set('api_key', apiKey);
  const url = `https://api.themoviedb.org/3/search/movie?${params.toString()}`;
  const headers: Record<string, string> = {};
  if (bearerToken) headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return { items: [], total: 0 };
  const data = await resp.json();
  const genreMap = await fetchGenres(apiKey, bearerToken);
  type Incoming = Partial<TMDBMovie> & { genre_ids?: number[] }
  const items = (data.results || []).map((item: Incoming) => ({
    ...item,
    source: 'tmdb',
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
    genre_names: (item.genre_ids || []).map((id) => (genreMap as Record<string,string>)[id]).filter(Boolean),
  }));
  return { items, total: data.total_results || 0, page: data.page || 1 };
}

export default async function getClient(ctx: HookContext) {
  const { React, createElement: h, FileRenderer, Layout, params, helpers } = ctx
  const path = (params?.path || '/').trim();

  async function fetchOptions(): Promise<Record<string,unknown>> {
    try {
      const resp = await fetch('/', { method: 'OPTIONS' as RequestInit["method"] });
      if (!resp.ok) return {} as Record<string,unknown>;
      return await resp.json();
    } catch {
      return {} as Record<string,unknown>;
    }
  }

  async function lazyLoadComponents(): Promise<void> {
    if (!tmdbClient) tmdbClient = await import('./lib/sources/tmdb.ts');
    if (!movieViewComponent) movieViewComponent = await helpers.loadModule('./lib/components/MovieView.tsx');
    if (!createViewComponent) createViewComponent = await helpers.loadModule('./lib/components/CreateView.tsx');
    if (!layoutComponent) layoutComponent = await helpers.loadModule('./lib/components/Layout.tsx');
  }

  function wrap(element: JSX.Element, options?: Record<string,unknown>) {
    const LayoutComp = (layoutComponent?.default || Layout || null) as React.ComponentType<unknown> | null;
    if (!LayoutComp) {
      console.warn('No layout was found');
      return element;
    }
    return (
      <LayoutComp h={h} params={params} helpers={helpers} options={options}>
        {element}
      </LayoutComp>
    );
  }

  // View route
  const viewMatch = path.match(/^\/view\/([^/]+)\/(\d+)$/);
  if (viewMatch) {
    const [, source, id] = viewMatch;
    console.debug('[getClient] View route matched:', { source, id });
    if (source === 'tmdb') {
      tmdbClient = tmdbClient || (await import('./lib/sources/tmdb.ts'));
      if (!movieViewComponent) movieViewComponent = await helpers.loadModule('./lib/components/MovieView.tsx');
      const renderView = movieViewComponent?.renderMovieView;
      const movie = await (tmdbClient?.getFromTmdb ? tmdbClient.getFromTmdb(id) : null);
      if (!movie) {
        return wrap(<div className="p-8 text-red-500">{`TMDB unavailable or movie not found: ${id}`}</div>, await fetchOptions());
      }
      const onBack = () => { if (helpers.navigate) helpers.navigate('/'); else if (typeof window !== 'undefined') window.history.back(); };
      const onAddToLibrary = () => { if (helpers.navigate) helpers.navigate(`/create/tmdb/${id}`); };
      const content = renderView ? renderView(h, movie as TMDBMovie, onBack, onAddToLibrary) : (
        <div className="p-4">Movie view component missing</div>
      );
      return wrap(content, await fetchOptions());
    }
    if (source === 'local') {
      return wrap(<div className="p-8 text-yellow-500">Local source view not yet implemented</div>, await fetchOptions());
    }
    return wrap(<div className="p-8 text-red-500">{`Unknown source: ${source}`}</div>, await fetchOptions());
  }

  // Create from TMDB
  const createTmdbMatch = path.match(/^\/create\/tmdb\/(\d+)$/);
  if (createTmdbMatch) {
    const [, id] = createTmdbMatch;
    console.debug('[getClient] Create from TMDB route matched:', { id });
    const creds = await fetchTmdbCredentials();
    if (!creds || (!creds.apiKey && !creds.bearerToken)) {
      return wrap(<div className="p-8 text-red-500">TMDB credentials not configured</div>, await fetchOptions());
    }
    const movie = await fetchTmdbMovie(id, creds.apiKey, creds.bearerToken);
    if (!movie) {
      return wrap(<div className="p-8 text-red-500">{`Movie not found: ${id}`}</div>, await fetchOptions());
    }
    const onBack = () => { if (helpers.navigate) helpers.navigate(`/view/tmdb/${id}`); else if (typeof window !== 'undefined') window.history.back(); };
    const onSubmit = async (formData: Record<string,unknown>) => {
      console.debug('[getClient] Create form submitted:', formData);
      alert(`Movie "${formData.title}" would be saved to library!\n\nData: ${JSON.stringify(formData, null, 2)}`);
      if (helpers.navigate) helpers.navigate('/');
    };
    if (!createViewComponent) createViewComponent = await helpers.loadModule('./lib/components/CreateView.tsx');
    const content = createViewComponent?.renderCreateView
      ? createViewComponent.renderCreateView(h, movie as TMDBMovie, onBack, onSubmit)
      : (<div className="p-4">Create view component missing</div>);
    return wrap(content, await fetchOptions());
  }

  // Empty create
  if (path === '/create') {
    const onBack = () => { if (helpers.navigate) helpers.navigate('/'); else if (typeof window !== 'undefined') window.history.back(); };
    const onSubmit = async (formData: Record<string,unknown>) => { console.debug('[getClient] Create form submitted:', formData); alert('Saved (demo)'); if (helpers.navigate) helpers.navigate('/'); };
    if (!createViewComponent) createViewComponent = await helpers.loadModule('./lib/components/CreateView.tsx');
    const content = createViewComponent?.renderCreateView
      ? createViewComponent.renderCreateView(h, {} as TMDBMovie, onBack, onSubmit)
      : (<div className="p-4">Create view component missing</div>);
    return wrap(content, await fetchOptions());
  }

  // Search route delegates to query-client
  const searchMatch = path.match(/^\/search\/(.+)$/);
  if (searchMatch) {
    const query = decodeURIComponent(searchMatch[1] || '').trim();
    try {
      const queryMod = await import('./query-client.tsx');
      if (queryMod && typeof queryMod.default === 'function') {
        return wrap(await queryMod.default(ctx), await fetchOptions());
      }
    } catch (e) {
      console.error('[getClient] Failed to load query-client.tsx', e);
    }
    // Lightweight fallback view for search if query-client fails
    const opts = await fetchOptions();
    const creds = await fetchTmdbCredentials();
    if (!creds) return wrap(<div className="p-8 text-red-500">Search unavailable</div>, opts);
    const res = await searchTmdb(query, creds.apiKey, creds.bearerToken);
    const items = (res.items || []) as Array<any>
    const hItems = items.map((it) => (
      <a key={String(it.id)} href={`#/view/${String(it.source)}/${String(it.id)}`}
         onClick={(ev) => { ev.preventDefault(); ctx.helpers.navigate(`/view/${String(it.source)}/${String(it.id)}`) }}
         className="block rounded border p-3 hover:bg-black/5 dark:hover:bg-white/5">
        <div className="flex gap-3 items-center">
          {it.poster_url && <img src={String(it.poster_url)} className="w-12 h-18 object-cover rounded" />}
          <div>
            <div className="font-semibold">{(it.title as string) || (it.name as string)}</div>
            {Array.isArray(it.genre_names) && it.genre_names.length ? <div className="text-xs opacity-70">{(it.genre_names as string[]).join(', ')}</div> : null}
          </div>
        </div>
      </a>
    ));
    return wrap(
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{`Results for "${query}"`}</h2>
        <div className="grid gap-3">{hItems}</div>
      </div>,
      opts,
    );
  }

  // Default: render file
  return wrap(React.createElement(FileRenderer, { path }), await fetchOptions());
}
