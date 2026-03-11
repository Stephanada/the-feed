/**
 * THE FEED — "The Frame" Web Component
 * ══════════════════════════════════════════════════════════════
 * Custom Element: <the-feed-event>
 * Framework-agnostic. Works in any CMS, WordPress, Next.js,
 * plain HTML — anywhere a script tag can be dropped.
 *
 * USAGE:
 *   <!-- Single event card by token -->
 *   <the-feed-event token="evt_abc123..."></the-feed-event>
 *
 *   <!-- Event listing feed (filtered) -->
 *   <the-feed-event
 *     mode="list"
 *     group="vista-radio-kamloops"
 *     limit="10"
 *     api="https://your-worker.workers.dev"
 *   ></the-feed-event>
 *
 *   <!-- Themed via CSS Custom Properties on the host: -->
 *   <style>
 *     the-feed-event {
 *       --primary-color: #E3001B;
 *       --secondary-color: #1a1a2e;
 *       --font-family: 'Roboto', sans-serif;
 *       --card-radius: 12px;
 *       --card-shadow: 0 4px 24px rgba(0,0,0,0.12);
 *       --accent-color: #ff6b35;
 *     }
 *   </style>
 *
 * ATTRIBUTES:
 *   token     (string)  evt_ ID for single-event mode
 *   mode      (string)  "card" (default) | "list" | "minimal"
 *   group     (string)  Hub target group filter (list mode)
 *   city      (string)  City filter (list mode)
 *   region    (string)  Province filter (list mode)
 *   genre     (string)  Genre filter (list mode)
 *   limit     (number)  Max results in list mode (default 10)
 *   api       (string)  API base URL (defaults to prod worker)
 *   locale    (string)  BCP 47 locale for date formatting (default "en-CA")
 *   theme     (string)  "light" (default) | "dark"
 */

const DEFAULT_API = "https://the-feed-api.workers.dev";

// ─────────────────────────────────────────────
// Styles (encapsulated in Shadow DOM)
// ─────────────────────────────────────────────

const STYLES = /* css */ `
  :host {
    /* Default token values — overridable from host CMS */
    --primary-color: #1a1a2e;
    --secondary-color: #16213e;
    --accent-color: #e94560;
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-size-base: 15px;
    --card-bg: #ffffff;
    --card-bg-dark: #1e1e2e;
    --card-radius: 10px;
    --card-shadow: 0 2px 16px rgba(0, 0, 0, 0.10);
    --card-padding: 1.25rem;
    --card-border: 1px solid rgba(0,0,0,0.08);
    --text-primary: #111111;
    --text-secondary: #555555;
    --text-muted: #888888;
    --badge-bg: rgba(233,69,96,0.1);
    --badge-color: var(--accent-color);
    --ticket-btn-bg: var(--accent-color);
    --ticket-btn-color: #ffffff;
    --ticket-btn-radius: 6px;
    display: block;
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    color: var(--text-primary);
    box-sizing: border-box;
  }

  :host([theme="dark"]) {
    --card-bg: var(--card-bg-dark);
    --text-primary: #f0f0f0;
    --text-secondary: #aaaaaa;
    --card-border: 1px solid rgba(255,255,255,0.08);
  }

  *, *::before, *::after { box-sizing: inherit; }

  /* ── Loading state ── */
  .loader {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 1rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  .spinner {
    width: 18px; height: 18px;
    border: 2px solid var(--badge-bg);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Error state ── */
  .error {
    padding: 1rem;
    background: #fff5f5;
    border-left: 3px solid #ff4444;
    border-radius: var(--card-radius);
    color: #cc0000;
    font-size: 0.875rem;
  }

  /* ── Event Card (single / card mode) ── */
  .card {
    background: var(--card-bg);
    border-radius: var(--card-radius);
    box-shadow: var(--card-shadow);
    border: var(--card-border);
    overflow: hidden;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }
  .card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.15); transform: translateY(-2px); }

  .card-image {
    width: 100%; height: 200px;
    object-fit: cover; display: block;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  }
  .card-image-placeholder {
    width: 100%; height: 200px;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    display: flex; align-items: center; justify-content: center;
    font-size: 3rem;
  }

  .card-body { padding: var(--card-padding); }

  .card-date {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent-color);
    margin-bottom: 0.4rem;
  }

  .card-title {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .card-performer {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }

  .card-venue {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  .card-venue svg { flex-shrink: 0; margin-top: 2px; }

  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 1rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    background: var(--badge-bg);
    color: var(--badge-color);
    text-transform: capitalize;
  }
  .badge-age {
    background: rgba(26,26,46,0.08);
    color: var(--text-secondary);
  }
  .badge-genre {
    background: rgba(233,69,96,0.07);
    color: var(--accent-color);
  }

  .card-price {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .ticket-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.6rem 1.25rem;
    background: var(--ticket-btn-bg);
    color: var(--ticket-btn-color);
    border-radius: var(--ticket-btn-radius);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: opacity 0.15s;
    border: none;
    cursor: pointer;
  }
  .ticket-btn:hover { opacity: 0.85; }

  /* ── Minimal mode ── */
  .minimal {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--card-border);
  }
  .minimal:last-child { border-bottom: none; }
  .minimal-date {
    min-width: 52px;
    text-align: center;
    font-weight: 700;
    font-size: 0.8125rem;
    color: var(--accent-color);
    line-height: 1.2;
  }
  .minimal-date .month {
    display: block;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.8;
  }
  .minimal-info { flex: 1; min-width: 0; }
  .minimal-title {
    font-weight: 600;
    font-size: 0.9375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }
  .minimal-venue {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .minimal-price {
    font-weight: 700;
    font-size: 0.875rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  /* ── List mode ── */
  .list { display: flex; flex-direction: column; gap: 1rem; }

  /* ── Status badge ── */
  .status-cancelled { opacity: 0.6; }
  .status-cancelled .card-title { text-decoration: line-through; }
  .badge-cancelled { background: #fff0f0; color: #cc0000; }
  .badge-postponed { background: #fff8e1; color: #e65100; }
  .badge-rescheduled { background: #e3f2fd; color: #1565c0; }
`;

// ─────────────────────────────────────────────
// Web Component Class
// ─────────────────────────────────────────────

class TheFeedEvent extends HTMLElement {
  static get observedAttributes() {
    return ["token", "mode", "group", "city", "region", "genre", "limit", "api", "locale", "theme"];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._data = null;
    this._abortController = null;
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }

  disconnectedCallback() {
    this._abortController?.abort();
  }

  // ── Attribute accessors ──

  get _token() { return this.getAttribute("token"); }
  get _mode() { return this.getAttribute("mode") ?? "card"; }
  get _group() { return this.getAttribute("group"); }
  get _city() { return this.getAttribute("city"); }
  get _region() { return this.getAttribute("region"); }
  get _genre() { return this.getAttribute("genre"); }
  get _limit() { return parseInt(this.getAttribute("limit") ?? "10"); }
  get _api() { return (this.getAttribute("api") ?? DEFAULT_API).replace(/\/$/, ""); }
  get _locale() { return this.getAttribute("locale") ?? "en-CA"; }

  // ── Rendering ──

  async _render() {
    this._abortController?.abort();
    this._abortController = new AbortController();

    this._setHTML(this._loadingTemplate());

    try {
      if (this._mode === "list" || this._mode === "minimal") {
        const events = await this._fetchList();
        this._setHTML(this._listTemplate(events));
      } else {
        const event = await this._fetchSingle();
        this._setHTML(this._cardTemplate(event));
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      this._setHTML(this._errorTemplate(err.message));
    }
  }

  _setHTML(content) {
    this._shadow.innerHTML = `<style>${STYLES}</style>${content}`;
  }

  // ── Data fetching ──

  async _fetchSingle() {
    if (!this._token) throw new Error("A `token` attribute (evt_ ID) is required for card mode.");
    const url = `${this._api}/api/events/${this._token}`;
    const res = await fetch(url, { signal: this._abortController.signal });
    if (!res.ok) throw new Error(`Event not found (${res.status})`);
    return res.json();
  }

  async _fetchList() {
    const params = new URLSearchParams({ limit: this._limit });
    if (this._group) params.set("group", this._group);
    if (this._city) params.set("city", this._city);
    if (this._region) params.set("region", this._region);
    if (this._genre) params.set("genre", this._genre);

    const url = `${this._api}/api/events?${params}`;
    const res = await fetch(url, { signal: this._abortController.signal });
    if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
    const data = await res.json();
    return (data.itemListElement ?? []).map((item) => item.item);
  }

  // ── Templates ──

  _loadingTemplate() {
    return `<div class="loader"><div class="spinner"></div>Loading events…</div>`;
  }

  _errorTemplate(message) {
    return `<div class="error">⚠️ Could not load event: ${this._escHtml(message)}</div>`;
  }

  _cardTemplate(evt) {
    const performers = this._normalizeArray(evt.performer);
    const offers = this._normalizeArray(evt.offers);
    const genres = evt.genre ?? [];
    const ticketUrl = offers[0]?.url ?? evt.url ?? "";
    const price = offers[0]?.price != null ? `$${offers[0].price} ${offers[0].priceCurrency ?? "CAD"}` : null;
    const statusSlug = evt.eventStatus?.split("/").pop() ?? "EventScheduled";
    const statusClass = {
      EventCancelled: "badge-cancelled",
      EventPostponed: "badge-postponed",
      EventRescheduled: "badge-rescheduled",
    }[statusSlug] ?? "";

    const dateStr = this._formatDate(evt.startDate);
    const timeStr = this._formatTime(evt.startDate);

    return `
      <div class="card ${statusSlug === "EventCancelled" ? "status-cancelled" : ""}">
        ${evt.image
          ? `<img class="card-image" src="${this._escHtml(evt.image)}" alt="${this._escHtml(evt.name)}" loading="lazy">`
          : `<div class="card-image-placeholder">🎵</div>`
        }
        <div class="card-body">
          <div class="card-date">${dateStr}${timeStr ? ` · ${timeStr}` : ""}</div>
          <h3 class="card-title">${this._escHtml(evt.name)}</h3>
          ${performers.length ? `<div class="card-performer">🎤 ${performers.map((p) => this._escHtml(p.name)).join(" + ")}</div>` : ""}
          <div class="card-venue">
            ${this._iconPin()}
            <span>${this._escHtml(evt.location?.name)}${evt.location?.address?.addressLocality ? `, ${this._escHtml(evt.location.address.addressLocality)}` : ""}</span>
          </div>
          <div class="card-meta">
            ${statusSlug !== "EventScheduled" ? `<span class="badge ${statusClass}">${statusSlug.replace("Event", "")}</span>` : ""}
            ${evt.typicalAgeRange ? `<span class="badge badge-age">${this._escHtml(evt.typicalAgeRange)}</span>` : ""}
            ${genres.slice(0, 3).map((g) => `<span class="badge badge-genre">${this._escHtml(g)}</span>`).join("")}
          </div>
          ${price ? `<div class="card-price">${price}</div>` : ""}
          ${ticketUrl ? `<a class="ticket-btn" href="${this._escHtml(ticketUrl)}" target="_blank" rel="noopener noreferrer">${this._iconTicket()} Get Tickets</a>` : ""}
        </div>
      </div>`;
  }

  _listTemplate(events) {
    if (!events.length) {
      return `<div class="error" style="background:#f9f9f9;border-color:#ccc;color:#666;">No upcoming events found.</div>`;
    }

    if (this._mode === "minimal") {
      const items = events.map((evt) => this._minimalItem(evt)).join("");
      return `<div>${items}</div>`;
    }

    const cards = events.map((evt) => this._cardTemplate(evt)).join("");
    return `<div class="list">${cards}</div>`;
  }

  _minimalItem(evt) {
    const offers = this._normalizeArray(evt.offers);
    const price = offers[0]?.price != null
      ? `$${offers[0].price}`
      : offers.length === 0 ? "Free" : "TBA";
    const ticketUrl = offers[0]?.url ?? evt.url ?? "#";
    const d = new Date(evt.startDate);

    return `
      <a class="minimal" href="${this._escHtml(ticketUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
        <div class="minimal-date">
          <span class="month">${d.toLocaleString(this._locale, { month: "short" })}</span>
          ${d.getDate()}
        </div>
        <div class="minimal-info">
          <div class="minimal-title">${this._escHtml(evt.name)}</div>
          <div class="minimal-venue">${this._escHtml(evt.location?.name)}, ${this._escHtml(evt.location?.address?.addressLocality)}</div>
        </div>
        <div class="minimal-price">${price}</div>
      </a>`;
  }

  // ── Utility ──

  _normalizeArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  _formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(this._locale, {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  }

  _formatTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString(this._locale, {
      hour: "numeric", minute: "2-digit",
    });
  }

  _escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  _iconPin() {
    return `<svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 0C3.794 0 2 1.794 2 4c0 3 4 10 4 10s4-7 4-10c0-2.206-1.794-4-4-4zm0 5.5A1.5 1.5 0 1 1 6 2.5a1.5 1.5 0 0 1 0 3z" fill="currentColor" opacity=".6"/>
    </svg>`;
  }

  _iconTicket() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>
      <line x1="9" y1="2" x2="9" y2="22"/>
    </svg>`;
  }
}

// ─────────────────────────────────────────────
// Register the custom element
// ─────────────────────────────────────────────

if (!customElements.get("the-feed-event")) {
  customElements.define("the-feed-event", TheFeedEvent);
}

export { TheFeedEvent };
