class RelayModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onBackdrop = this._onBackdrop.bind(this);
  }

  connectedCallback() {
    const title = this.getAttribute('title') || '';
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: contents; }
        .backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,.35);
          display: none; align-items: center; justify-content: center;
          z-index: 1000;
        }
        .backdrop.open { display: flex; }
        .modal {
          background: #fff; color: inherit; border-radius: 10px;
          box-shadow: 0 24px 60px rgba(0,0,0,.25);
          width: min(720px, 92vw); max-height: 86vh; overflow: auto;
          transform: translateY(8px); opacity: 0; transition: all 160ms ease;
        }
        .open .modal { transform: translateY(0); opacity: 1; }
        header { display:flex; align-items:center; justify-content:space-between;
          padding: .75rem 1rem; border-bottom: 1px solid rgba(0,0,0,.08);
          position: sticky; top: 0; background: #fff; z-index: 1; }
        header h3 { margin: 0; font-size: 1rem; }
        header button { appearance: none; border: 0; background: transparent; font-size: 1.25rem; cursor: pointer; }
        section { padding: 1rem; }
      </style>
      <div class="backdrop" part="backdrop" role="dialog" aria-modal="true">
        <div class="modal" part="modal">
          <header>
            <h3 part="title">${title}</h3>
            <button title="Close" aria-label="Close" part="close">×</button>
          </header>
          <section part="body"><slot></slot></section>
        </div>
      </div>
    `;
    this._backdrop = this.shadowRoot.querySelector('.backdrop');
    this._closeBtn = this.shadowRoot.querySelector('button[part="close"]');
    this._backdrop.addEventListener('click', this._onBackdrop);
    this._closeBtn.addEventListener('click', () => this.close());
  }

  disconnectedCallback() {
    this._backdrop?.removeEventListener('click', this._onBackdrop);
  }

  _onBackdrop(e) {
    if (e.target === this._backdrop) this.close();
  }

  open() {
    this._backdrop?.classList.add('open');
  }
  close() {
    this._backdrop?.classList.remove('open');
  }
}

customElements.define('relay-modal', RelayModal);
