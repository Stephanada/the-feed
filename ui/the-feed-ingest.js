/**
 * THE FEED — <the-feed-ingest> Web Component
 * ══════════════════════════════════════════════════════════════
 * "The Death of the Form"
 *
 * A single, frictionless event submission interface.
 * One text field. One button. Optional voice input.
 * No login. No account. No form fields.
 *
 * USAGE:
 *   <the-feed-ingest
 *     api="https://the-feed-ingest.workers.dev"
 *     token="your-source-token"
 *     location-hint="Kamloops, BC"
 *     placeholder="Tell me about the show..."
 *   ></the-feed-ingest>
 *
 * ATTRIBUTES:
 *   api            Ingest worker base URL
 *   token          Source bearer token (optional — sets trust level)
 *   location-hint  City/region context for relative date resolution
 *   placeholder    Textarea placeholder text
 *   theme          "light" (default) | "dark"
 *   api-key        OpenAI API key (BYOK) — can also be set at runtime
 *
 * EVENTS EMITTED:
 *   the-feed:submitted   → CustomEvent with { detail: { status, event, id, message } }
 *   the-feed:error       → CustomEvent with { detail: { error } }
 *
 * THEMING (CSS Custom Properties):
 *   --primary-color, --accent-color, --font-family,
 *   --input-radius, --btn-radius, --card-bg
 */

const DEFAULT_INGEST_API = 'https://the-feed-ingest.workers.dev';

const INGEST_STYLES = /* css */`
  :host {
    --primary-color: #1a1a2e;
    --accent-color: #e94560;
    --success-color: #22c55e;
    --warning-color: #f59e0b;
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-size-base: 15px;
    --card-bg: #ffffff;
    --card-bg-dark: #1e1e2e;
    --input-bg: #f9f9fb;
    --input-bg-dark: #2a2a3e;
    --input-border: #e2e2e8;
    --input-border-focus: var(--accent-color);
    --input-radius: 10px;
    --btn-radius: 8px;
    --text-primary: #111111;
    --text-secondary: #555555;
    --text-muted: #888888;
    display: block;
    font-family: var(--font-family);
    font-size: var(--font-size-base);
  }

  :host([theme="dark"]) {
    --card-bg: var(--card-bg-dark);
    --input-bg: var(--input-bg-dark);
    --input-border: rgba(255,255,255,0.12);
    --text-primary: #f0f0f0;
    --text-secondary: #aaaaaa;
    --text-muted: #666666;
  }

  *, *::before, *::after { box-sizing: border-box; }

  .container {
    background: var(--card-bg);
    border-radius: var(--input-radius);
    padding: 1.5rem;
  }

  .header {
    margin-bottom: 1rem;
  }

  .header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.25rem;
  }

  .header p {
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Input area ── */
  .input-wrapper {
    position: relative;
    margin-bottom: 0.875rem;
  }

  textarea {
    width: 100%;
    min-height: 120px;
    padding: 0.875rem 2.75rem 0.875rem 0.875rem;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: var(--input-radius);
    font-family: var(--font-family);
    font-size: 0.9375rem;
    color: var(--text-primary);
    line-height: 1.6;
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
  }

  textarea:focus {
    border-color: var(--input-border-focus);
    box-shadow: 0 0 0 3px rgba(233,69,96,0.12);
  }

  textarea::placeholder { color: var(--text-muted); }

  textarea.recording {
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.15);
    animation: pulse-border 1.5s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%, 100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
    50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0.08); }
  }

  /* ── Voice button (inside textarea corner) ── */
  .voice-btn {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: color 0.15s, background 0.15s;
    padding: 0;
  }

  .voice-btn:hover { color: var(--accent-color); background: rgba(233,69,96,0.08); }
  .voice-btn.active { color: #ef4444; background: rgba(239,68,68,0.1); }
  .voice-btn.unsupported { opacity: 0.3; cursor: not-allowed; }

  /* ── BYOK key input (collapsible) ── */
  .key-toggle {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 4px;
    text-decoration: underline;
    text-decoration-style: dotted;
  }

  .key-input-row {
    display: none;
    margin-bottom: 0.875rem;
  }

  .key-input-row.visible { display: flex; gap: 8px; }

  .key-input-row input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: monospace;
    color: var(--text-primary);
    outline: none;
  }

  .key-input-row input:focus { border-color: var(--input-border-focus); }

  /* ── Submit button ── */
  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    color: #fff;
    border: none;
    border-radius: var(--btn-radius);
    font-family: var(--font-family);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }

  .submit-btn:hover:not(:disabled) { opacity: 0.88; }
  .submit-btn:active:not(:disabled) { transform: scale(0.98); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Status feedback ── */
  .status {
    margin-top: 1rem;
    padding: 0.875rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    line-height: 1.5;
    display: none;
  }

  .status.visible { display: block; }
  .status.loading  { background: rgba(233,69,96,0.06); color: var(--text-secondary); display: flex; align-items: center; gap: 10px; }
  .status.success  { background: rgba(34,197,94,0.08); color: #15803d; border-left: 3px solid var(--success-color); }
  .status.review   { background: rgba(245,158,11,0.08); color: #92400e; border-left: 3px solid var(--warning-color); }
  .status.error    { background: rgba(239,68,68,0.08); color: #b91c1c; border-left: 3px solid #ef4444; }
  .status.rejected { background: rgba(239,68,68,0.08); color: #b91c1c; border-left: 3px solid #ef4444; }

  .spinner {
    width: 16px; height: 16px; flex-shrink: 0;
    border: 2px solid rgba(233,69,96,0.2);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Extracted event preview ── */
  .event-preview {
    margin-top: 0.875rem;
    padding: 0.875rem;
    background: var(--input-bg);
    border-radius: 8px;
    border: 1px solid var(--input-border);
    font-size: 0.8125rem;
    display: none;
  }

  .event-preview.visible { display: block; }

  .event-preview .preview-title {
    font-weight: 700;
    font-size: 0.9375rem;
    color: var(--text-primary);
    margin-bottom: 0.4rem;
  }

  .event-preview .preview-row {
    display: flex;
    gap: 8px;
    color: var(--text-secondary);
    margin-bottom: 0.2rem;
  }

  .event-preview .preview-label {
    font-weight: 600;
    min-width: 70px;
    color: var(--text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-top: 1px;
  }

  .token-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
  .token-badge.verified  { background: rgba(34,197,94,0.1); color: #15803d; }
  .token-badge.anonymous { background: rgba(148,163,184,0.15); color: var(--text-muted); }

  .char-count {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-align: right;
    margin-top: 0.25rem;
  }
  .char-count.warn { color: var(--warning-color); }
`;

// ─────────────────────────────────────────────
// <the-feed-ingest> Custom Element
// ─────────────────────────────────────────────

class TheFeedIngest extends HTMLElement {
  static get observedAttributes() {
    return ['api', 'token', 'location-hint', 'placeholder', 'theme', 'api-key'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._recognition = null;
    this._isRecording = false;
    this._apiKey = null;
  }

  connectedCallback() {
    this._apiKey = this.getAttribute('api-key') ?? null;
    this._render();
    this._initSpeech();
  }

  attributeChangedCallback(name, _, newVal) {
    if (name === 'api-key') { this._apiKey = newVal; return; }
    if (this.isConnected) this._render();
  }

  disconnectedCallback() {
    this._stopRecording();
  }

  // ── Rendering ──

  _render() {
    const placeholder = this.getAttribute('placeholder')
      ?? "Paste a venue email, show listing, or just describe the event in plain English...\n\nExamples:\n• 'The Trews are playing the Commodore this Friday at 8pm. Tix $35 at the door.'\n• 'Hey can you add our show? We're playing the Legion Hall on April 20th, doors at 7, $10 advance'";

    const hasToken = !!this.getAttribute('token');

    this._shadow.innerHTML = `
      <style>${INGEST_STYLES}</style>
      <div class="container">
        <div class="header">
          <h3>🎵 Add an Event to The Feed</h3>
          <p>Just describe the show. No forms. No account needed.</p>
        </div>

        ${hasToken
          ? `<div class="token-badge verified">✓ Verified source — events go live faster</div>`
          : `<div class="token-badge anonymous">○ Public submission — pending editorial review</div>`
        }

        <div class="input-wrapper">
          <textarea
            id="tf-text"
            placeholder="${this._escHtml(placeholder)}"
            maxlength="10000"
            spellcheck="true"
            autocorrect="on"
          ></textarea>
          <button class="voice-btn" id="tf-voice" title="Click to speak" aria-label="Voice input">
            ${this._iconMic()}
          </button>
        </div>
        <div class="char-count" id="tf-char">0 / 10,000</div>

        <button class="key-toggle" id="tf-key-toggle" type="button">
          🔑 OpenAI API key required — click to enter
        </button>
        <div class="key-input-row" id="tf-key-row">
          <input type="password" id="tf-api-key" placeholder="sk-..." autocomplete="off" spellcheck="false">
        </div>

        <button class="submit-btn" id="tf-submit" type="button">
          ${this._iconSend()} Submit to The Feed
        </button>

        <div class="status" id="tf-status"></div>
        <div class="event-preview" id="tf-preview"></div>
      </div>`;

    this._bindEvents();

    // Pre-fill API key if passed as attribute
    if (this._apiKey) {
      const keyInput = this._shadow.getElementById('tf-api-key');
      if (keyInput) keyInput.value = this._apiKey;
      const keyRow = this._shadow.getElementById('tf-key-row');
      const keyToggle = this._shadow.getElementById('tf-key-toggle');
      keyRow.classList.add('visible');
      keyToggle.textContent = '🔑 API key provided';
    }
  }

  _bindEvents() {
    const textarea  = this._shadow.getElementById('tf-text');
    const voiceBtn  = this._shadow.getElementById('tf-voice');
    const submitBtn = this._shadow.getElementById('tf-submit');
    const keyToggle = this._shadow.getElementById('tf-key-toggle');
    const keyRow    = this._shadow.getElementById('tf-key-row');
    const charCount = this._shadow.getElementById('tf-char');

    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len.toLocaleString()} / 10,000`;
      charCount.classList.toggle('warn', len > 8000);
    });

    keyToggle.addEventListener('click', () => {
      const visible = keyRow.classList.toggle('visible');
      keyToggle.textContent = visible ? '🔑 Hide API key' : '🔑 OpenAI API key required — click to enter';
    });

    voiceBtn.addEventListener('click', () => this._toggleRecording());
    submitBtn.addEventListener('click', () => this._submit());

    // Allow Ctrl+Enter to submit
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') this._submit();
    });
  }

  // ── Submission ──

  async _submit() {
    const textarea  = this._shadow.getElementById('tf-text');
    const keyInput  = this._shadow.getElementById('tf-api-key');
    const submitBtn = this._shadow.getElementById('tf-submit');
    const status    = this._shadow.getElementById('tf-status');
    const preview   = this._shadow.getElementById('tf-preview');

    const text   = textarea.value.trim();
    const apiKey = keyInput?.value?.trim() || this._apiKey;

    if (!text) {
      this._showStatus('error', 'Please enter some event details first.');
      return;
    }

    if (!apiKey || !apiKey.startsWith('sk-')) {
      this._showStatus('error', 'An OpenAI API key (sk-...) is required. Click the key icon above to enter it.');
      return;
    }

    // Loading state
    submitBtn.disabled = true;
    preview.classList.remove('visible');
    this._showStatus('loading', 'Extracting event details…');

    const api     = (this.getAttribute('api') ?? DEFAULT_INGEST_API).replace(/\/$/, '');
    const token   = this.getAttribute('token');
    const locHint = this.getAttribute('location-hint') ?? '';

    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${api}/ingest/raw`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          location_hint: locHint,
          source: token ? 'verified_source' : 'web_component',
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const msg = data.error ?? data.detail ?? `Server error (${res.status})`;
        this._showStatus('error', `❌ ${msg}`);
        this.dispatchEvent(new CustomEvent('the-feed:error', { detail: { error: msg }, bubbles: true }));
        return;
      }

      if (data.status === 'rejected') {
        this._showStatus('rejected', `🚫 Submission rejected: ${data.reason ?? 'Brand safety check failed.'}`);
        return;
      }

      if (data.status === 'no_events_found') {
        this._showStatus('error', `🤔 Couldn't extract event details. Try including a performer name, date, and venue.${data.extractionNotes ? ` Hint: ${data.extractionNotes}` : ''}`);
        return;
      }

      // Success
      const isPending = data.status === 'pending_review';
      this._showStatus(
        isPending ? 'review' : 'success',
        data.message ?? (isPending ? '📬 Submitted for review.' : '✅ Event added to The Feed!')
      );

      if (data.event) {
        this._showEventPreview(data.event);
      }

      // Clear the textarea on success
      textarea.value = '';
      this._shadow.getElementById('tf-char').textContent = '0 / 10,000';

      this.dispatchEvent(new CustomEvent('the-feed:submitted', {
        detail: { status: data.status, event: data.event, id: data.id, message: data.message },
        bubbles: true,
      }));

    } catch (err) {
      this._showStatus('error', `❌ Network error: ${err.message}`);
      this.dispatchEvent(new CustomEvent('the-feed:error', { detail: { error: err.message }, bubbles: true }));
    } finally {
      submitBtn.disabled = false;
    }
  }

  // ── Status display ──

  _showStatus(type, message) {
    const el = this._shadow.getElementById('tf-status');
    el.className = `status visible ${type}`;
    el.innerHTML = type === 'loading'
      ? `<div class="spinner"></div><span>${message}</span>`
      : message;
  }

  _showEventPreview(evt) {
    const preview = this._shadow.getElementById('tf-preview');
    const performers = Array.isArray(evt.performer) ? evt.performer : [evt.performer].filter(Boolean);
    const offers = Array.isArray(evt.offers) ? evt.offers : [evt.offers].filter(Boolean);
    const price = offers[0]?.price != null ? `$${offers[0].price} ${offers[0].priceCurrency ?? 'CAD'}` : 'TBA';
    const date = evt.startDate ? new Date(evt.startDate).toLocaleString('en-CA', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : 'TBA';

    preview.className = 'event-preview visible';
    preview.innerHTML = `
      <div class="preview-title">${this._escHtml(evt.name ?? 'Untitled Event')}</div>
      <div class="preview-row"><span class="preview-label">Date</span><span>${this._escHtml(date)}</span></div>
      <div class="preview-row"><span class="preview-label">Venue</span><span>${this._escHtml(evt.location?.name ?? 'TBA')}${evt.location?.address?.addressLocality ? `, ${this._escHtml(evt.location.address.addressLocality)}` : ''}</span></div>
      ${performers.length ? `<div class="preview-row"><span class="preview-label">Artists</span><span>${performers.map((p) => this._escHtml(p.name)).join(', ')}</span></div>` : ''}
      <div class="preview-row"><span class="preview-label">Tickets</span><span>${this._escHtml(price)}</span></div>
      <div class="preview-row"><span class="preview-label">Token ID</span><span style="font-family:monospace; font-size:0.75rem;">${this._escHtml(evt['@id']?.substring(0, 24))}…</span></div>
    `;
  }

  // ── Voice Input ──

  _initSpeech() {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const voiceBtn = this._shadow.getElementById('tf-voice');

    if (!SpeechRecognition) {
      voiceBtn?.classList.add('unsupported');
      voiceBtn?.setAttribute('title', 'Voice input not supported in this browser');
      return;
    }

    this._recognition = new SpeechRecognition();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.lang = 'en-CA';

    let finalTranscript = '';

    this._recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim = transcript;
        }
      }

      const textarea = this._shadow.getElementById('tf-text');
      if (textarea) {
        textarea.value = finalTranscript + interim;
        const len = textarea.value.length;
        const charCount = this._shadow.getElementById('tf-char');
        if (charCount) charCount.textContent = `${len.toLocaleString()} / 10,000`;
      }
    };

    this._recognition.onend = () => {
      if (this._isRecording) {
        // Auto-restart if still in recording mode (handles pauses)
        this._recognition.start();
      }
    };

    this._recognition.onerror = (event) => {
      console.warn('[TheFeedIngest] Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        this._showStatus('error', '🎤 Microphone access denied. Please allow microphone access in your browser settings.');
      }
      this._stopRecording();
    };
  }

  _toggleRecording() {
    if (!this._recognition) return;
    this._isRecording ? this._stopRecording() : this._startRecording();
  }

  _startRecording() {
    const textarea = this._shadow.getElementById('tf-text');
    const voiceBtn = this._shadow.getElementById('tf-voice');

    this._isRecording = true;
    textarea?.classList.add('recording');
    voiceBtn?.classList.add('active');
    voiceBtn?.setAttribute('title', 'Recording… click to stop');
    voiceBtn?.setAttribute('aria-label', 'Stop recording');

    try {
      this._recognition.start();
    } catch (e) {
      // Already started
    }

    this._showStatus('loading', '🎤 Listening… speak your event details. Click the mic to stop.');
  }

  _stopRecording() {
    if (!this._recognition) return;
    const textarea = this._shadow.getElementById('tf-text');
    const voiceBtn = this._shadow.getElementById('tf-voice');
    const status   = this._shadow.getElementById('tf-status');

    this._isRecording = false;
    textarea?.classList.remove('recording');
    voiceBtn?.classList.remove('active');
    voiceBtn?.setAttribute('title', 'Click to speak');
    voiceBtn?.setAttribute('aria-label', 'Voice input');

    try {
      this._recognition.stop();
    } catch (e) {
      // Already stopped
    }

    if (status?.classList.contains('loading')) {
      status.className = 'status';
    }
  }

  // ── Utilities ──

  _escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _iconMic() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>`;
  }

  _iconSend() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>`;
  }
}

if (!customElements.get('the-feed-ingest')) {
  customElements.define('the-feed-ingest', TheFeedIngest);
}

export { TheFeedIngest };
