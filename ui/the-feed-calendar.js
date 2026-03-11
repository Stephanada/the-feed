/**
 * THE FEED — <the-feed-calendar> Web Component  v1.0
 * ══════════════════════════════════════════════════════════════
 * Embeddable event calendar with 4 user-togglable views:
 *   mosaic  — card grid  (default)
 *   list    — chronological list
 *   week    — 7-column week grid
 *   month   — full calendar month grid
 *
 * Shares the exact same skin system as <the-feed-ingest>.
 *
 * ── USAGE ────────────────────────────────────────────────────
 *
 *   <the-feed-calendar
 *     api="https://the-feed-api.stephan-99b.workers.dev"
 *     token="your-source-token"
 *     skin="broadcast"
 *     mode="dark"
 *     view="mosaic"
 *     views="mosaic,list,week,month"
 *   ></the-feed-calendar>
 *
 * ── ATTRIBUTES ───────────────────────────────────────────────
 *
 *   api        API worker base URL
 *   token      Source token — scopes results to that token's events
 *   group      Target group filter (hub routing)
 *   venue      Filter by location.name (partial match)
 *   performer  Filter by performer name (partial match)
 *   genre      Genre filter
 *   from       ISO date string — show events on/after this date
 *   to         ISO date string — show events on/before this date
 *   limit      Max events to fetch (default 200)
 *   skin       "default" | "broadcast" | "poster" | https://…skin.json
 *   mode       "light" | "dark" | "auto"
 *   view       Initial view: "mosaic" | "list" | "week" | "month"
 *   views      Comma-separated list of which view toggles to show
 *              Default: "mosaic,list,week,month"
 *   locale     BCP-47 locale for date formatting (default: "en")
 *
 * ── CSS CUSTOM PROPERTIES ────────────────────────────────────
 *   Same --tfi-* properties as <the-feed-ingest> — fully compatible.
 *
 * ── EVENTS ───────────────────────────────────────────────────
 *   the-feed:event-click   { detail: { event } }
 */

// ─────────────────────────────────────────────
// Skin system (identical to the-feed-ingest.js)
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
// View icons (inline SVG strings)
// ─────────────────────────────────────────────

const ICONS = {
  mosaic: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="1" width="6" height="6" rx="1.5"/>
    <rect x="9" y="1" width="6" height="6" rx="1.5"/>
    <rect x="1" y="9" width="6" height="6" rx="1.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1.5"/>
  </svg>`,
  list: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="14" height="2.5" rx="1.25"/>
    <rect x="1" y="6.75" width="14" height="2.5" rx="1.25"/>
    <rect x="1" y="11.5" width="14" height="2.5" rx="1.25"/>
  </svg>`,
  week: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="1" width="2" height="14" rx="1"/>
    <rect x="4" y="1" width="2" height="10" rx="1"/>
    <rect x="7" y="1" width="2" height="14" rx="1"/>
    <rect x="10" y="1" width="2" height="8" rx="1"/>
    <rect x="13" y="1" width="2" height="12" rx="1"/>
  </svg>`,
  month: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="1" width="14" height="2" rx="1"/>
    <rect x="1" y="4.5" width="2" height="2" rx="0.75"/><rect x="4.5" y="4.5" width="2" height="2" rx="0.75"/><rect x="8" y="4.5" width="2" height="2" rx="0.75"/><rect x="11.5" y="4.5" width="2" height="2" rx="0.75"/>
    <rect x="1" y="8" width="2" height="2" rx="0.75"/><rect x="4.5" y="8" width="2" height="2" rx="0.75"/><rect x="8" y="8" width="2" height="2" rx="0.75"/><rect x="11.5" y="8" width="2" height="2" rx="0.75"/>
    <rect x="1" y="11.5" width="2" height="2" rx="0.75"/><rect x="4.5" y="11.5" width="2" height="2" rx="0.75"/><rect x="8" y="11.5" width="2" height="2" rx="0.75"/>
  </svg>`,
  prev: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 2 4 7 9 12"/></svg>`,
  next: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 2 10 7 5 12"/></svg>`,
  ticket: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>`,
};

// ─────────────────────────────────────────────
// Component styles
// ─────────────────────────────────────────────

const STYLES = /* css */`
  :host {
    display: block;
    font-family: var(--tfi-font-family, sans-serif);
    font-size: var(--tfi-font-size, 15px);
    color: var(--tfi-text-primary, #111);
    background: var(--tfi-background, #fff);
    border-radius: var(--tfi-radius-card, 12px);
    box-shadow: var(--tfi-shadow-card, none);
    overflow: hidden;
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Toolbar ──────────────────────────────── */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--tfi-border);
    background: var(--tfi-surface);
    flex-wrap: wrap;
  }
  .toolbar-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .toolbar-title {
    font-size: 0.9rem;
    font-weight: var(--tfi-font-bold, 700);
    min-width: 140px;
    text-align: center;
  }
  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--tfi-border);
    border-radius: var(--tfi-radius-btn);
    background: var(--tfi-background);
    color: var(--tfi-text-secondary);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .nav-btn:hover { background: var(--tfi-surface); color: var(--tfi-accent); }
  .today-btn {
    font-size: 0.72rem;
    font-weight: var(--tfi-font-bold, 700);
    font-family: var(--tfi-font-family);
    padding: 5px 10px;
    border: 1px solid var(--tfi-border);
    border-radius: var(--tfi-radius-btn);
    background: var(--tfi-background);
    color: var(--tfi-text-secondary);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .today-btn:hover { background: var(--tfi-surface); color: var(--tfi-accent); }

  .view-switcher {
    display: flex;
    gap: 2px;
    background: var(--tfi-background);
    border: 1px solid var(--tfi-border);
    border-radius: var(--tfi-radius-btn);
    padding: 2px;
  }
  .view-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 10px;
    border: none;
    border-radius: calc(var(--tfi-radius-btn) - 2px);
    background: none;
    color: var(--tfi-text-muted);
    font-size: 0.72rem;
    font-weight: var(--tfi-font-bold, 700);
    font-family: var(--tfi-font-family);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .view-btn svg { flex-shrink: 0; }
  .view-btn:hover { color: var(--tfi-text-primary); }
  .view-btn.active {
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
  }

  /* ── Loading / empty ──────────────────────── */
  .state-wrap {
    padding: 3rem 1.5rem;
    text-align: center;
    color: var(--tfi-text-muted);
    font-size: 0.875rem;
  }
  .spinner {
    display: inline-block;
    width: 20px; height: 20px;
    border: 2px solid var(--tfi-border);
    border-top-color: var(--tfi-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-bottom: 0.75rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Event card (shared) ──────────────────── */
  .event-card {
    background: var(--tfi-surface);
    border: 1px solid var(--tfi-border);
    border-radius: var(--tfi-radius-card);
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
  }
  .event-card:hover {
    transform: translateY(-2px);
    border-color: var(--tfi-accent);
    box-shadow: var(--tfi-shadow-card);
  }
  .card-date-bar {
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    padding: 0.4rem 0.75rem;
    font-size: 0.7rem;
    font-weight: var(--tfi-font-bold, 700);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .card-body {
    padding: 0.875rem 0.875rem 0.75rem;
  }
  .card-name {
    font-size: 0.9375rem;
    font-weight: var(--tfi-font-bold, 700);
    line-height: 1.3;
    margin-bottom: 0.3rem;
    color: var(--tfi-text-primary);
  }
  .card-venue {
    font-size: 0.8rem;
    color: var(--tfi-text-secondary);
    margin-bottom: 0.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .card-performer {
    font-size: 0.75rem;
    color: var(--tfi-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }
  .card-ticket {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: var(--tfi-font-bold, 700);
    padding: 4px 10px;
    border-radius: var(--tfi-radius-btn);
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    text-decoration: none;
    transition: opacity 0.12s;
    flex-shrink: 0;
  }
  .card-ticket:hover { opacity: 0.82; }

  /* ── Mosaic view ──────────────────────────── */
  .view-mosaic {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.875rem;
    padding: 1rem;
  }

  /* ── List view ────────────────────────────── */
  .view-list {
    display: flex;
    flex-direction: column;
  }
  .list-day-group {}
  .list-day-header {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--tfi-surface);
    border-bottom: 1px solid var(--tfi-border);
    padding: 0.4rem 1rem;
    font-size: 0.72rem;
    font-weight: var(--tfi-font-bold, 700);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tfi-accent);
  }
  .list-items {
    display: flex;
    flex-direction: column;
  }
  .list-item {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--tfi-border);
    cursor: pointer;
    transition: background 0.1s;
  }
  .list-item:hover { background: var(--tfi-surface); }
  .list-item:last-child { border-bottom: none; }
  .list-time {
    font-size: 0.78rem;
    font-weight: var(--tfi-font-bold, 700);
    color: var(--tfi-accent);
    text-align: center;
    line-height: 1.25;
  }
  .list-time-sub {
    font-size: 0.65rem;
    color: var(--tfi-text-muted);
    font-weight: normal;
  }
  .list-name {
    font-size: 0.9rem;
    font-weight: var(--tfi-font-bold, 700);
    color: var(--tfi-text-primary);
    line-height: 1.3;
    margin-bottom: 0.15rem;
  }
  .list-venue {
    font-size: 0.78rem;
    color: var(--tfi-text-secondary);
  }
  .list-ticket {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    font-weight: var(--tfi-font-bold, 700);
    padding: 4px 10px;
    border-radius: var(--tfi-radius-btn);
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.12s;
  }
  .list-ticket:hover { opacity: 0.82; }

  /* ── Week view ────────────────────────────── */
  .view-week {
    display: flex;
    flex-direction: column;
    min-height: 400px;
  }
  .week-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--tfi-border);
    background: var(--tfi-surface);
  }
  .week-col-head {
    padding: 0.5rem 0.4rem;
    text-align: center;
    font-size: 0.72rem;
    font-weight: var(--tfi-font-bold, 700);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--tfi-text-muted);
    border-right: 1px solid var(--tfi-border);
  }
  .week-col-head:last-child { border-right: none; }
  .week-col-head.is-today { color: var(--tfi-accent); }
  .week-col-num {
    display: block;
    font-size: 1.1rem;
    font-weight: var(--tfi-font-bold, 700);
    color: var(--tfi-text-primary);
    margin-top: 2px;
  }
  .week-col-head.is-today .week-col-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    border-radius: 50%;
    margin: 2px auto 0;
  }
  .week-body {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    flex: 1;
    align-items: start;
  }
  .week-day-col {
    border-right: 1px solid var(--tfi-border);
    min-height: 280px;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .week-day-col:last-child { border-right: none; }
  .week-event-chip {
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    border-radius: calc(var(--tfi-radius-card) / 2);
    padding: 0.25rem 0.4rem;
    font-size: 0.68rem;
    font-weight: var(--tfi-font-bold, 700);
    line-height: 1.3;
    cursor: pointer;
    transition: opacity 0.1s, transform 0.1s;
    overflow: hidden;
    word-break: break-word;
  }
  .week-event-chip:hover { opacity: 0.85; transform: scale(1.02); }
  .week-event-time {
    display: block;
    opacity: 0.75;
    font-weight: normal;
    font-size: 0.62rem;
    margin-bottom: 1px;
  }
  .week-overflow {
    font-size: 0.65rem;
    color: var(--tfi-text-muted);
    padding: 0.2rem 0.4rem;
    cursor: pointer;
    text-align: center;
  }
  .week-overflow:hover { color: var(--tfi-accent); }

  /* ── Month view ───────────────────────────── */
  .view-month {
    display: flex;
    flex-direction: column;
  }
  .month-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--tfi-border);
    background: var(--tfi-surface);
  }
  .month-dow {
    padding: 0.5rem 0;
    text-align: center;
    font-size: 0.68rem;
    font-weight: var(--tfi-font-bold, 700);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tfi-text-muted);
  }
  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }
  .month-cell {
    border-right: 1px solid var(--tfi-border);
    border-bottom: 1px solid var(--tfi-border);
    min-height: 90px;
    padding: 0.3rem;
    vertical-align: top;
  }
  .month-cell:nth-child(7n) { border-right: none; }
  .month-cell.other-month { opacity: 0.35; }
  .month-cell.is-today .month-day-num {
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    border-radius: 50%;
  }
  .month-day-num {
    font-size: 0.78rem;
    font-weight: var(--tfi-font-bold, 700);
    color: var(--tfi-text-secondary);
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
    flex-shrink: 0;
  }
  .month-event-pill {
    display: block;
    font-size: 0.65rem;
    font-weight: var(--tfi-font-bold, 700);
    color: var(--tfi-accent-text);
    background: var(--tfi-accent);
    border-radius: 3px;
    padding: 2px 5px;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: opacity 0.1s;
    line-height: 1.4;
  }
  .month-event-pill:hover { opacity: 0.8; }
  .month-more {
    font-size: 0.62rem;
    color: var(--tfi-text-muted);
    cursor: pointer;
    padding: 1px 3px;
  }
  .month-more:hover { color: var(--tfi-accent); }

  /* ── Detail drawer ────────────────────────── */
  .detail-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 1rem;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } }
  .detail-sheet {
    background: var(--tfi-background);
    border: 1px solid var(--tfi-border);
    border-radius: var(--tfi-radius-card);
    max-width: 520px;
    width: 100%;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.4);
    animation: slideUp 0.2s ease;
    max-height: 90vh;
    overflow-y: auto;
  }
  @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } }
  .detail-header {
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    padding: 1rem 1.25rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .detail-title {
    font-size: 1.1rem;
    font-weight: var(--tfi-font-bold, 700);
    line-height: 1.3;
  }
  .detail-close {
    background: rgba(255,255,255,0.2);
    border: none;
    color: inherit;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.12s;
  }
  .detail-close:hover { background: rgba(255,255,255,0.35); }
  .detail-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }
  .detail-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .detail-row-icon {
    font-size: 1rem;
    line-height: 1.4;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }
  .detail-row-content {
    flex: 1;
  }
  .detail-row-label {
    font-size: 0.68rem;
    font-weight: var(--tfi-font-bold, 700);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tfi-text-muted);
    margin-bottom: 0.2rem;
  }
  .detail-row-value {
    font-size: 0.9rem;
    color: var(--tfi-text-primary);
  }
  .detail-actions {
    display: flex;
    gap: 0.625rem;
    flex-wrap: wrap;
    padding: 0 1.25rem 1.25rem;
  }
  .detail-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: var(--tfi-accent);
    color: var(--tfi-accent-text);
    border-radius: var(--tfi-radius-btn);
    font-size: 0.875rem;
    font-weight: var(--tfi-font-bold, 700);
    font-family: var(--tfi-font-family);
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.12s;
    border: none;
  }
  .detail-btn-primary:hover { opacity: 0.85; }
  .detail-btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: none;
    border: 1px solid var(--tfi-border);
    color: var(--tfi-text-secondary);
    border-radius: var(--tfi-radius-btn);
    font-size: 0.875rem;
    font-weight: var(--tfi-font-bold, 700);
    font-family: var(--tfi-font-family);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .detail-btn-ghost:hover { background: var(--tfi-surface); color: var(--tfi-text-primary); }
  .trust-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    font-weight: var(--tfi-font-bold, 700);
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(34,197,94,0.12);
    color: var(--tfi-success);
    letter-spacing: 0.04em;
  }
`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const DEFAULT_API = 'https://the-feed-api.stephan-99b.workers.dev';
const DOW_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW_FULL    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth() &&
         a.getDate()     === b.getDate();
}

function fmtTime(dateStr, locale = 'en') {
  try {
    return new Date(dateStr).toLocaleTimeString(locale, { hour:'numeric', minute:'2-digit' });
  } catch { return ''; }
}

function fmtDate(dateStr, locale = 'en') {
  try {
    return new Date(dateStr).toLocaleDateString(locale, { weekday:'short', month:'short', day:'numeric' });
  } catch { return dateStr; }
}

function fmtDateFull(dateStr, locale = 'en') {
  try {
    return new Date(dateStr).toLocaleDateString(locale, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  } catch { return dateStr; }
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getPerformers(evt) {
  if (!evt.performer) return '';
  const arr = Array.isArray(evt.performer) ? evt.performer : [evt.performer];
  return arr.map(p => p.name ?? p).filter(Boolean).join(', ');
}

function getVenue(evt) {
  if (!evt.location) return '';
  if (typeof evt.location === 'string') return evt.location;
  return evt.location.name ?? '';
}

function getTicketUrl(evt) {
  if (!evt.offers) return null;
  const offers = Array.isArray(evt.offers) ? evt.offers : [evt.offers];
  return offers.find(o => o.url)?.url ?? null;
}

function getPrice(evt) {
  if (!evt.offers) return null;
  const offers = Array.isArray(evt.offers) ? evt.offers : [evt.offers];
  const o = offers[0];
  if (!o || o.price == null) return null;
  return o.priceCurrency ? `${o.priceCurrency} ${o.price}` : `$${o.price}`;
}

// ─────────────────────────────────────────────
// Web Component
// ─────────────────────────────────────────────

class TheFeedCalendar extends HTMLElement {
  static get observedAttributes() {
    return ['api','token','group','venue','performer','genre','from','to','limit',
            'skin','mode','view','views','locale'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._events    = [];        // all fetched events
    this._loading   = true;
    this._error     = null;
    this._view      = 'mosaic';  // current view
    this._cursor    = new Date();// week/month navigation cursor
    this._skinDef   = SKINS.default;
    this._resolvedMode = 'light';
    this._detail    = null;      // currently open event for detail sheet
    this._osQuery   = window.matchMedia('(prefers-color-scheme: dark)');
    this._osListener = () => this._applyMode();
  }

  connectedCallback() {
    this._view = this.getAttribute('view') || 'mosaic';
    this._osQuery.addEventListener('change', this._osListener);
    this._loadSkin().then(() => {
      this._render();
      this._fetchEvents();
    });
  }

  disconnectedCallback() {
    this._osQuery.removeEventListener('change', this._osListener);
  }

  attributeChangedCallback(name) {
    if (['skin','mode'].includes(name)) {
      this._loadSkin().then(() => this._render());
    } else if (name === 'view') {
      this._view = this.getAttribute('view') || 'mosaic';
      this._renderContent();
    } else if (['api','token','group','venue','performer','genre','from','to','limit'].includes(name)) {
      this._fetchEvents();
    } else {
      this._renderContent();
    }
  }

  // ── Skin loading ──────────────────────────────

  async _loadSkin() {
    const skinAttr = this.getAttribute('skin') || 'default';
    if (SKINS[skinAttr]) {
      this._skinDef = SKINS[skinAttr];
    } else if (skinAttr.startsWith('http')) {
      try {
        const data = await fetch(skinAttr).then(r => r.json());
        this._skinDef = data;
      } catch {
        this._skinDef = SKINS.default;
      }
    } else {
      this._skinDef = SKINS.default;
    }
    this._applyMode();
  }

  _applyMode() {
    const modeAttr = this.getAttribute('mode') || 'auto';
    if (modeAttr === 'auto') {
      this._resolvedMode = this._osQuery.matches ? 'dark' : 'light';
    } else {
      this._resolvedMode = modeAttr === 'dark' ? 'dark' : 'light';
    }
  }

  // ── Data fetching ─────────────────────────────

  async _fetchEvents() {
    this._loading = true;
    this._error   = null;
    this._renderContent();

    const api    = this.getAttribute('api')       || DEFAULT_API;
    const token  = this.getAttribute('token')     || '';
    const group  = this.getAttribute('group')     || '';
    const genre  = this.getAttribute('genre')     || '';
    const from   = this.getAttribute('from')      || '';
    const to     = this.getAttribute('to')        || '';
    const limit  = this.getAttribute('limit')     || '200';

    const params = new URLSearchParams({ limit, past: 'false' });
    if (token)  params.set('token',  token);
    if (group)  params.set('group',  group);
    if (genre)  params.set('genre',  genre);
    if (from)   params.set('after',  from);
    if (to)     params.set('before', to);

    // venue/performer are client-side filtered (no API param yet)

    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${api}/api/events?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      let events = Array.isArray(body) ? body
        : (body.itemListElement ?? []).map(i => i.item ?? i);

      // Client-side venue/performer filters
      const venueFilter = (this.getAttribute('venue') || '').toLowerCase();
      const perfFilter  = (this.getAttribute('performer') || '').toLowerCase();
      if (venueFilter) events = events.filter(e => getVenue(e).toLowerCase().includes(venueFilter));
      if (perfFilter)  events = events.filter(e => getPerformers(e).toLowerCase().includes(perfFilter));

      this._events  = events;
      this._loading = false;
    } catch (err) {
      this._error   = err.message;
      this._loading = false;
    }
    this._renderContent();
  }

  // ── Full initial render (sets up shadow DOM shell) ──

  _render() {
    const vars = skinToVars(this._skinDef, this._resolvedMode);
    this.shadowRoot.innerHTML = `
      <style>
        :host { ${vars} }
        ${STYLES}
      </style>
      <div class="toolbar" part="toolbar"></div>
      <div class="content" part="content"></div>
    `;
    this._bindToolbar();
    this._renderContent();
  }

  // ── Re-render just content + toolbar (no style recalc) ──

  _renderContent() {
    const toolbar = this.shadowRoot.querySelector('.toolbar');
    const content = this.shadowRoot.querySelector('.content');
    if (!toolbar || !content) return;
    toolbar.innerHTML = this._renderToolbar();
    this._bindToolbarButtons();

    if (this._loading) {
      content.innerHTML = `<div class="state-wrap"><div class="spinner"></div><br>Loading events…</div>`;
      return;
    }
    if (this._error) {
      content.innerHTML = `<div class="state-wrap">⚠️ Could not load events: ${esc(this._error)}</div>`;
      return;
    }
    if (!this._events.length) {
      content.innerHTML = `<div class="state-wrap">No upcoming events found.</div>`;
      return;
    }

    switch (this._view) {
      case 'list':   content.innerHTML = this._renderList();   break;
      case 'week':   content.innerHTML = this._renderWeek();   break;
      case 'month':  content.innerHTML = this._renderMonth();  break;
      default:       content.innerHTML = this._renderMosaic(); break;
    }

    this._bindEventInteractions();
  }

  // ── Toolbar ───────────────────────────────────

  _renderToolbar() {
    const viewsAttr = this.getAttribute('views') || 'mosaic,list,week,month';
    const allowedViews = viewsAttr.split(',').map(v => v.trim()).filter(Boolean);
    const viewLabels = { mosaic:'Mosaic', list:'List', week:'Week', month:'Month' };

    const needsNav = ['week','month'].includes(this._view);
    const titleStr = this._view === 'week'
      ? this._weekRangeLabel()
      : this._view === 'month'
        ? `${MONTH_NAMES[this._cursor.getMonth()]} ${this._cursor.getFullYear()}`
        : '';

    const navHtml = needsNav ? `
      <div class="toolbar-nav">
        <button class="nav-btn" data-action="prev" title="Previous">${ICONS.prev}</button>
        <span class="toolbar-title">${esc(titleStr)}</span>
        <button class="nav-btn" data-action="next" title="Next">${ICONS.next}</button>
        <button class="today-btn" data-action="today">Today</button>
      </div>` : `<div class="toolbar-nav"><span class="toolbar-title"></span></div>`;

    const switcherHtml = allowedViews.length > 1 ? `
      <div class="view-switcher">
        ${allowedViews.map(v => `
          <button class="view-btn${this._view === v ? ' active' : ''}" data-view="${v}" title="${viewLabels[v] ?? v}">
            ${ICONS[v] ?? ''} ${viewLabels[v] ?? v}
          </button>`).join('')}
      </div>` : '';

    return `${navHtml}${switcherHtml}`;
  }

  _bindToolbar() { /* delegated — handled in _bindToolbarButtons */ }

  _bindToolbarButtons() {
    this.shadowRoot.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._view = btn.dataset.view;
        this._renderContent();
      });
    });
    this.shadowRoot.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'today') {
          this._cursor = new Date();
        } else if (action === 'prev') {
          if (this._view === 'week')  this._cursor = new Date(this._cursor.getFullYear(), this._cursor.getMonth(), this._cursor.getDate() - 7);
          if (this._view === 'month') this._cursor = new Date(this._cursor.getFullYear(), this._cursor.getMonth() - 1, 1);
        } else if (action === 'next') {
          if (this._view === 'week')  this._cursor = new Date(this._cursor.getFullYear(), this._cursor.getMonth(), this._cursor.getDate() + 7);
          if (this._view === 'month') this._cursor = new Date(this._cursor.getFullYear(), this._cursor.getMonth() + 1, 1);
        }
        this._renderContent();
      });
    });
  }

  // ── Week range label ──────────────────────────

  _weekRangeLabel() {
    const start = this._weekStart(this._cursor);
    const end   = new Date(start); end.setDate(end.getDate() + 6);
    const locale = this.getAttribute('locale') || 'en';
    const fmt = d => d.toLocaleDateString(locale, { month:'short', day:'numeric' });
    return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`;
  }

  _weekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // Sunday
    d.setHours(0,0,0,0);
    return d;
  }

  // ── MOSAIC view ───────────────────────────────

  _renderMosaic() {
    const cards = this._events.map((evt, i) => this._cardHtml(evt, i)).join('');
    return `<div class="view-mosaic">${cards}</div>`;
  }

  _cardHtml(evt, i) {
    const locale  = this.getAttribute('locale') || 'en';
    const date    = new Date(evt.startDate);
    const dateStr = fmtDate(evt.startDate, locale);
    const timeStr = fmtTime(evt.startDate, locale);
    const venue   = esc(getVenue(evt));
    const name    = esc(evt.name ?? 'Untitled Event');
    const perfs   = esc(getPerformers(evt));
    const tickUrl = getTicketUrl(evt);
    const price   = getPrice(evt);
    const tickHtml = tickUrl
      ? `<a class="card-ticket" href="${esc(tickUrl)}" target="_blank" rel="noopener" data-stop>
           ${ICONS.ticket} ${price ?? 'Tickets'}
         </a>`
      : (price ? `<span class="card-performer">${esc(price)}</span>` : '');

    return `
      <div class="event-card" data-idx="${i}">
        <div class="card-date-bar">${esc(dateStr)} · ${esc(timeStr)}</div>
        <div class="card-body">
          <div class="card-name">${name}</div>
          ${venue ? `<div class="card-venue">📍 ${venue}</div>` : ''}
          <div class="card-footer">
            ${perfs ? `<span class="card-performer">🎤 ${perfs}</span>` : ''}
            ${tickHtml}
          </div>
        </div>
      </div>`;
  }

  // ── LIST view ─────────────────────────────────

  _renderList() {
    const locale = this.getAttribute('locale') || 'en';
    // Group by day
    const groups = {};
    this._events.forEach((evt, i) => {
      const d = ymd(new Date(evt.startDate));
      if (!groups[d]) groups[d] = [];
      groups[d].push({ evt, i });
    });

    return `<div class="view-list">${
      Object.entries(groups).map(([day, items]) => {
        const d       = new Date(day + 'T00:00:00');
        const today   = new Date(); today.setHours(0,0,0,0);
        const isToday = isSameDay(d, today);
        const label   = isToday
          ? 'Today'
          : d.toLocaleDateString(locale, { weekday:'long', month:'long', day:'numeric' });

        return `
          <div class="list-day-group">
            <div class="list-day-header">${esc(label)}</div>
            <div class="list-items">
              ${items.map(({ evt, i }) => {
                const timeStr = fmtTime(evt.startDate, locale);
                const dow     = new Date(evt.startDate).toLocaleDateString(locale, { weekday:'short' });
                const venue   = esc(getVenue(evt));
                const name    = esc(evt.name ?? 'Untitled Event');
                const tickUrl = getTicketUrl(evt);
                const price   = getPrice(evt);
                const tickHtml = tickUrl
                  ? `<a class="list-ticket" href="${esc(tickUrl)}" target="_blank" rel="noopener" data-stop>${ICONS.ticket} ${price ?? 'Tickets'}</a>`
                  : '';
                return `
                  <div class="list-item" data-idx="${i}">
                    <div class="list-time">${esc(timeStr)}<br><span class="list-time-sub">${esc(dow)}</span></div>
                    <div>
                      <div class="list-name">${name}</div>
                      ${venue ? `<div class="list-venue">📍 ${venue}</div>` : ''}
                    </div>
                    ${tickHtml}
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')
    }</div>`;
  }

  // ── WEEK view ─────────────────────────────────

  _renderWeek() {
    const locale  = this.getAttribute('locale') || 'en';
    const start   = this._weekStart(this._cursor);
    const today   = new Date(); today.setHours(0,0,0,0);
    const MAX_CHIPS = 4; // chips per column before "+N more"

    // Build 7-day columns
    const cols = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { date: d, events: [] };
    });

    this._events.forEach((evt, idx) => {
      const ed = new Date(evt.startDate);
      ed.setHours(0,0,0,0);
      const col = cols.find(c => isSameDay(c.date, ed));
      if (col) col.events.push({ evt, idx });
    });

    const headerHtml = cols.map(col => {
      const isToday = isSameDay(col.date, today);
      const dow = DOW_SHORT[col.date.getDay()];
      const num = col.date.getDate();
      return `<div class="week-col-head${isToday ? ' is-today' : ''}">
        ${esc(dow)}<span class="week-col-num">${num}</span>
      </div>`;
    }).join('');

    const bodyHtml = cols.map(col => {
      const visible = col.events.slice(0, MAX_CHIPS);
      const overflow = col.events.length - MAX_CHIPS;
      const chips = visible.map(({ evt, idx }) => {
        const time = fmtTime(evt.startDate, locale);
        const name = esc(evt.name ?? 'Event');
        return `<div class="week-event-chip" data-idx="${idx}">
          <span class="week-event-time">${esc(time)}</span>${name}
        </div>`;
      }).join('');
      const moreHtml = overflow > 0
        ? `<div class="week-overflow" data-idx="${col.events[MAX_CHIPS].idx}">+${overflow} more</div>`
        : '';
      return `<div class="week-day-col">${chips}${moreHtml}</div>`;
    }).join('');

    return `
      <div class="view-week">
        <div class="week-header">${headerHtml}</div>
        <div class="week-body">${bodyHtml}</div>
      </div>`;
  }

  // ── MONTH view ────────────────────────────────

  _renderMonth() {
    const locale  = this.getAttribute('locale') || 'en';
    const year    = this._cursor.getFullYear();
    const month   = this._cursor.getMonth();
    const today   = new Date(); today.setHours(0,0,0,0);
    const MAX_PILLS = 3;

    // First day of month, padded to Sunday
    const firstDay = new Date(year, month, 1);
    const startPad = firstDay.getDay();
    // Last day
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Total cells (always 6 rows × 7 = 42)
    const totalCells = 42;

    // Index events by ymd
    const evtByDay = {};
    this._events.forEach((evt, idx) => {
      const d = new Date(evt.startDate);
      // Only show events in this month (± padding days)
      const key = ymd(d);
      if (!evtByDay[key]) evtByDay[key] = [];
      evtByDay[key].push({ evt, idx });
    });

    const dowHeaders = DOW_SHORT.map(d => `<div class="month-dow">${d}</div>`).join('');

    const cells = Array.from({ length: totalCells }, (_, i) => {
      const offset = i - startPad;
      const d = new Date(year, month, 1 + offset);
      const isThisMonth = d.getMonth() === month;
      const isToday     = isSameDay(d, today);
      const key         = ymd(d);
      const dayEvts     = evtByDay[key] ?? [];
      const visible     = dayEvts.slice(0, MAX_PILLS);
      const overflow    = dayEvts.length - MAX_PILLS;

      const pills = visible.map(({ evt, idx }) => {
        const name = esc(evt.name ?? 'Event');
        return `<span class="month-event-pill" data-idx="${idx}">${name}</span>`;
      }).join('');

      const moreHtml = overflow > 0
        ? `<span class="month-more" data-idx="${dayEvts[MAX_PILLS].idx}">+${overflow} more</span>`
        : '';

      return `
        <div class="month-cell${isThisMonth ? '' : ' other-month'}${isToday ? ' is-today' : ''}">
          <span class="month-day-num">${d.getDate()}</span>
          ${pills}${moreHtml}
        </div>`;
    }).join('');

    return `
      <div class="view-month">
        <div class="month-header">${dowHeaders}</div>
        <div class="month-grid">${cells}</div>
      </div>`;
  }

  // ── Event interactions ────────────────────────

  _bindEventInteractions() {
    const root = this.shadowRoot;

    // Click on any [data-idx] element (except [data-stop] ticket links)
    root.querySelector('.content').addEventListener('click', e => {
      const stop = e.target.closest('[data-stop]');
      if (stop) return; // let ticket links through

      const target = e.target.closest('[data-idx]');
      if (!target) return;
      const idx = parseInt(target.dataset.idx, 10);
      const evt = this._events[idx];
      if (evt) this._openDetail(evt);
    });
  }

  // ── Detail sheet ──────────────────────────────

  _openDetail(evt) {
    this._detail = evt;
    const locale   = this.getAttribute('locale') || 'en';
    const name     = esc(evt.name ?? 'Untitled Event');
    const dateStr  = fmtDateFull(evt.startDate, locale);
    const timeStr  = fmtTime(evt.startDate, locale);
    const venue    = esc(getVenue(evt));
    const perfs    = esc(getPerformers(evt));
    const tickUrl  = getTicketUrl(evt);
    const price    = getPrice(evt);
    const trust    = evt._feed?.trustScore;
    const desc     = esc(evt.description ?? '');

    const overlay = document.createElement('div');
    overlay.className = 'detail-overlay';

    // Apply skin vars to the overlay (it lives in shadow DOM but we
    // inject it into the shadow root so vars inherit automatically)
    overlay.innerHTML = `
      <div class="detail-sheet" part="detail">
        <div class="detail-header">
          <span class="detail-title">${name}</span>
          <button class="detail-close" aria-label="Close">✕</button>
        </div>
        <div class="detail-body">
          <div class="detail-row">
            <span class="detail-row-icon">📅</span>
            <div class="detail-row-content">
              <div class="detail-row-label">Date &amp; Time</div>
              <div class="detail-row-value">${esc(dateStr)} · ${esc(timeStr)}</div>
            </div>
          </div>
          ${venue ? `
          <div class="detail-row">
            <span class="detail-row-icon">📍</span>
            <div class="detail-row-content">
              <div class="detail-row-label">Venue</div>
              <div class="detail-row-value">${venue}</div>
            </div>
          </div>` : ''}
          ${perfs ? `
          <div class="detail-row">
            <span class="detail-row-icon">🎤</span>
            <div class="detail-row-content">
              <div class="detail-row-label">Performers</div>
              <div class="detail-row-value">${perfs}</div>
            </div>
          </div>` : ''}
          ${price ? `
          <div class="detail-row">
            <span class="detail-row-icon">🎟</span>
            <div class="detail-row-content">
              <div class="detail-row-label">Price</div>
              <div class="detail-row-value">${esc(price)}</div>
            </div>
          </div>` : ''}
          ${desc ? `
          <div class="detail-row">
            <span class="detail-row-icon">💬</span>
            <div class="detail-row-content">
              <div class="detail-row-label">Description</div>
              <div class="detail-row-value">${desc}</div>
            </div>
          </div>` : ''}
          ${trust != null ? `
          <div class="detail-row">
            <span class="detail-row-icon">✅</span>
            <div class="detail-row-content">
              <div class="detail-row-label">Trust Score</div>
              <div class="detail-row-value"><span class="trust-badge">✓ Verified · ${trust}/100</span></div>
            </div>
          </div>` : ''}
        </div>
        <div class="detail-actions">
          ${tickUrl ? `<a class="detail-btn-primary" href="${esc(tickUrl)}" target="_blank" rel="noopener">${ICONS.ticket} Get Tickets</a>` : ''}
          <button class="detail-btn-ghost detail-close-btn">Close</button>
        </div>
      </div>`;

    // Close handlers
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.detail-close').addEventListener('click', close);
    overlay.querySelector('.detail-close-btn').addEventListener('click', close);

    this.shadowRoot.appendChild(overlay);

    // Dispatch event
    this.dispatchEvent(new CustomEvent('the-feed:event-click', {
      bubbles: true, composed: true, detail: { event: evt }
    }));
  }
}

customElements.define('the-feed-calendar', TheFeedCalendar);

export { TheFeedCalendar, SKINS, skinToVars };
