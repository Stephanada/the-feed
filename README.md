# 🎵 The Feed — Open Event Protocol

> **Headless, decentralized, real-time event syndication for Canadian community media.**

The Feed is a GitOps-architected event data protocol serving as the canonical, real-time data source for local community culture. It aggregates and distributes event data across the Vista Radio network and MadeAndPlayedInCanada.com.

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                     THE FEED ECOSYSTEM                        │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│  LEDGER      │  EDGE API    │  NLP PARSER  │  WEB COMPONENT  │
│  (GitHub)    │  (CF Worker) │  (CF Worker) │  (Shadow DOM)   │
│              │              │              │                 │
│  .json files │  /api/events │  /nlp/parse  │  <the-feed-     │
│  JSON-LD     │  /api/feed   │  BYOK Header │   event>        │
│  schema.org  │  .ics .rss   │  gpt-4o-mini │  CSS Custom     │
│  SHA-256 IDs │  .xml        │  Brand Safe  │  Properties     │
├──────────────┴──────────────┴──────────────┴─────────────────┤
│                   GITHUB ACTIONS CI/CD                        │
│   validate-and-merge.yml  │  scraper-cron.yml  │  deploy.yml  │
├──────────────────────────────────────────────────────────────┤
│                   WORDPRESS ADAPTER                           │
│   Network Settings  │  Shortcode Builder  │  NLP Quick Parse │
└──────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
the-feed/
├── ledger/
│   ├── schema.js                    # Zod schema + ID generation
│   ├── event.example.json           # Canonical data example
│   └── events/
│       ├── production/              # Live events (served by CDN)
│       │   └── index.json           # Auto-rebuilt on merge
│       └── staging/                 # PRs pending editorial review
│
├── workers/
│   ├── api/                         # Edge API (Cloudflare Worker)
│   │   ├── index.js                 # Router, filters, syndication
│   │   └── wrangler.toml
│   └── nlp/                         # NLP Parser (Cloudflare Worker)
│       ├── index.js                 # gpt-4o-mini, BYOK, moderation
│       └── wrangler.toml
│
├── ui/
│   ├── the-feed-event.js            # <the-feed-event> Web Component
│   └── demo.html                    # Component demo page
│
├── config/
│   └── rules.json                   # Hub & Spoke routing rules
│
├── github-actions/
│   └── .github/workflows/
│       ├── validate-and-merge.yml   # Schema validation CI
│       ├── scraper-cron.yml         # Automated aggregator
│       └── deploy.yml               # Cloudflare deployment
│
├── scripts/
│   ├── validate-events.js           # CI validation script
│   ├── rebuild-index.js             # Ledger index rebuilder
│   ├── aggregator.js                # Scheduled scraper
│   └── scraper-sources.json         # Source configuration
│
├── wordpress-plugin/
│   ├── the-feed.php                 # Main plugin file
│   └── admin/
│       ├── network-settings.php     # Network admin UI
│       ├── shortcode-builder.php    # Visual shortcode builder
│       └── nlp-tool.php             # NLP quick-parse tool
│
└── docs/
    ├── ARCHITECTURE.md
    ├── DATA_STANDARD.md
    └── CONTRIBUTING.md
```

---

## Quick Start

### 1. Set up the Ledger Repository

```bash
# Create a new GitHub repo for the ledger
gh repo create the-feed-ledger --private
git push origin main

# Set GitHub Secrets
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set NLP_WORKER_URL
gh secret set OPENAI_KEY_DEFAULT
```

### 2. Deploy the Workers

```bash
npm install

# Set worker secrets
cd workers/api
wrangler secret put GITHUB_TOKEN

# Deploy
npm run deploy:api
npm run deploy:nlp
npm run deploy:pages
```

### 3. Install the WordPress Plugin

Upload the `wordpress-plugin/` directory to `wp-content/plugins/the-feed/` on your WordPress network. Activate network-wide and configure via **Network Admin → The Feed**.

### 4. Embed Events on Any Page

**Shortcode (WordPress):**
```
[the_feed group="vista-radio-kamloops" mode="list" limit="10"]
[the_feed_event token="evt_abc123"]
```

**Direct HTML (any CMS):**
```html
<script type="module" src="https://thefeed.pages.dev/ui/the-feed-event.js"></script>
<the-feed-event mode="list" group="vista-radio-kamloops" limit="10"
  api="https://the-feed-api.workers.dev"></the-feed-event>
```

---

## API Reference

### GET `/api/events`

| Parameter | Type   | Description                            |
|-----------|--------|----------------------------------------|
| `group`   | string | Hub target group (`vista-radio-bc`)    |
| `scope`   | string | `local` \| `regional` \| `national`   |
| `city`    | string | City name (case-insensitive)           |
| `region`  | string | Province code (`BC`, `AB`, etc.)       |
| `genre`   | string | Genre filter                           |
| `limit`   | number | Max results (default 100, max 500)     |
| `offset`  | number | Pagination offset                      |
| `after`   | ISO    | Events starting after this date        |
| `before`  | ISO    | Events starting before this date       |
| `past`    | bool   | Include past events (`true`/`false`)   |

### GET `/api/feed.ics` — iCalendar
### GET `/api/feed.rss` — RSS 2.0
### GET `/api/feed.xml` — XML
All accept the same filter parameters as `/api/events`.

### POST `/api/events/submit`
Submit a new event for editorial review. Creates a PR to the staging branch.

### POST `/nlp/parse`
```json
{
  "text": "The Trews live at the Commodore, April 15 at 8pm. Tickets $35 at Ticketweb.",
  "context": "Vancouver, BC, Canada"
}
```
Requires `X-Api-Key: sk-...` header (BYOK).

### POST `/nlp/parse-url`
```json
{ "url": "https://venue.com/events/show-name" }
```

---

## Data Standard

Every event is a JSON-LD document conforming to `schema.org/Event`.

**Deterministic ID:**
```
SHA-256(lowercase(performer + "|" + date + "|" + venue))
→ evt_[64-char hex]
```

**Required fields:** `name`, `startDate`, `location.name`, `location.address.addressLocality`, `location.address.addressCountry`

See [`docs/DATA_STANDARD.md`](docs/DATA_STANDARD.md) for the full specification.

---

## Network Hubs

| Hub ID | Site | Scope |
|--------|------|-------|
| `vista-radio-kamloops` | kamloopsnow.com | Local |
| `vista-radio-kelowna` | kelownanow.com | Local |
| `vista-radio-prince-george` | princegeorgenow.com | Local |
| `vista-radio-bc` | vistaradio.ca | Regional |
| `vista-radio-national` | vistaradio.ca | National |
| `madeincanada` | madeandplayedincanada.com | National |

Edit `config/rules.json` to add new hubs.

---

## Theming the Web Component

```css
the-feed-event {
  --primary-color: #c8102e;
  --accent-color: #c8102e;
  --font-family: 'Roboto', sans-serif;
  --card-radius: 8px;
  --card-shadow: 0 4px 20px rgba(0,0,0,0.12);
}
```

| Property | Default | Description |
|----------|---------|-------------|
| `--primary-color` | `#1a1a2e` | Brand primary colour |
| `--accent-color` | `#e94560` | CTA buttons, badges |
| `--font-family` | System font | Typography |
| `--card-radius` | `10px` | Card corner radius |
| `--card-shadow` | Subtle shadow | Card elevation |
| `--card-bg` | `#ffffff` | Card background |
| `--ticket-btn-bg` | `var(--accent-color)` | Ticket button colour |

---

## Contributing

See [`CONTRIBUTING.md`](docs/CONTRIBUTING.md).

---

## License

MIT © The Feed
