/**
 * get-client.jsx — Repository-owned UI for GET routes
 * Routes all GET requests through plugins, then falls back to file serving.
 * Plugins handle specialized routes like /view/tmdb/*, /create/tmdb/*, etc.
 * JSX is transpiled by RepoBrowser using @babel/standalone with classic runtime mapped to _jsx_
 */

console.log('[get-client] Module loaded')

let tmdbPlugin = null
let ytsPlugin = null
let layoutComponent = null

/**
 * Load a plugin by name
 */
async function loadPlugin(name, helpers) {
    try {
        const pluginModule = await helpers.loadModule(`./plugin/${name}.mjs`);
        return pluginModule?.default || pluginModule;
    } catch (err) {
        console.warn(`[get-client] Failed to load plugin '${name}':`, err);
        return null;
    }
}

export default async function getClient(ctx) {
    try {
        console.log('[get-client] Hook called with ctx:', Object.keys(ctx))
        console.log('[get-client] ctx.React:', typeof ctx.React, ctx.React?.constructor?.name)
        const {React, createElement: h, FileRenderer, Layout, params, helpers} = ctx
        console.log('[get-client] After destructure - React:', typeof React, React?.constructor?.name)
        const path = (params?.path || '/').trim()
        console.log('[get-client] path:', path)

        async function fetchOptions() {
            try {
                console.log('[get-client] FETCH: OPTIONS / (method: OPTIONS)');
                const resp = await fetch('/', {method: 'OPTIONS'});
                console.log('[get-client] FETCH RESPONSE: OPTIONS / → status:', resp.status, 'ok:', resp.ok, 'contentType:', resp.headers.get('content-type'));
                if (!resp.ok) {
                    console.warn('[get-client] OPTIONS fetch failed, returning empty object');
                    return {};
                }
                const data = await resp.json();
                console.log('[get-client] FETCH DATA: OPTIONS / → ', Object.keys(data || {}));
                return data;
            } catch (err) {
                console.error('[get-client] FETCH ERROR: OPTIONS / →', err.message);
                return {};
            }
        }

        async function lazyLoadComponents() {
            if (!tmdbPlugin) tmdbPlugin = await loadPlugin('tmdb', helpers);
            if (!ytsPlugin) ytsPlugin = await loadPlugin('yts', helpers);
            if (!layoutComponent) layoutComponent = await helpers.loadModule('./components/Layout.jsx');
        }

        async function wrap(element, options) {
            console.log('[wrap] Called with element:', element?.constructor?.name, 'options:', Object.keys(options || {}))
            // Lazy load layout if not already loaded
            if (!layoutComponent && typeof helpers?.loadModule === 'function') {
                try {
                    console.log('[wrap] Layout not loaded, attempting lazy load...')
                    layoutComponent = await helpers.loadModule('./components/Layout.jsx');
                    console.log('[wrap] Layout loaded successfully')
                } catch (err) {
                    console.warn('[wrap] Failed to load Layout component:', err);
                }
            }
            const LayoutComp = (layoutComponent?.default || Layout || null)
            console.log('[wrap] LayoutComp:', LayoutComp?.name)
            if (!LayoutComp) {
                console.warn('No layout was found');
                // Graceful UI when Layout.jsx is missing: show a compact inline warning
                try {
                    const Warning = () => (
                        <div className="bg-yellow-100 text-yellow-900 border border-yellow-300 rounded px-3 py-2 mb-2 text-sm">
                          Missing hooks/client/components/Layout.jsx — rendering without layout
                        </div>
                    )
                    return (
                        <div className="p-2">
                          <Warning />
                          {element}
                        </div>
                    )
                } catch (_e) {
                    // If JSX render fails for any reason, just return the element
                    return element
                }
            }
            console.log('[wrap] Creating LayoutComp with props')
            // Use h() directly instead of JSX to avoid transpilation issues in blob context
            // Pass children via props, not as a separate argument
            return h(LayoutComp, {h, params, helpers, options, children: element});
        }

        // Try each plugin's GET handler
        await lazyLoadComponents();
        let pluginResult = null;

        if (tmdbPlugin && typeof tmdbPlugin.handleGetRequest === 'function') {
            pluginResult = await tmdbPlugin.handleGetRequest(path, {React, createElement: h, FileRenderer, Layout, params, helpers});
            if (pluginResult) {
                console.log('[get-client] TMDB plugin handled request');
                return wrap(pluginResult, await fetchOptions());
            }
        }

        if (ytsPlugin && typeof ytsPlugin.handleGetRequest === 'function') {
            pluginResult = await ytsPlugin.handleGetRequest(path, {React, createElement: h, FileRenderer, Layout, params, helpers});
            if (pluginResult) {
                console.log('[get-client] YTS plugin handled request');
                return wrap(pluginResult, await fetchOptions());
            }
        }

        // Root path (/) - render template README.md
        if (path === '/') {
            console.debug('[get-client] Root path matched, rendering template README.md');
            const readmeElement = <FileRenderer path="/README.md"/>;
            return wrap(readmeElement, await fetchOptions());
        }

        // Search route delegates to query-client
        const searchMatch = path.match(/^\/search\/([^?]+)(?:\?(.*))?$/);
        if (searchMatch) {
            const query = decodeURIComponent(searchMatch[1] || '').trim();
            console.debug('[get-client] Search route matched with query:', query);
            try {
                const queryMod = await helpers.loadModule('./query-client.jsx');
                if (queryMod && typeof queryMod.default === 'function') {
                    // Parse query parameters from the URL fragment (page, source, pageSize, etc.)
                    const queryParams = new URLSearchParams(searchMatch[2] || '');
                    const queryCtx = {
                        ...ctx,
                        params: {
                            ...ctx.params,
                            q: query,
                            page: queryParams.get('page') || '1',
                            source: queryParams.get('source') || 'tmdb',
                            pageSize: queryParams.get('pageSize') || '20'
                        }
                    };
                    return wrap(await queryMod.default(queryCtx), await fetchOptions());
                }
            } catch (e) {
                console.error('[get-client] Failed to load query-client.jsx', e);
            }
            return wrap(<div className="p-4 text-red-500">Failed to load query module</div>, await fetchOptions());
        }

        // Default: file route or 404
        if (FileRenderer) {
            const opts = await fetchOptions();
            // Check if the file actually exists by doing a HEAD request first
            try {
                console.log('[get-client] FETCH: HEAD', path, '(checking file existence)');
                const checkResp = await fetch(path, {method: 'HEAD'});
                console.log('[get-client] FETCH RESPONSE: HEAD', path, '→ status:', checkResp.status, 'ok:', checkResp.ok, 'contentType:', checkResp.headers.get('content-type'));
                if (checkResp.status === 404) {
                    console.log('[get-client] File not found (404), showing missing page');
                    // File not found, show missing page
                    const missingModule = await helpers.loadModule('./missing.mjs');
                    if (missingModule && typeof missingModule.render === 'function') {
                        return wrap(missingModule.render(h, path), opts);
                    }
                }
            } catch (err) {
                console.warn('[get-client] FETCH ERROR: HEAD', path, '→', err.message);
            }

            const element = <FileRenderer path={path}/>;
            const wrapped = wrap(element, opts);
            return wrapped;
        }

        // No file renderer, load missing page
        try {
            const missingModule = await helpers.loadModule('./missing.mjs');
            if (missingModule && typeof missingModule.render === 'function') {
                return wrap(missingModule.render(h, path), await fetchOptions());
            }
        } catch (err) {
            console.warn('[get-client] Failed to load missing.mjs:', err);
        }

        return wrap(<div className="p-4">No renderer available</div>, await fetchOptions())
    } catch (err) {
        console.error('[get-client] Error in hook:', err)
        return <div className="p-4 text-red-600">Error: {err && err.message ? err.message : String(err)}</div>
    }
}
