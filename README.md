# The Feed — Open Event Protocol

> **Submit a show once. Syndicate everywhere.**

The Feed is a headless, open event syndication protocol for performers, promoters, and venues. No platform lock-in. One structured submission, distributed across every site that subscribes to the feed.

**Live:** [the-feed-ui.pages.dev](https://the-feed-ui.pages.dev) · [the-feed-api.stephan-99b.workers.dev](https://the-feed-api.stephan-99b.workers.dev/api/health)  
**Repo:** Public — MIT License  
**Status:** Production (March 2026)

---

## Architecture at a Glance

```
                        ┌──────────────────────────┐
  Raw text / voice ───▶ │  <the-feed-ingest>        │  Web Component
                        │  POST /ingest/raw          │  ui/the-feed-ingest.js
                        └─────────────┬────────────┘
                                      │ Bearer token + text
                                      ▼
                        ┌──────────────────────────┐
                        │  the-feed-ingest (Worker) │  Cloudflare Edge
                        │  Eventizer (gpt-4o-mini)  │  workers/ingest/
                        │  Token trust scoring      │
                        └─────────────┬────────────┘
                                      │
                         ┌────────────┴──────────────┐
                         │ Trust-score routing        │
                    ≥90  │       ≥70         <70      │
                         ▼        ▼            ▼
                      direct   staging      PR to
                       prod    commit       staging
                         └────────────────────────────┘
                                      │
                        ┌─────────────▼────────────┐
                        │  GitHub Ledger (this repo)│  GitOps source of truth
                        │  ledger/events/           │
                        │  production/  staging/    │
                        └─────────────┬────────────┘
                                      │
                        ┌─────────────▼────────────┐
                        │  the-feed-api (Worker)    │  Cloudflare Edge
                        │  REST · ICS · RSS · XML   │  workers/api/
                        └─────────────┬────────────┘
                                      │
              ┌───────────────────────┼──────────────────────┐
              ▼                       ▼                       ▼
  <the-feed-calendar>       WordPress Plugin          iframe embed shim
   Web Component             [the_feed] shortcode      ui/embed.html
   ui/the-feed-calendar.js   wordpress-plugin/         (Weebly, Wix, etc.)
```

---

## Quick Start — Embed the Calendar

```html
<!-- Load the component (self-contained, no build step) -->
<script type="module"
  src="https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-calendar.js">
</script>

<!-- Drop the element -->
<the-feed-calendar skin="default" view="mosaic"></the-feed-calendar>
```

## Quick Start — Submit Widget

```html
<script type="module"
  src="https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-ingest.js">
</script>

<the-feed-ingest skin="broadcast"></the-feed-ingest>
```

## No-code / iframe Embed

Works on Weebly, Squarespace, Wix, Showit — any builder that accepts HTML blocks.

```html
<!-- Submit widget -->
<iframe src="https://the-feed-ui.pages.dev/embed.html?mode=ingest&skin=broadcast"
  width="100%" height="420" style="border:none;border-radius:12px;" loading="lazy">
</iframe>

<!-- Event calendar -->
<iframe src="https://the-feed-ui.pages.dev/embed.html?mode=calendar&skin=default&view=mosaic"
  width="100%" height="600" style="border:none;border-radius:12px;" loading="lazy">
</iframe>
```

---

## Repository Structure

```
the-feed/
├── ledger/
│   ├── schema.js                    # Zod schema + ID generation
│   ├── event.example.json           # Canonical data example
│   └── events/
│       ├── production/              # Live events (index.json + evt_*.json)
│       └── staging/                 # PRs pending editorial review
│
├── workers/
│   ├── api/                         # Edge API — REST, ICS, RSS, XML
│   │   ├── index.js
│   │   └── wrangler.toml
│   ├── nlp/                         # NLP Parser — gpt-4o-mini, BYOK
│   │   ├── index.js
│   │   └── wrangler.toml
│   └── ingest/                      # Ingest gateway — Eventizer pipeline
│       ├── index.js
│       ├── ingest.js
│       ├── token-registry.js
│       └── wrangler.toml
│
├── ui/
│   ├── the-feed-event.js            # <the-feed-event> display component
│   ├── the-feed-ingest.js           # <the-feed-ingest> submission component
│   ├── the-feed-calendar.js         # <the-feed-calendar> calendar component
│   ├── embed.html                   # Hosted iframe shim for no-code builders
│   ├── index.html                   # Public landing page (thefeed.site)
│   ├── feed-icon.svg                # Logomark / favicon
│   └── demo.html                    # Component demo
│
├── config/
│   └── rules.json                   # Hub & Spoke routing rules
│
├── github-actions/
│   └── .github/workflows/
│       ├── validate-and-merge.yml
│       ├── scraper-cron.yml
│       └── deploy.yml
│
├── scripts/
│   ├── validate-events.js
│   ├── rebuild-index.js
│   ├── aggregator.js
│   └── scraper-sources.json
│
├── wordpress-plugin/
│   ├── the-feed.php
│   └── admin/
│       ├── network-settings.php
│       ├── shortcode-builder.php
│       └── nlp-tool.php
│
└── docs/
    ├── ARCHITECTURE.md
    ├── DATA_STANDARD.md
    └── CONTRIBUTING.md
```

---

## API Reference

**Base URL:** `https://the-feed-api.stephan-99b.workers.dev`  
**CORS:** Open (`*`) — works from any origin.

### GET `/api/events`

| Parameter | Type | Description |
|---|---|---|
| `group` | string | Hub target group (`vista-radio-bc`) |
| `scope` | string | `local` \| `regional` \| `national` |
| `city` | string | City name (case-insensitive) |
| `region` | string | Province code (`BC`, `AB`, etc.) |
| `genre` | string | Genre filter |
| `venue` | string | Venue name filter |
| `performer` | string | Performer name filter |
| `limit` | number | Max results (default 100) |
| `offset` | number | Pagination offset |
| `after` | ISO date | Events starting after this date |
| `before` | ISO date | Events starting before this date |

### GET `/api/events/:id` — Single event
### GET `/api/feed.ics` — iCalendar
### GET `/api/feed.rss` — RSS 2.0
### GET `/api/feed.xml` — Atom/XML
### GET `/api/rules` — Hub routing rules
### GET `/api/health` — Health check
### POST `/api/events/submit` — Public structured submission (opens staging PR)

---

## Ingest API

**Base URL:** `https://the-feed-ingest.stephan-99b.workers.dev`

### POST `/ingest/raw`

```json
{
  "text": "The Trews are playing the Commodore this Friday at 8pm. Tix $35.",
  "location_hint": "Vancouver, BC"
}
```

**Headers:**
```
Authorization: Bearer <source-token>   (optional — raises trust level)
X-Api-Key: sk-...                      (OpenAI key — or use a token with DEFAULT_OPENAI_KEY)
```

**Response:**
```json
{
  "status": "committed" | "staged" | "pending_review" | "rejected",
  "id": "evt_abc123...",
  "message": "Human-readable status"
}
```

---

## Web Components

All three components are self-contained ES modules. No build step, no framework, Shadow DOM CSS isolation.

| Component | File | Description |
|---|---|---|
| `<the-feed-ingest>` | `ui/the-feed-ingest.js` | Natural language event submission |
| `<the-feed-calendar>` | `ui/the-feed-calendar.js` | Event calendar (mosaic/list/week/month views) |
| `<the-feed-event>` | `ui/the-feed-event.js` | Single event display card |

**CDN (via jsDelivr):**
```
https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-ingest.js
https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-calendar.js
https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-event.js
```

---

## Data Standard

All events are `schema.org/Event` JSON-LD with a deterministic `evt_` ID:

```
SHA-256( lowercase( performer_name | YYYY-MM-DD | venue_name ) )
→ evt_[64-char hex]
```

Same show submitted from 10 sources = 1 record, not 10 duplicates.

See [`docs/DATA_STANDARD.md`](docs/DATA_STANDARD.md) for the full schema.

---

## Identity & Trust

Source tokens set how much an ingest submission is trusted.

| Type | Trust Score | Routes to |
|---|---|---|
| `corporate_admin` | 95 | Direct → production |
| `verified_venue` | 80 | Direct → staging |
| `automated_scraper` | 45 | PR → staging |
| Public (no token) | 10 | PR → staging |

---

## WordPress

Install `wordpress-plugin/` at `wp-content/plugins/the-feed/`. Activate network-wide.

```
[the_feed group="vista-radio-kamloops" limit="10"]
[the_feed_event token="evt_abc123"]
[the_feed_ingest skin="broadcast"]
```

---

## Network Hubs

| Hub ID | Scope |
|---|---|
| `vista-radio-kamloops` | Local |
| `vista-radio-kelowna` | Local |
| `vista-radio-bc` | Regional |
| `vista-radio-national` | National |
| `madeincanada` | National |

Configure in `config/rules.json`.

---

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

---

## License

MIT
