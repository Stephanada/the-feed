/**
 * THE FEED — <the-feed-ingest> Web Component  v2.0
 * ══════════════════════════════════════════════════════════════
 * "The Death of the Form"
 *
 * Natural language + URL event submission. No forms. No login.
 * Fully skinnable — 3 built-in presets, remote skin JSON support,
 * CSS custom property overrides, per-skin light/dark modes.
 *
 * ── USAGE ────────────────────────────────────────────────────
 *
 *   <the-feed-ingest
 *     api="https://the-feed-ingest.workers.dev"
 *     token="your-source-token"
 *     location-hint="Kamloops, BC"
 *     skin="broadcast"
 *     mode="dark"
 *   ></the-feed-ingest>
 *
 * ── ATTRIBUTES ───────────────────────────────────────────────
 *
 *   api            Ingest worker base URL
 *   token          Source bearer token (optional — sets trust level)
 *   api-key        OpenAI key (sk-...) — BYOK
 *   location-hint  City/region for relative date resolution
 *   placeholder    Textarea placeholder override
 *   skin           "default" | "broadcast" | "poster" | https://...skin.json
 *   mode           "light" | "dark" | "auto" (follows OS preference)
 *
 * ── SKIN CSS CUSTOM PROPERTIES (inline overrides) ────────────
 *
 *   --tfi-accent          Primary action colour
 *   --tfi-accent-text     Text on accent background
 *   --tfi-background      Card/container background
 *   --tfi-surface         Input/field background
 *   --tfi-border          Input border colour
 *   --tfi-text-primary    Main text
 *   --tfi-text-secondary  Secondary text
 *   --tfi-text-muted      Placeholder / meta text
 *   --tfi-font-family     Font stack
 *   --tfi-font-size       Base font size
 *   --tfi-radius-input    Input border radius
 *   --tfi-radius-btn      Button border radius
 *   --tfi-radius-card     Card border radius
 *   --tfi-shadow-card     Card box shadow
 *
 * ── EVENTS ───────────────────────────────────────────────────
 *
 *   the-feed:submitted   { detail: { status, event, id, message } }
 *   the-feed:error       { detail: { error } }
 */

// ─────────────────────────────────────────────
// Built-in skin definitions
// ─────────────────────────────────────────────

const SKINS = {
  default: {
    id: 'default', name: 'Default',
    modes: {
      light: {
        colors: { accent:'#e94560', accent_text:'#ffffff', background:'#ffffff', surface:'#f9f9fb', border:'#e2e2e8', text_primary:'#111111', text_secondary:'#555555', text_muted:'#999999', success:'#22c55e', warning:'#f59e0b', danger:'#ef4444' },
        typography: { font_family:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", font_size_base:'15px', font_weight_bold:'700' },
        shape: { radius_input:'10px', radius_btn:'8px', radius_card:'12px', shadow_card:'0 2px 16px rgba(0,0,0,0.07)' },
      },
      dark: {
        colors: { accent:'#e94560', accent_text:'#ffffff', background:'#1e1e2e', surface:'#2a2a3e', border:'rgba(255,255,255,0.10)', text_primary:'#f0f0f0', text_secondary:'#aaaaaa', text_muted:'#666666', success:'#22c55e', warning:'#f59e0b', danger:'#ef4444' },
        typography: { font_family:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", font_size_base:'15px', font_weight_bold:'700' },
        shape: { radius_input:'10px', radius_btn:'8px', radius_card:'12px', shadow_card:'0 2px 16px rgba(0,0,0,0.3)' },
      },
    },
  },
  broadcast: {
    id: 'broadcast', name: 'Broadcast',
    modes: {
      light: {
        colors: { accent:'#00b4d8', accent_text:'#000000', background:'#f0f4f8', surface:'#e2eaf2', border:'#c8d6e5', text_primary:'#0d1b2a', text_secondary:'#3a5068', text_muted:'#7a90a4', success:'#06b6d4', warning:'#f59e0b', danger:'#ef4444' },
        typography: { font_family:"'IBM Plex Mono', 'Courier New', monospace", font_size_base:'14px', font_weight_bold:'600' },
        shape: { radius_input:'4px', radius_btn:'3px', radius_card:'4px', shadow_card:'0 1px 4px rgba(0,0,0,0.12)' },
      },
      dark: {
        colors: { accent:'#00b4d8', accent_text:'#000000', background:'#0d1117', surface:'#161b22', border:'rgba(0,180,216,0.18)', text_primary:'#cdd9e5', text_secondary:'#8b949e', text_muted:'#484f58', success:'#39d353', warning:'#f0883e', danger:'#f85149' },
        typography: { font_family:"'IBM Plex Mono', 'Courier New', monospace", font_size_base:'14px', font_weight_bold:'600' },
        shape: { radius_input:'4px', radius_btn:'3px', radius_card:'4px', shadow_card:'0 0 0 1px rgba(0,180,216,0.15), 0 4px 16px rgba(0,0,0,0.4)' },
      },
    },
  },
  poster: {
    id: 'poster', name: 'Poster',
    modes: {
      light: {
        colors: { accent:'#ff3c00', accent_text:'#ffffff', background:'#fffdf7', surface:'#fff8ec', border:'#f0d9b5', text_primary:'#1a0a00', text_secondary:'#4a2e1a', text_muted:'#a07850', success:'#2d9a4e', warning:'#e8a317', danger:'#cc1100' },
        typography: { font_family:"'Anton', 'Impact', 'Arial Black', sans-serif", font_size_base:'15px', font_weight_bold:'700' },
        shape: { radius_input:'2px', radius_btn:'2px', radius_card:'2px', shadow_card:'4px 4px 0px #1a0a00' },
      },
      dark: {
        colors: { accent:'#ff3c00', accent_text:'#ffffff', background:'#0f0800', surface:'#1a1000', border:'rgba(255,60,0,0.25)', text_primary:'#fff8ec', text_secondary:'#d4a870', text_muted:'#7a5535', success:'#39d353', warning:'#f0883e', danger:'#ff3c00' },
        typography: { font_family:"'Anton', 'Impact', 'Arial Black', sans-serif", font_size_base:'15px', font_weight_bold:'700' },
        shape: { radius_input:'2px', radius_btn:'2px', radius_card:'2px', shadow_card:'4px 4px 0px rgba(255,60,0,0.5)' },
      },
    },
  },
};

const DEFAULT_INGEST_API = 'https://the-feed-ingest.stephan-99b.workers.dev';

// ─────────────────────────────────────────────
// Skin → CSS custom properties
// ─────────────────────────────────────────────

function skinToVars(skinDef, resolvedMode) {
  const m = skinDef.modes?.[resolvedMode] ?? skinDef.modes?.light ?? {};
  const c = m.colors ?? {};
  const t = m.typography ?? {};
  const s = m.shape ?? {};
  return `
    --tfi-accent:          ${c.accent         ?? '#e94560'};
    --tfi-accent-text:     ${c.accent_text     ?? '#ffffff'};
    --tfi-background:      ${c.background      ?? '#ffffff'};
    --tfi-surface:         ${c.surface         ?? '#f9f9fb'};
    --tfi-border:          ${c.border          ?? '#e2e2e8'};
    --tfi-text-primary:    ${c.text_primary     ?? '#111111'};
    --tfi-text-secondary:  ${c.text_secondary   ?? '#555555'};
    --tfi-text-muted:      ${c.text_muted       ?? '#999999'};
    --tfi-success:         ${c.success          ?? '#22c55e'};
    --tfi-warning:         ${c.warning          ?? '#f59e0b'};
    --tfi-danger:          ${c.danger           ?? '#ef4444'};
    --tfi-font-family:     ${t.font_family      ?? 'sans-serif'};
    --tfi-font-size:       ${t.font_size_base   ?? '15px'};
    --tfi-font-bold:       ${t.font_weight_bold ?? '700'};
    --tfi-radius-input:    ${s.radius_input     ?? '8px'};
    --tfi-radius-btn:      ${s.radius_btn       ?? '8px'};
    --tfi-radius-card:     ${s.radius_card      ?? '12px'};
    --tfi-shadow-card:     ${s.shadow_card      ?? 'none'};
  `;
}

// ─────────────────────────────────────────────
// Base styles (use CSS vars throughout)
// ─────────────────────────────────────────────

const BASE_STYLES = `
  :host {
    display: block;
    font-family: var(--tfi-font-family);
    font-size: var(--tfi-font-size);
    color: var(--tfi-text-primary);
  }

  *, *::before, *::after { box-sizing: border-box; }

  .tfi-shell {
    background: var(--tfi-background);
    border-radius: var(--tfi-radius-card);
    box-shadow: var(--tfi-shadow-card);
    padding: 1.5rem;
  }

  .tfi-header { margin-bottom: 1.25rem; }
  .tfi-header h3 {
    font-size: 1.05rem;
    font-weight: var(--tfi-font-bold);
    color: var(--tfi-text-primary);
    margin: 0 0 0.2rem;
  }
  .tfi-header p {
    font-size: 0.8rem;
    color: var(--tfi-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .tfi-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    font-weight: var(--tfi-font-bold);
    padding: 3px 10px;
    border-radius: 999px;
    margin-bottom: 1rem;
    letter-spacing: 0.02em;
  }
  .tfi-badge.verified  { background: rgba(34,197,94,0.12); color: var(--tfi-success); }
  .tfi-badge.anonymous { background: rgba(128,128,128,0.12); color: var(--tfi-text-muted); }

  .tfi-fields { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.875rem; }

  .tfi-field-label {
    display: block;
    font-size: 0.7rem;
    font-weight: var(--tfi-font-bold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tfi-text-muted);
    margin-bottom: 0.3rem;
  }

  textarea, input[type="url"], input[type="password"] {
    width: 100%;
    padding: 0.75rem 0.875rem;
    background: var(--tfi-surface);
    border: 1.5px solid var(--tfi-border);
    border-radius: var(--tfi-radius-input);
    font-family: var(--tfi-font-family);
    font-size: var(--tfi-font-size);
    color: var(--tfi-text-primary);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  textarea {
    min-height: 110px;
    resize: vertical;
    line-height: 1.6;
  }

  textarea:focus, input[type="url"]:focus, input[type="password"]:focus {
    border-color: var(--tfi-accent);
    box-shadow: 0 0 0 3px rgba(0,0,0,0.06);
  }

  textarea::placeholder, input::placeholder { color: var(--tfi-text-muted); }

  .tfi-char-count {
    font-size: 0.68rem;
    color: var(--tfi-text-muted);
    text-align: right;
    margin-top: 0.2rem;
  }
  .tfi-char-count.warn { color: var(--tfi-warning); }

  .tfi-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--tfi-text-muted);
    font-size: 0.7rem;
    font-weight: var(--tfi-font-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .tfi-divider::before, .tfi-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--tfi-border);
  }

  .tfi-key-section { margin-bottom: 0.875rem; }

  .tfi-key-toggle {
    font-size: 0.72rem;
    color: var(--tfi-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-decoration-style: dotted;
    font-family: var(--tfi-font-family);
  }
  .tfi-key-row { display: none; margin-top: 0.4rem; }
  .tfi-key-row.visible { display: block; }
  .tfi-key-row input { font-family: monospace; font-size: 0.8125rem; margin-bottom: 0.35rem; }
  .tfi-key-save-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    color: var(--tfi-text-muted);
    cursor: pointer;
    user-select: none;
  }
  .tfi-key-save-row input[type="checkbox"] { cursor: pointer; accent-color: var(--tfi-accent); }
  .tfi-key-saved-note {
    display: none;
    font-size: 0.7rem;
    color: var(--tfi-success);
    margin-top: 0.2rem;
  }
  .tfi-key-saved-note.visible { display: block; }

  .tfi-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    border: none;
    border-radius: var(--tfi-radius-btn);
    font-family: var(--tfi-font-family);
    font-size: var(--tfi-font-size);
    font-weight: var(--tfi-font-bold);
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .tfi-submit:hover:not(:disabled) { opacity: 0.85; }
  .tfi-submit:active:not(:disabled) { transform: scale(0.98); }
  .tfi-submit:disabled { opacity: 0.45; cursor: not-allowed; }

  .tfi-status { margin-top: 1rem; padding: 0.875rem 1rem; border-radius: var(--tfi-radius-input); font-size: 0.875rem; line-height: 1.5; display: none; }
  .tfi-status.visible { display: flex; align-items: flex-start; gap: 10px; }
  .tfi-status.loading  { color: var(--tfi-text-secondary); background: rgba(128,128,128,0.06); }
  .tfi-status.success  { color: var(--tfi-success); background: rgba(34,197,94,0.08); border-left: 3px solid var(--tfi-success); }
  .tfi-status.review   { color: var(--tfi-warning); background: rgba(245,158,11,0.08); border-left: 3px solid var(--tfi-warning); }
  .tfi-status.error    { color: var(--tfi-danger);  background: rgba(239,68,68,0.08); border-left: 3px solid var(--tfi-danger); }
  .tfi-status.rejected { color: var(--tfi-danger);  background: rgba(239,68,68,0.08); border-left: 3px solid var(--tfi-danger); }

  .tfi-spinner {
    width: 15px; height: 15px; flex-shrink: 0;
    border: 2px solid rgba(128,128,128,0.2);
    border-top-color: var(--tfi-accent);
    border-radius: 50%;
    animation: tfi-spin 0.7s linear infinite;
  }
  @keyframes tfi-spin { to { transform: rotate(360deg); } }

  .tfi-preview {
    margin-top: 0.875rem;
    padding: 0.875rem;
    background: var(--tfi-surface);
    border-radius: var(--tfi-radius-input);
    border: 1.5px solid var(--tfi-border);
    font-size: 0.8125rem;
    display: none;
  }
  .tfi-preview.visible { display: block; }
  .tfi-preview-title { font-weight: var(--tfi-font-bold); font-size: 0.9375rem; color: var(--tfi-text-primary); margin-bottom: 0.5rem; }
  .tfi-preview-row { display: flex; gap: 8px; margin-bottom: 0.2rem; color: var(--tfi-text-secondary); }
  .tfi-preview-label { font-weight: var(--tfi-font-bold); min-width: 68px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tfi-text-muted); padding-top: 1px; flex-shrink: 0; }

  .tfi-skin-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 1rem;
    padding-top: 0.875rem;
    border-top: 1px solid var(--tfi-border);
    flex-wrap: wrap;
  }
  .tfi-skin-bar-label {
    font-size: 0.68rem;
    color: var(--tfi-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: var(--tfi-font-bold);
    margin-right: 2px;
  }
  .tfi-skin-btn {
    font-size: 0.7rem;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--tfi-border);
    background: transparent;
    color: var(--tfi-text-muted);
    cursor: pointer;
    font-family: var(--tfi-font-family);
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }
  .tfi-skin-btn:hover { border-color: var(--tfi-accent); color: var(--tfi-accent); }
  .tfi-skin-btn.active { background: var(--tfi-accent); color: var(--tfi-accent-text); border-color: var(--tfi-accent); }
  .tfi-mode-btn {
    margin-left: auto;
    font-size: 0.7rem;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--tfi-border);
    background: transparent;
    color: var(--tfi-text-muted);
    cursor: pointer;
    font-family: var(--tfi-font-family);
    transition: border-color 0.12s, color 0.12s;
  }
  .tfi-mode-btn:hover { border-color: var(--tfi-accent); color: var(--tfi-accent); }
`;

// ─────────────────────────────────────────────
// <the-feed-ingest> Custom Element
// ─────────────────────────────────────────────

class TheFeedIngest extends HTMLElement {
  static get observedAttributes() {
    return ['api', 'token', 'location-hint', 'placeholder', 'skin', 'mode', 'api-key'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._activeSkin = null;
    this._resolvedMode = 'light';
    this._skinVars = '';
    this._apiKey = null;
  }

  connectedCallback() {
    this._apiKey = this.getAttribute('api-key') ?? null;
    this._resolveMode();
    this._resolveSkin(this.getAttribute('skin') ?? 'default').then(() => this._render());
    if ((this.getAttribute('mode') ?? 'auto') === 'auto') {
      this._mql = window.matchMedia('(prefers-color-scheme: dark)');
      this._mqlHandler = () => { this._resolveMode(); this._applyVars(); };
      this._mql.addEventListener('change', this._mqlHandler);
    }
  }

  disconnectedCallback() {
    this._mql?.removeEventListener('change', this._mqlHandler);
  }

  attributeChangedCallback(name, _, newVal) {
    if (!this.isConnected) return;
    if (name === 'api-key') { this._apiKey = newVal; return; }
    if (name === 'skin') { this._resolveSkin(newVal ?? 'default').then(() => this._applyVars()); return; }
    if (name === 'mode') { this._resolveMode(); this._applyVars(); return; }
    this._render();
  }

  _resolveMode() {
    const attr = this.getAttribute('mode') ?? 'auto';
    if (attr === 'dark')  { this._resolvedMode = 'dark';  return; }
    if (attr === 'light') { this._resolvedMode = 'light'; return; }
    this._resolvedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  async _resolveSkin(skinAttr) {
    if (!skinAttr || skinAttr === 'default') {
      this._activeSkin = SKINS.default;
    } else if (SKINS[skinAttr]) {
      this._activeSkin = SKINS[skinAttr];
    } else if (skinAttr.startsWith('http')) {
      try {
        const res = await fetch(skinAttr);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this._activeSkin = await res.json();
      } catch (e) {
        console.warn('[TheFeedIngest] Remote skin failed:', e.message, '— using default');
        this._activeSkin = SKINS.default;
      }
    } else {
      this._activeSkin = SKINS.default;
    }
    this._skinVars = skinToVars(this._activeSkin, this._resolvedMode);
  }

  _applyVars() {
    this._skinVars = skinToVars(this._activeSkin, this._resolvedMode);
    const styleEl = this._shadow.getElementById('tfi-vars');
    if (styleEl) styleEl.textContent = ':host { ' + this._skinVars + ' }';
    this._shadow.querySelectorAll('.tfi-skin-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.skin === (this._activeSkin?.id ?? 'default'));
    });
    const modeBtn = this._shadow.getElementById('tfi-mode-btn');
    if (modeBtn) modeBtn.textContent = this._resolvedMode === 'dark' ? '\u2600 Light' : '\u263e Dark';
  }

  _render() {
    const placeholder = this.getAttribute('placeholder')
      ?? "Paste a show listing, venue email, or describe the event in plain English...\n\nExamples:\n\u2022 'The Trews are playing the Commodore this Friday at 8pm. Tix $35.'\n\u2022 'We're at the Legion Hall on April 20th, doors 7pm, $10 advance'";

    const hasToken = !!this.getAttribute('token');
    const skinId   = this._activeSkin?.id ?? 'default';

    this._shadow.innerHTML =
      '<style id="tfi-vars">:host { ' + this._skinVars + ' }</style>' +
      '<style>' + BASE_STYLES + '</style>' +
      '<div class="tfi-shell">' +
        '<div class="tfi-header"><h3>\uD83C\uDFB5 Add an Event to The Feed</h3><p>Paste a URL, describe the show, or both. No forms. No account.</p></div>' +
        '<div class="tfi-badge ' + (hasToken ? 'verified' : 'anonymous') + '">' + (hasToken ? '\u2713 Verified source' : '\u25CB Public submission') + '</div>' +
        '<div class="tfi-fields">' +
          '<div>' +
            '<label class="tfi-field-label" for="tfi-url">Event URL <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>' +
            '<input type="url" id="tfi-url" placeholder="https://bandsintown.com/\u2026 venue site, Facebook event, Eventbrite, etc." autocomplete="off" spellcheck="false">' +
          '</div>' +
          '<div class="tfi-divider">or add context</div>' +
          '<div>' +
            '<label class="tfi-field-label" for="tfi-text">Description <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>' +
            '<textarea id="tfi-text" placeholder="' + this._escHtml(placeholder) + '" maxlength="10000" spellcheck="true" autocorrect="on"></textarea>' +
            '<div class="tfi-char-count" id="tfi-char">0 / 10,000</div>' +
          '</div>' +
        '</div>' +
        this._renderKeySection() +
        '<button class="tfi-submit" id="tfi-submit" type="button">' + this._iconSend() + ' Submit to The Feed</button>' +
        '<div class="tfi-status" id="tfi-status"></div>' +
        '<div class="tfi-preview" id="tfi-preview"></div>' +
        '<div class="tfi-skin-bar">' +
          '<span class="tfi-skin-bar-label">Skin</span>' +
          Object.keys(SKINS).map(function(id) {
            return '<button class="tfi-skin-btn' + (skinId === id ? ' active' : '') + '" data-skin="' + id + '">' + SKINS[id].name + '</button>';
          }).join('') +
          '<button class="tfi-mode-btn" id="tfi-mode-btn">' + (this._resolvedMode === 'dark' ? '\u2600 Light' : '\u263e Dark') + '</button>' +
        '</div>' +
      '</div>';

    this._bindEvents();
  }

  _bindEvents() {
    var self      = this;
    var textarea  = this._shadow.getElementById('tfi-text');
    var charCount = this._shadow.getElementById('tfi-char');
    var keyToggle = this._shadow.getElementById('tfi-key-toggle');
    var keyRow    = this._shadow.getElementById('tfi-key-row');
    var keyInput  = this._shadow.getElementById('tfi-api-key');
    var saveCb    = this._shadow.getElementById('tfi-key-save');
    var savedNote = this._shadow.getElementById('tfi-key-saved-note');
    var submitBtn = this._shadow.getElementById('tfi-submit');
    var modeBtn   = this._shadow.getElementById('tfi-mode-btn');

    if (textarea) {
      textarea.addEventListener('input', function() {
        var len = textarea.value.length;
        charCount.textContent = len.toLocaleString() + ' / 10,000';
        charCount.classList.toggle('warn', len > 8000);
      });
      textarea.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') self._submit();
      });
    }

    if (keyToggle) {
      keyToggle.addEventListener('click', function() {
        var visible = keyRow.classList.toggle('visible');
        keyToggle.textContent = visible ? '🔑 Hide key' : '🔑 Enter your OpenAI API key';
      });
    }

    // Save key to localStorage when checkbox is ticked or key is changed
    if (keyInput && saveCb) {
      keyInput.addEventListener('change', function() {
        if (saveCb.checked && keyInput.value.startsWith('sk-')) {
          try { localStorage.setItem('tfi_openai_key', keyInput.value); } catch(e) {}
          if (savedNote) savedNote.classList.add('visible');
        }
      });
      saveCb.addEventListener('change', function() {
        if (saveCb.checked && keyInput.value.startsWith('sk-')) {
          try { localStorage.setItem('tfi_openai_key', keyInput.value); } catch(e) {}
          if (savedNote) savedNote.classList.add('visible');
        } else if (!saveCb.checked) {
          try { localStorage.removeItem('tfi_openai_key'); } catch(e) {}
          if (savedNote) savedNote.classList.remove('visible');
        }
      });
    }

    if (submitBtn) submitBtn.addEventListener('click', function() { self._submit(); });

    this._shadow.querySelectorAll('.tfi-skin-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { self.setAttribute('skin', btn.dataset.skin); });
    });

    if (modeBtn) {
      modeBtn.addEventListener('click', function() {
        self.setAttribute('mode', self._resolvedMode === 'dark' ? 'light' : 'dark');
      });
    }
  }

  async _submit() {
    var urlInput  = this._shadow.getElementById('tfi-url');
    var textarea  = this._shadow.getElementById('tfi-text');
    var keyInput  = this._shadow.getElementById('tfi-api-key');
    var submitBtn = this._shadow.getElementById('tfi-submit');
    var preview   = this._shadow.getElementById('tfi-preview');

    var url    = (urlInput?.value ?? '').trim();
    var text   = (textarea?.value ?? '').trim();
    var apiKey = (keyInput?.value ?? '').trim() || this._apiKey;

    if (!url && !text) {
      this._showStatus('error', 'Please enter a URL, a description, or both.');
      return;
    }
    if (url && !this._isValidUrl(url)) {
      this._showStatus('error', "\u274C That doesn't look like a valid URL. Check it and try again.");
      return;
    }
    if (!apiKey || !apiKey.startsWith('sk-')) {
      // Make the key row visible so the user knows where to enter it
      var kr = this._shadow.getElementById('tfi-key-row');
      var kt = this._shadow.getElementById('tfi-key-toggle');
      if (kr) kr.classList.add('visible');
      if (kt) kt.textContent = '🔑 Hide key';
      this._showStatus('error', 'An OpenAI API key (sk-\u2026) is required \u2014 see above.');
      return;
    }

    submitBtn.disabled = true;
    preview.classList.remove('visible');
    this._showStatus('loading', 'Extracting event details\u2026');

    var api     = (this.getAttribute('api') ?? DEFAULT_INGEST_API).replace(/\/$/, '');
    var token   = this.getAttribute('token');
    var locHint = this.getAttribute('location-hint') ?? '';

    var headers = { 'Content-Type': 'application/json', 'X-Api-Key': apiKey };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var body = { source: token ? 'verified_source' : 'web_component' };
    if (url)     body.url           = url;
    if (text)    body.text          = text;
    if (locHint) body.location_hint = locHint;

    try {
      var res  = await fetch(api + '/ingest/raw', { method: 'POST', headers: headers, body: JSON.stringify(body) });
      var data = await res.json();

      if (!res.ok || data.error) {
        var msg = data.error ?? data.detail ?? ('Server error (' + res.status + ')');
        this._showStatus('error', '\u274C ' + msg);
        this.dispatchEvent(new CustomEvent('the-feed:error', { detail: { error: msg }, bubbles: true }));
        return;
      }
      if (data.status === 'rejected') {
        this._showStatus('rejected', '\uD83D\uDEAB Rejected: ' + (data.reason ?? 'Brand safety check failed.'));
        return;
      }
      if (data.status === 'no_events_found') {
        this._showStatus('error', "\uD83E\uDD14 Couldn't find event details. Try adding a performer, date, and venue." + (data.extractionNotes ? ' Hint: ' + data.extractionNotes : ''));
        return;
      }

      var isPending = data.status === 'pending_review';
      this._showStatus(isPending ? 'review' : 'success', data.message ?? (isPending ? '\uD83D\uDCEC Submitted for review.' : '\u2705 Event added to The Feed!'));
      if (data.event) this._showPreview(data.event);

      if (urlInput) urlInput.value = '';
      if (textarea) {
        textarea.value = '';
        var cc = this._shadow.getElementById('tfi-char');
        if (cc) cc.textContent = '0 / 10,000';
      }

      this.dispatchEvent(new CustomEvent('the-feed:submitted', {
        detail: { status: data.status, event: data.event, id: data.id, message: data.message },
        bubbles: true,
      }));
    } catch (err) {
      this._showStatus('error', '\u274C Network error: ' + err.message);
      this.dispatchEvent(new CustomEvent('the-feed:error', { detail: { error: err.message }, bubbles: true }));
    } finally {
      submitBtn.disabled = false;
    }
  }

  _renderKeySection() {
    // If api-key attribute is set, the host has provided a server-side or hardcoded key.
    // Hide the key section entirely — no need to prompt the user.
    if (this._apiKey) return '';

    // Check localStorage for a previously saved key
    var saved = '';
    try { saved = localStorage.getItem('tfi_openai_key') ?? ''; } catch(e) {}

    var hasSaved = saved.startsWith('sk-');

    // If user has a saved key: show a collapsed toggle with a "key on file" hint.
    // If no saved key: show the toggle expanded so they know they need to act.
    var toggleText = hasSaved ? '🔑 OpenAI key saved — click to change' : '🔑 Enter your OpenAI API key to submit';
    var rowVisible  = hasSaved ? '' : ' visible';

    return '<div class="tfi-key-section">' +
      '<button class="tfi-key-toggle" id="tfi-key-toggle" type="button">' + toggleText + '</button>' +
      '<div class="tfi-key-row' + rowVisible + '" id="tfi-key-row">' +
        '<input type="password" id="tfi-api-key" placeholder="sk-..." autocomplete="off" spellcheck="false" value="' + this._escHtml(saved) + '">' +
        '<label class="tfi-key-save-row">' +
          '<input type="checkbox" id="tfi-key-save"' + (hasSaved ? ' checked' : '') + '>' +
          'Save key in this browser (never sent to anyone except OpenAI)' +
        '</label>' +
        '<div class="tfi-key-saved-note' + (hasSaved ? ' visible' : '') + '" id="tfi-key-saved-note">\u2713 Key saved in this browser</div>' +
      '</div>' +
    '</div>';
  }

  _showStatus(type, message) {
    var el = this._shadow.getElementById('tfi-status');
    el.className = 'tfi-status visible ' + type;
    el.innerHTML = type === 'loading'
      ? '<div class="tfi-spinner"></div><span>' + message + '</span>'
      : '<span>' + message + '</span>';
  }

  _showPreview(evt) {
    var preview    = this._shadow.getElementById('tfi-preview');
    var performers = [].concat(evt.performer ?? []).filter(Boolean);
    var offers     = [].concat(evt.offers ?? []).filter(Boolean);
    var price      = offers[0]?.price != null ? '$' + offers[0].price + ' ' + (offers[0].priceCurrency ?? 'CAD') : 'TBA';
    var date       = evt.startDate
      ? new Date(evt.startDate).toLocaleString('en-CA', { weekday:'long', month:'long', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : 'TBA';
    var locality   = evt.location?.address?.addressLocality ? ', ' + this._escHtml(evt.location.address.addressLocality) : '';

    preview.className = 'tfi-preview visible';
    preview.innerHTML =
      '<div class="tfi-preview-title">'  + this._escHtml(evt.name ?? 'Untitled Event') + '</div>' +
      '<div class="tfi-preview-row"><span class="tfi-preview-label">Date</span><span>'    + this._escHtml(date) + '</span></div>' +
      '<div class="tfi-preview-row"><span class="tfi-preview-label">Venue</span><span>'   + this._escHtml(evt.location?.name ?? 'TBA') + locality + '</span></div>' +
      (performers.length ? '<div class="tfi-preview-row"><span class="tfi-preview-label">Artists</span><span>' + performers.map(p => this._escHtml(p.name ?? p)).join(', ') + '</span></div>' : '') +
      '<div class="tfi-preview-row"><span class="tfi-preview-label">Tickets</span><span>' + this._escHtml(price) + '</span></div>' +
      '<div class="tfi-preview-row"><span class="tfi-preview-label">ID</span><span style="font-family:monospace;font-size:0.72rem;">' + this._escHtml(String(evt['@id'] ?? '').substring(0, 26)) + '\u2026</span></div>';
  }

  _isValidUrl(s) {
    try { var u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }

  _escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  _iconSend() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  }
}

if (!customElements.get('the-feed-ingest')) {
  customElements.define('the-feed-ingest', TheFeedIngest);
}

export { TheFeedIngest, SKINS, skinToVars };
