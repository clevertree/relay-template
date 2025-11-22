class MovieSearch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._debounce = null;
    this._page = 1;
    this._filterText = '';
    this._onInput = this._onInput.bind(this);
    this._onRefresh = this._onRefresh.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .searchbar { display:flex; gap:.5rem; align-items: center; }
        input[type="search"] { flex:1; padding:.5rem .6rem; border-radius:8px; border:1px solid rgba(0,0,0,.15); min-width: 180px; }
        .results { margin-top:.5rem; display:grid; gap:.5rem; }
        .item { padding:.5rem .6rem; border:1px solid rgba(0,0,0,.1); border-radius:8px; background:#fff; }
        .meta { font-size:.8rem; color:#555; }
        .empty { color:#777; font-style: italic; padding:.25rem .5rem; }
        .pager { display:flex; gap:.5rem; align-items:center; justify-content: flex-end; margin-top:.25rem; }
        button { padding:.4rem .6rem; border-radius:6px; border:1px solid rgba(0,0,0,.15); background:#f7f7f7; cursor:pointer; }
        button[disabled] { opacity:.5; cursor:not-allowed; }
      </style>
      <div class="searchbar">
        <input type="search" placeholder="Search movies (title or year)" aria-label="Search movies" />
      </div>
      <div class="results" aria-live="polite"></div>
      <div class="pager">
        <button id="prev">Prev</button>
        <span id="page">1</span>
        <button id="next">Next</button>
      </div>
    `;
    this.$input = this.shadowRoot.querySelector('input[type="search"]');
    this.$results = this.shadowRoot.querySelector('.results');
    this.$prev = this.shadowRoot.querySelector('#prev');
    this.$next = this.shadowRoot.querySelector('#next');
    this.$page = this.shadowRoot.querySelector('#page');
    this.$input.addEventListener('input', this._onInput);
    this.$prev.addEventListener('click', () => { if (this._page>1) { this._page--; this._query(); } });
    this.$next.addEventListener('click', () => { this._page++; this._query(); });
    this.addEventListener('movie-search:refresh', this._onRefresh);
    this._query();
  }

  disconnectedCallback() {
    this.$input?.removeEventListener('input', this._onInput);
    this.removeEventListener('movie-search:refresh', this._onRefresh);
  }

  _onRefresh() {
    this._query();
  }

  _onInput(e) {
    this._filterText = e.target.value.trim();
    this._page = 1;
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this._query(), 200);
  }

  _branch() {
    const meta = document.querySelector('meta[name="relay-branch"]');
    return meta?.getAttribute('content') || 'main';
  }

  _buildFilter() {
    // Server supports queryPolicy on title(eq,in), release_year(eq,gte,lte), genre(contains)
    // We will send minimal filters and do client-side fuzzy match for title substring.
    const f = {};
    const t = this._filterText;
    if (!t) return f;
    const year = (t.match(/\b(19\d{2}|20\d{2})\b/) || [])[0];
    if (year) f.release_year = { eq: parseInt(year, 10) };
    // For title, use eq if there are quotes, otherwise leave to client-side contains
    if (t.startsWith('"') && t.endsWith('"') && t.length>2) {
      f.title = { eq: t.slice(1, -1) };
    }
    return f;
  }

  async _query() {
    const branch = this._branch();
    const body = { params: this._buildFilter(), page: this._page };
    let items = [];
    try {
      const res = await fetch('/', {
        method: 'QUERY',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Branch': branch
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Query failed: ${res.status}`);
      const json = await res.json();
      items = Array.isArray(json.items) ? json.items : [];
    } catch (e) {
      console.error(e);
      this.$results.innerHTML = `<div class="empty">Query error.</div>`;
      return;
    }
    // Client-side filter by title substring when user typed plain text
    const t = this._filterText.replace(/\"/g, '').toLowerCase();
    if (t && !(this._filterText.startsWith('"') && this._filterText.endsWith('"'))) {
      items = items.filter(it => String(it.title||'').toLowerCase().includes(t) || String(it.release_year||'')===t);
    }
    this._render(items);
  }

  _render(items) {
    this.$page.textContent = String(this._page);
    if (!items.length) {
      this.$results.innerHTML = `<div class="empty">No results.</div>`;
      return;
    }
    const html = items.map(it => {
      const title = it.title ?? '(untitled)';
      const year = it.release_year ?? '';
      const genres = Array.isArray(it.genre) ? it.genre.join(', ') : '';
      const dir = it.meta_dir || it._meta_dir || '';
      return `
        <div class="item">
          <div><strong>${title}</strong> ${year ? `(${year})` : ''}</div>
          <div class="meta">${genres}</div>
          ${dir ? `<div class="meta"><a href="/${dir}" target="_blank">/${dir}</a></div>` : ''}
        </div>
      `;
    }).join('');
    this.$results.innerHTML = html;
  }
}

customElements.define('movie-search', MovieSearch);
