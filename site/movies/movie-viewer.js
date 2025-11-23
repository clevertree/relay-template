import {getTmdbById} from './tmdb/get_tmdb.js';
import {queryLocalViaServer} from './tmdb/query_tmdb.js';

class MovieViewer extends HTMLElement {
    constructor() {
        super();
        this._tabs = [];
    }

    connectedCallback() {
        this.innerHTML = `
      <div class="viewer flex flex-col gap-2 my-3">
        <div class="tabs flex gap-1 flex-wrap border-b border-black/10 dark:border-white/10 pb-1"></div>
        <div class="panes border border-black/10 dark:border-white/10 rounded-b-md bg-white dark:bg-neutral-900 p-3"></div>
      </div>
    `;
        this.$tabs = this.querySelector('.tabs');
        this.$panes = this.querySelector('.panes');
        // Listen globally for open events
        this._onOpen = (ev) => {
            const det = ev.detail || {};
            if (!det || (!det.id && !det.meta_dir)) return;
            this.openMovie(det);
        };
        document.addEventListener('movie-search:open', this._onOpen);
        this.addEventListener('movie-search:open', this._onOpen);
        // Listen for successful upserts to update any open TMDB tab state
        this._onUpsertSuccess = (ev) => {
            const detail = ev.detail || {};
            const path = (detail.path || '').toString().replace(/\\/g, '/');
            let dir = path;
            if (dir.endsWith('meta.json')) dir = dir.slice(0, -'meta.json'.length);
            dir = dir.replace(/\/+$/, '');
            const active = this._tabs.find(t => t.active && t.source === 'tmdb');
            if (active && !active.localMetaDir && dir) {
                active.localMetaDir = dir;
                this._renderTabs();
                this._renderPaneContent(active);
            }
        };
        document.addEventListener('movie-upsert:success', this._onUpsertSuccess);
    }

    disconnectedCallback() {
        document.removeEventListener('movie-search:open', this._onOpen);
        this.removeEventListener('movie-search:open', this._onOpen);
        document.removeEventListener('movie-upsert:success', this._onUpsertSuccess);
    }

    _branch() {
        const meta = document.querySelector('meta[name="relay-branch"]');
        return meta?.getAttribute('content') || 'main';
    }

    async openMovie({source = 'local', id, meta_dir, data: preloadedData = null}) {
        const key = source === 'local' && meta_dir ? `local:${meta_dir}` : `tmdb:${id}`;
        let tab = this._tabs.find(t => t.key === key);
        if (!tab) {
            tab = {key, title: 'Loading…', source, id, meta_dir, paneId: `pane-${Math.random().toString(36).slice(2)}`};
            this._tabs.push(tab);
            this._renderTabs();
            this._renderPanes();
        }
        this._activate(key);
        // Load data (allow preloaded data to short-circuit network calls)
        try {
            let data = null;
            if (preloadedData) {
                data = preloadedData;
            } else if (source === 'local' && meta_dir) {
                const headers = {};
                const meta = document.querySelector('meta[name="relay-branch"]');
                const branch = meta?.getAttribute('content') || 'main';
                headers['X-Relay-Branch'] = branch;
                const res = await fetch(`/${meta_dir.replace(/^\/+/, '')}/meta.json`, {headers});
                data = res.ok ? await res.json() : null;
                if (data) data.source = 'local';
            } else if (source === 'tmdb' && id) {
                data = await getTmdbById(id);
                // Also check for an existing local entry (prefer exact title + year)
                try {
                    if (data && data.title && data.release_year != null) {
                        const body = {
                            params: {title: {eq: data.title}, release_year: {eq: Number(data.release_year)}},
                            page: 0
                        };
                        const local = await queryLocalViaServer(body, this._branch());
                        const first = (local && Array.isArray(local.rows) && local.rows[0]) ? local.rows[0] : null;
                        if (first && (first.meta_dir || first._meta_dir)) {
                            tab.localMetaDir = first.meta_dir || first._meta_dir;
                        }
                    }
                } catch {
                }
            }
            if (!data) throw new Error('Not found');
            tab.data = data;
            tab.title = data.title || 'Untitled';
            this._renderTabs();
            this._renderPaneContent(tab);
        } catch (e) {
            // Show an error pane but keep the tab available; provide a refresh button
            tab.title = 'Error';
            this._renderTabs();
            const pane = this.querySelector(`#${CSS.escape(tab.paneId)}`);
            if (pane) {
                const msg = (e && e.message) ? e.message : String(e);
                pane.innerHTML = `
                <div class="text-red-600">Failed to load movie details: ${msg}</div>
                <div style="margin-top:8px">
                <button class="btn-refresh px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-neutral-800">Refresh</button>
                </div>
              `;
                const btn = pane.querySelector('.btn-refresh');
                if (btn) btn.addEventListener('click', async () => {
                    pane.innerHTML = `<div class="text-neutral-600">Retrying…</div>`;
                    try {
                        await this.openMovie({source: tab.source, id: tab.id, meta_dir: tab.meta_dir});
                    } catch (err) {
                        pane.innerHTML = `<div class="text-red-600">Retry failed: ${err && err.message ? err.message : String(err)}</div>`;
                    }
                });
            }
        }
    }

    _activate(key) {
        this._tabs.forEach(t => t.active = (t.key === key));
        this._renderTabs();
        this._renderPanes();
    }

    _close(key) {
        const idx = this._tabs.findIndex(t => t.key === key);
        if (idx >= 0) this._tabs.splice(idx, 1);
        this._renderTabs();
        this._renderPanes();
    }

    _renderTabs() {
        this.$tabs.innerHTML = this._tabs.map(t => `
        <div class="tab ${t.active ? 'active' : ''} flex items-center gap-1 px-2 py-1 rounded-t-md border border-black/10 dark:border-white/10 border-b-0 cursor-pointer ${t.active ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}" data-key="${t.key}">
          <span>${t.title}</span>
          <button class="close text-neutral-600 hover:text-neutral-900" title="Close" aria-label="Close">×</button>
        </div>
      `).join('');
        this.$tabs.querySelectorAll('.tab').forEach(el => {
            const key = el.getAttribute('data-key');
            el.addEventListener('click', (ev) => {
                if (ev.target.classList.contains('close')) return; // handled below
                this._activate(key);
            });
            el.querySelector('.close')?.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._close(key);
            });
        });
    }

    _renderPanes() {
        const existing = new Set(this._tabs.map(t => t.paneId));
        this.$panes.querySelectorAll('.pane').forEach(p => {
            if (!existing.has(p.id)) p.remove();
        });
        for (const t of this._tabs) {
            let pane = this.querySelector(`#${CSS.escape(t.paneId)}`);
            if (!pane) {
                pane = document.createElement('div');
                pane.id = t.paneId;
                pane.className = 'pane';
                this.$panes.appendChild(pane);
            }
            pane.classList.toggle('hidden', !t.active);
            if (t.data) this._renderPaneContent(t);
            else pane.innerHTML = `<div class=\"text-neutral-600\">Loading…</div>`;
        }
    }

    _renderPaneContent(tab) {
        const d = tab.data || {};
        const pane = this.querySelector(`#${CSS.escape(tab.paneId)}`);
        if (!pane) return;
        const title = d.title || 'Untitled';
        const year = d.release_year || d.releaseYear || '';
        const genres = Array.isArray(d.genre) ? d.genre.join(', ') : '';
        const overview = d.overview || '';
        const urlPoster = d.url_poster || d.poster || '';
        const urlBackdrop = d.url_backdrop || '';
        const localMetaDir = tab.localMetaDir || tab.meta_dir;
        pane.innerHTML = `
      <div class="grid [grid-template-columns:160px_1fr] gap-4 items-start">
        <div>
          ${urlPoster ? `<img class="max-w-[160px] rounded-lg border border-black/10 dark:border-white/10" src="${urlPoster}" alt="Poster">` : ''}
        </div>
        <div>
          <h3 class="m-0 mb-1 text-lg font-semibold">${title} ${year ? `(${year})` : ''}</h3>
          ${urlBackdrop ? `<img class="w-full max-h-[240px] object-cover rounded-lg border border-black/10 dark:border-white/10" src="${urlBackdrop}" alt="Backdrop">` : ''}
          ${genres ? `<div class="text-neutral-600">Genres: ${genres}</div>` : ''}
          ${overview ? `<p class="text-neutral-700 dark:text-neutral-300">${overview}</p>` : ''}
          <div class="text-neutral-600">Source: ${tab.source}</div>
          ${localMetaDir ? `<div class="text-neutral-600">Local: <a class="text-blue-600 hover:underline" href="/${localMetaDir}" target="_blank">/${localMetaDir}</a></div>` : ''}
          ${tab.source === 'tmdb' && !localMetaDir ? `<div class="mt-2"><button class="btn-create px-3 py-2 rounded-md border border-black/15 dark:border-white/15 bg-blue-600 text-white">Create local entry</button></div>` : ''}
        </div>
      </div>
    `;
        // Wire Create button to open the modal prefilled
        if (tab.source === 'tmdb' && !localMetaDir) {
            const btn = pane.querySelector('.btn-create');
            if (btn) {
                // Notify listeners that a create button is available for this tab
                try {
                    this.dispatchEvent(new CustomEvent('movie-viewer:create-ready', {
                        detail: {
                            key: tab.key,
                            id: tab.id,
                            source: tab.source
                        }, bubbles: true, composed: true
                    }));
                } catch (e) {
                }
                btn.addEventListener('click', async () => {
                    const modal = document.getElementById('create-modal');
                    const metaToPopulate = {
                        title: d.title,
                        release_date: d.release_date,
                        release_year: d.release_year,
                        genre: Array.isArray(d.genre) ? d.genre : [],
                        overview: d.overview,
                        url_poster: d.url_poster,
                        url_backdrop: d.url_backdrop
                    };
                    // Try to find upsert immediately
                    let upsert = modal?.querySelector('movie-upsert');
                    // If not found, allow custom element upgrade / insertion to run and try again
                    if (!upsert) {
                        try {
                            // Wait for the movie-upsert element to be defined (if script loads later)
                            if (window.customElements && typeof window.customElements.whenDefined === 'function') {
                                await window.customElements.whenDefined('movie-upsert');
                            }
                        } catch (e) {
                        }
                        // microtask yield to allow connectedCallback to move children into modal
                        await new Promise(r => setTimeout(r, 0));
                        upsert = modal?.querySelector('movie-upsert') || document.querySelector('movie-upsert');
                    }
                    if (upsert && typeof upsert.populate === 'function') {
                        try {
                            upsert.populate(metaToPopulate);
                        } catch (e) {
                            console.error('populate failed', e);
                        }
                        // Notify that the upsert form has been populated
                        try {
                            modal?.dispatchEvent(new CustomEvent('movie-upsert:populated', {
                                detail: metaToPopulate,
                                bubbles: true,
                                composed: true
                            }));
                        } catch (e) {
                        }
                    } else {
                        console.warn('movie-upsert element not found to populate');
                    }
                    modal?.open?.();
                });
            }
        }

        // Dispatch an event after pane content is rendered so tests/stories can react
        try {
            this.dispatchEvent(new CustomEvent('movie-viewer:rendered', {
                detail: {
                    key: tab.key,
                    id: tab.id,
                    source: tab.source
                }, bubbles: true, composed: true
            }));
        } catch (e) {
        }
    }
}

customElements.define('movie-viewer', MovieViewer);


// Mount a movie viewer just below the main header if present
window.addEventListener('DOMContentLoaded', () => {
    const article = document.querySelector('article.themed') || document.querySelector('article');
    if (!article) return;
    // Avoid duplicates
    if (article.querySelector('movie-viewer')) return;
    const header = article.querySelector('header');
    const viewer = document.createElement('movie-viewer');
    if (header && header.nextSibling) {
        article.insertBefore(viewer, header.nextSibling);
    } else {
        article.appendChild(viewer);
    }
});
