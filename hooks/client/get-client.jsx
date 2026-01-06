/**
 * get-client.jsx — Repository-owned UI for GET routes
 * Routes all GET requests through plugins, then falls back to file serving.
 * Plugins handle specialized routes like /view/tmdb/*, /create/tmdb/*, etc.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { MarkdownRenderer } from '@clevertree/markdown'
import { registerThemesFromYaml } from '@clevertree/theme'
import { url } from '@clevertree/meta'

console.log('[get-client] Module loaded')
globalThis.__DEBUG_HOOKS__ = true;

// Calculate template root by going up two directories from this module
// From: .../template/hooks/client/get-client.jsx → To: .../template/
const templateRoot = new URL('../..', url).href
console.log('[get-client] Template root:', templateRoot)

// Wrapper to resolve fetch URLs relative to template root
// Forces relative resolution even for paths starting with / (use fetch() directly if you want host-relative)
function fetchRelative(input, init) {
    if (globalThis.__DEBUG_HOOKS__) {
        console.log('[DEBUG] fetchRelative called with:', input);
    }
    if (typeof input === 'string') {
        const urlObj = input.startsWith('http') ? new URL(input) : new URL(input.startsWith('/') ? input.slice(1) : input, templateRoot)
        
        // Add cache busting in debug mode
        if (globalThis.__DEBUG_HOOKS__) {
            urlObj.searchParams.set('_t', Date.now().toString());
        }
        
        const resolvedUrl = urlObj.href
        
        if (globalThis.__DEBUG_HOOKS__) {
            console.log(`[get-client] FETCH START: ${resolvedUrl}`)
        }
        
        return fetch(resolvedUrl, init).then(resp => {
            if (globalThis.__DEBUG_HOOKS__) {
                console.log(`[get-client] FETCH COMPLETE: ${resolvedUrl} (Status: ${resp.status}, OK: ${resp.ok})`)
            }
            return resp
        }).catch(err => {
            console.error(`[get-client] FETCH FAILED: ${resolvedUrl}`, err)
            throw err
        })
    }
    return fetch(input, init)
}

let tmdbPlugin = null
let ytsPlugin = null
let layoutComponent = null
let themesRegistered = false
let envCache = null

async function fetchEnv() {
    if (envCache) return envCache
    try {
        // env.json is at template root
        const envUrl = new URL('./env.json', url).href
        const resp = await fetch(envUrl)
        if (!resp.ok) {
            envCache = { error: `${envUrl.href} returned ${resp.status}` }
            return envCache
        }
        envCache = await resp.json()
        return envCache
    } catch (err) {
        envCache = { error: `env.json fetch/parse failed: ${err?.message || err}` }
        return envCache
    }
}

async function registerTemplateThemeStyles() {
    if (themesRegistered) return
    themesRegistered = true
    try {
        if (typeof registerThemesFromYaml === 'function') {
            await registerThemesFromYaml('./theme.yaml')
            return
        }
        console.warn('[get-client] registerThemesFromYaml not available from @clevertree/theme, skipping theme registration')
    } catch (err) {
        console.warn('[get-client] Failed to register theme YAML:', err)
    }
}

function isMarkdownPath(path) {
    if (!path) return false
    const lower = path.toLowerCase()
    return lower.endsWith('.md') || lower.endsWith('.markdown')
}

async function fetchMarkdownContent(path) {
    const target = path || '/'
    let headContentType = ''

    try {
        console.log('[get-client] FETCH: HEAD', target, '(checking markdown eligibility)')
        const headResp = await fetchRelative(target, { method: 'HEAD' })
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

    const resp = await fetchRelative(target)
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
                        const resp = await fetchRelative('/', { method: 'OPTIONS' });
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
                    // Handle both ESM (.default) and CJS (direct) exports
                    const LayoutComp = layoutComponent?.default || layoutComponent
                    console.log('[wrap] LayoutComp resolved:', LayoutComp?.name || typeof LayoutComp)
                    
                    if (!LayoutComp || typeof LayoutComp !== 'function') {
                        throw new Error('Missing or invalid layout component: hooks/client/components/Layout.jsx')
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
                console.error('[get-client] Error loading content:', err.message, err.stack)
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
        return (
            <div style={{ 
                padding: '2rem', 
                maxWidth: '800px', 
                margin: '2rem auto',
                backgroundColor: '#fff5f5',
                border: '1px solid #feb2b2',
                borderRadius: '12px',
                shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '2rem', marginRight: '1rem' }}>⚠️</span>
                    <h2 style={{ color: '#c53030', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                        Hook Execution Error
                    </h2>
                </div>
                
                <div style={{ 
                    backgroundColor: '#fff', 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #fed7d7',
                    marginBottom: '1rem'
                }}>
                    <div style={{ fontWeight: 'bold', color: '#742a2a', marginBottom: '0.5rem' }}>Message:</div>
                    <pre style={{ 
                        margin: 0, 
                        whiteSpace: 'pre-wrap', 
                        fontFamily: 'ui-monospace, monospace',
                        color: '#2d3748',
                        fontSize: '14px',
                        lineHeight: '1.5'
                    }}>
                        {error instanceof Error ? error.message : String(error)}
                    </pre>
                </div>

                {error instanceof Error && error.stack && (
                    <details style={{ cursor: 'pointer' }}>
                        <summary style={{ 
                            color: '#718096', 
                            fontSize: '0.875rem', 
                            padding: '0.5rem 0',
                            userSelect: 'none'
                        }}>
                            View technical details (Stack Trace)
                        </summary>
                        <pre style={{ 
                            marginTop: '0.5rem',
                            padding: '1rem',
                            backgroundColor: '#1a202c',
                            color: '#e2e8f0',
                            borderRadius: '6px',
                            fontSize: '11px',
                            overflowX: 'auto',
                            lineHeight: '1.4'
                        }}>
                            {error.stack}
                        </pre>
                    </details>
                )}
                
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #fed7d7', paddingTop: '1rem' }}>
                    <button 
                        onClick={() => window.location?.reload?.() || navigate('/')}
                        style={{
                            backgroundColor: '#c53030',
                            color: 'white',
                            border: 'none',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '6px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
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
