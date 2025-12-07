/**
 * get-client.jsx — Repository-owned UI for GET routes
 * Routes all GET requests through plugins, then falls back to file serving.
 * Plugins handle specialized routes like /view/tmdb/*, /create/tmdb/*, etc.
 * JSX is transpiled by RepoBrowser using @babel/standalone with classic runtime mapped to _jsx_
 */

console.log('[get-client] Module loaded')

let tmdbPlugin = null
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
                const resp = await fetch('/', {method: 'OPTIONS'});
                if (!resp.ok) return {};
                return await resp.json();
            } catch {
                return {};
            }
        }

        async function lazyLoadComponents() {
            if (!tmdbPlugin) tmdbPlugin = await loadPlugin('tmdb', helpers);
            if (!layoutComponent) layoutComponent = await helpers.loadModule('./components/Layout.jsx');
        }

        async function wrap(element, options) {
            console.log('[wrap] Called with element:', element?.constructor?.name, 'options:', Object.keys(options || {}))
            // Lazy load layout if not already loaded
            if (!layoutComponent && typeof helpers?.loadModule === 'function') {
                try {
                    console.log('[wrap] Layout not loaded, attempting lazy load...')
                    layoutComponent = await helpers.loadModule('./lib/components/Layout.jsx');
                    console.log('[wrap] Layout loaded successfully')
                } catch (err) {
                    console.warn('[wrap] Failed to load Layout component:', err);
                }
            }
            const LayoutComp = (layoutComponent?.default || Layout || null)
            console.log('[wrap] LayoutComp:', LayoutComp?.name)
            if (!LayoutComp) {
                console.warn('No layout was found');
                return element;
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
                console.log('[get-client] Plugin handled request');
                return wrap(pluginResult, await fetchOptions());
            }
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
