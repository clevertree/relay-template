/**
 * get-client.jsx — Repository-owned UI for GET routes
 * Routes all GET requests through plugins, then falls back to file serving.
 * Plugins handle specialized routes like /view/tmdb/*, /create/tmdb/*, etc.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { MarkdownRenderer } from '@relay/markdown'
import { registerThemesFromYaml } from '@relay/theme'

console.log('[get-client] Module loaded')

let tmdbPlugin = null
let ytsPlugin = null
let layoutComponent = null
let themesRegistered = false
let envCache = null

async function fetchEnv() {
    if (envCache) return envCache
    try {
        const resp = await fetch('./env.json')
        if (!resp.ok) {
            envCache = { error: `./env.json returned ${resp.status}` }
            return envCache
        }
        envCache = await resp.json()
        return envCache
    } catch (err) {
        envCache = { error: `./env.json fetch/parse failed: ${err?.message || err}` }
        return envCache
    }
}

async function registerTemplateThemeStyles() {
    if (themesRegistered) return
    themesRegistered = true
    try {
        if (typeof registerThemesFromYaml === 'function') {
            await registerThemesFromYaml('./theme.yaml')
            try {
                const queryMod = await import('./query-client.jsx');
                if (queryMod && typeof queryMod.default === 'function') {
                    // Parse query parameters and pass as ctx expected by query-client
                    const queryParams = new URLSearchParams(searchMatch[2] || '');
                    const queryElement = await queryMod.default({
                        params: {
                            q: query,
                            page: queryParams.get('page') || '1',
                            source: queryParams.get('source') || 'tmdb',
                            pageSize: queryParams.get('pageSize') || '20',
                        },
                        navigate,
                    });
                    if (!cancelled) setContent(wrap(queryElement, await fetchOptions()));
                    return;
                }
            } catch (e) {
                const target = path || '/'
                let headContentType = ''

                try {
                    console.log('[get-client] FETCH: HEAD', target, '(checking markdown eligibility)')
                    const headResp = await fetch(target, { method: 'HEAD' })
                    console.log('[get-client] FETCH RESPONSE: HEAD', target, '→ status:', headResp.status, 'ok:', headResp.ok, 'contentType:', headResp.headers.get('content-type'))
                    headContentType = headResp.headers.get('content-type') || ''
                    if (headResp.status === 404) {
                        throw new Error(`File not found: ${target}`)
                    }
                } catch (err) {
                    console.warn('[get-client] HEAD check failed; continuing to GET:', err?.message || err)
                }

                const looksLikeMarkdown = isMarkdownPath(target) || headContentType.toLowerCase().includes('markdown')
                if (!looksLikeMarkdown) {
                    throw new Error(`Refusing to render non-markdown content: ${target}`)
                }

                const resp = await fetch(target)
                console.log('[get-client] FETCH RESPONSE: GET', target, '→ status:', resp.status, 'ok:', resp.ok, 'contentType:', resp.headers.get('content-type'))
                if (!resp.ok) {
                    throw new Error(`Failed to load markdown: ${target} (status ${resp.status})`)
                }

                const contentType = resp.headers.get('content-type') || headContentType || ''
                const finalMarkdown = contentType.toLowerCase().includes('markdown') || isMarkdownPath(target)
                if (!finalMarkdown) {
                    throw new Error(`Response is not markdown: ${target} (content-type: ${contentType || 'unknown'})`)
                }

                const content = await resp.text()
                return { content, contentType }
            }

            /**
             * Load a plugin by name
             */
            async function loadPlugin(name) {
                try {
                    const pluginModule = await import(`./plugin/${name}.mjs`);
                    return pluginModule?.default || pluginModule;
                } catch (err) {
                    console.warn(`[get-client] Failed to load plugin '${name}':`, err);
                    return null;
                }
            }

            // React component that manages internal state
            function GetClientComponent() {
                console.log('[GetClientComponent] Rendering')

                // Internal path state management — repo manages its own routing
                const [path, setPath] = useState('/')
                const [content, setContent] = useState(null)
                const [error, setError] = useState(null)

                // Internal navigate function — no helpers.navigate, no History API, no window.history
                const navigate = useCallback((to) => {
                    if (typeof to !== 'string' || !to) return
                    const dest = to.startsWith('/') ? to : `/${to}`
                    setPath(dest)
                    console.debug('[get-client] navigate internal state:', dest)
                }, [])

                // Handle async initialization and routing in useEffect
                useEffect(() => {
                    let cancelled = false

                    async function loadContent() {
                        try {
                            await registerTemplateThemeStyles()

                            async function fetchOptions() {
                                try {
                                    console.log('[get-client] FETCH: OPTIONS / (method: OPTIONS)');
                                    const resp = await fetch('/', { method: 'OPTIONS' });
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
                                if (!tmdbPlugin) tmdbPlugin = await loadPlugin('tmdb');
                                if (!ytsPlugin) ytsPlugin = await loadPlugin('yts');
                                if (!layoutComponent) layoutComponent = await import('./components/Layout.jsx');
                            }

                            function wrap(element, options) {
                                console.log('[wrap] Called with element:', element?.constructor?.name, 'options:', Object.keys(options || {}))
                                const LayoutComp = (layoutComponent?.default || null)
                                console.log('[wrap] LayoutComp:', LayoutComp?.name)
                                if (!LayoutComp) {
                                    throw new Error('Missing layout component: hooks/client/components/Layout.jsx')
                                }
                                console.log('[wrap] Creating LayoutComp with props')
                                // Pass internal path state and navigate; LayoutComp is fully decoupled from host
                                return (
                                    <LayoutComp path={path} onNavigate={navigate} options={options}>
                                        {element}
                                    </LayoutComp>
                                )
                            }

                            // Try each plugin's GET handler
                            await lazyLoadComponents();
                            const env = await fetchEnv();
                            let pluginResult = null;

                            if (tmdbPlugin && typeof tmdbPlugin.handleGetRequest === 'function') {
                                pluginResult = await tmdbPlugin.handleGetRequest(path, { navigate, MarkdownRenderer, env });
                                if (pluginResult) {
                                    console.log('[get-client] TMDB plugin handled request');
                                    if (!cancelled) setContent(wrap(pluginResult, await fetchOptions()));
                                    return;
                                }
                            }

                            if (ytsPlugin && typeof ytsPlugin.handleGetRequest === 'function') {
                                pluginResult = await ytsPlugin.handleGetRequest(path, { navigate, MarkdownRenderer, env });
                                if (pluginResult) {
                                    console.log('[get-client] YTS plugin handled request');
                                    if (!cancelled) setContent(wrap(pluginResult, await fetchOptions()));
                                    return;
                                }
                            }

                            // Root path (/) - render template README.md
                            if (path === '/') {
                                console.debug('[get-client] Root path matched, rendering template README.md');
                                const { content } = await fetchMarkdownContent('/README.md');
                                const readmeElement = <MarkdownRenderer content={content} navigate={navigate} />;
                                if (!cancelled) setContent(wrap(readmeElement, await fetchOptions()));
                                return;
                            }

                            // Search route delegates to query-client
                            const searchMatch = path.match(/^\/search\/([^?]+)(?:\?(.*))?$/);
                            if (searchMatch) {
                                const query = decodeURIComponent(searchMatch[1] || '').trim();
                                console.debug('[get-client] Search route matched with query:', query);
                                try {
                                    const env = await fetchEnv();
                                    const queryMod = await import('./query-client.jsx');
                                    if (queryMod && typeof queryMod.default === 'function') {
                                        // Parse query parameters and pass as props to queryHook
                                        const queryParams = new URLSearchParams(searchMatch[2] || '');
                                        const queryElement = await queryMod.default({
                                            params: {
                                                q: query,
                                                page: queryParams.get('page') || '1',
                                                source: queryParams.get('source') || 'tmdb',
                                                pageSize: queryParams.get('pageSize') || '20',
                                            },
                                            navigate,
                                            env,
                                        });
                                        if (!cancelled) setContent(wrap(queryElement, await fetchOptions()));
                                        return;
                                    }
                                } catch (e) {
                                    console.error('[get-client] Failed to load query-client.jsx', e);
                                    throw new Error('Failed to load query module: hooks/client/query-client.jsx')
                                }
                                throw new Error('Failed to load query module: hooks/client/query-client.jsx')
                            }

                            // Default: markdown file route or 404
                            const opts = await fetchOptions();
                            const { content } = await fetchMarkdownContent(path);
                            const element = <MarkdownRenderer content={content} navigate={navigate} />;
                            if (!cancelled) setContent(wrap(element, opts));
                            return;
                        } catch (err) {
                            console.error('[get-client] Error loading content:', err)
                            if (!cancelled) setError(err)
                        }
                    }

                    loadContent()

                    return () => {
                        cancelled = true
                    }
                }, [path, navigate]) // Re-run when path changes

                // Render based on state
                if (error) {
                    throw error // Let error boundary handle it
                }

                if (!content) {
                    return <div>Loading...</div>
                }

                return content
            }

            // Hook entry point - returns the component
            export default function getClient() {
                console.log('[get-client] Hook called')
                console.log('[get-client] React:', typeof React, React?.constructor?.name)
                return <GetClientComponent />
            }
