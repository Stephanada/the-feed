# THE FEED — Developer Handoff Document
**Generated:** March 11, 2026  
**Status:** ✅ Build Complete — All components delivered  
**Repository root:** `/Users/stephan/The Feed`

---

## 1. What This Is

**The Feed** is a headless, decentralized, GitOps-based event syndication protocol built for the Vista Radio network (50+ Canadian community radio/news sites) and MadeAndPlayedInCanada.com.

The core thesis: **stop filling out forms.** A musician, venue, or media partner describes their show in plain English (or speaks it), and The Feed's NLP pipeline extracts a fully structured, schema.org/Event-compliant JSON-LD record, stamps it with a deterministic SHA-256 ID, and routes it to production or a review queue based on the source's trust score — automatically.

---

## 2. Architecture Overview

```
                        ┌──────────────────────────┐
  Raw text / voice ───▶ │  <the-feed-ingest>        │  Web Component (ui/)
                        │  POST /ingest/raw          │
                        └─────────────┬────────────┘
                                      │ Bearer token + text
                                      ▼
                        ┌──────────────────────────┐
                        │  the-feed-ingest (Worker) │  Cloudflare Edge
                        │  workers/ingest/          │
                        │  • token-registry.js      │  KV → trust score
                        │  • ingest.js (Eventizer)  │  GPT-4o-mini → JSON-LD
                        └─────────────┬────────────┘
                                      │
                         ┌────────────┴──────────────┐
                         │ Trust score routing        │
                    ≥90  │       ≥70         <70      │
                         ▼        ▼            ▼      │
                      direct   staging         PR     │
                       prod    commit       to staging │
                         └────────────────────────────┘
                                      │
                        ┌─────────────▼────────────┐
                        │  GitHub Ledger            │  GitOps source of truth
                        │  ledger/events/           │
                        │  production/  staging/    │
                        └─────────────┬────────────┘
                                      │
                        ┌─────────────▼────────────┐
                        │  the-feed-api (Worker)    │  Cloudflare Edge
                        │  workers/api/             │
                        │  • 8 REST routes           │
                        │  • ICS / RSS / XML         │
                        │  • Hub & Spoke filtering   │
                        └─────────────┬────────────┘
                                      │
                    ┌─────────────────┴──────────────────┐
                    │                                      │
          ┌─────────▼────────┐               ┌────────────▼──────────┐
          │ <the-feed-event>  │               │  WordPress Plugin      │
          │  Web Component    │               │  [the_feed]            │
          │  ui/              │               │  [the_feed_event]      │
          └──────────────────┘               │  [the_feed_ingest]     │
                                             └────────────────────────┘
```

---

## 3. Complete File Inventory (48 files)

```
The Feed/
│
├── HANDOFF.md                          ← this file
├── README.md                           ← public-facing project overview
├── package.json                        ← monorepo scripts
├── .gitignore
│
├── config/
│   └── rules.json                      ← Hub & Spoke routing rules (6 hubs)
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   └── DATA_STANDARD.md
│
├── ledger/
│   ├── schema.js                       ← Zod schema + generateEventId() + validateAndStamp()
│   ├── event.example.json              ← canonical data example
│   └── events/
│       ├── production/
│       │   └── index.json              ← auto-rebuilt by rebuild-index.js on merge
│       └── staging/
│           └── .gitkeep
│
├── scripts/
│   ├── validate-events.js              ← CLI validator (used in CI)
│   ├── rebuild-index.js                ← rebuilds production/index.json
│   ├── aggregator.js                   ← scheduled scraper with BYOK per source
│   └── scraper-sources.json            ← scraper source list
│
├── workers/
│   ├── api/
│   │   ├── index.js                    ← Edge API (8 routes, ICS/RSS/XML)
│   │   └── wrangler.toml
│   │
│   ├── nlp/
│   │   ├── index.js                    ← NLP Parser (gpt-4o-mini, BYOK, brand safety)
│   │   └── wrangler.toml
│   │
│   ├── ingest/
│   │   ├── index.js                    ← /ingest/raw gateway router
│   │   ├── ingest.js                   ← Eventizer pipeline (NLP → stamp → route)
│   │   ├── token-registry.js           ← Source token system (KV + static fallback)
│   │   └── wrangler.toml
│   │
│   └── syndication/                    ← (reserved for future push syndication worker)
│
├── ui/
│   ├── the-feed-event.js               ← <the-feed-event> display component
│   ├── the-feed-ingest.js              ← <the-feed-ingest> voice/text submission component
│   └── demo.html
│
├── wordpress-plugin/
│   ├── the-feed.php                    ← main plugin file (multisite, shortcodes, AJAX)
│   └── admin/
│       ├── network-settings.php        ← Network Admin settings page
│       ├── shortcode-builder.php       ← Visual shortcode builder
│       └── nlp-tool.php                ← Admin NLP quick-parse tool
│
└── github-actions/
    └── .github/
        └── workflows/
            ├── validate-and-merge.yml  ← PR validation + index rebuild on merge
            ├── scraper-cron.yml        ← Every 6h cron scraper
            └── deploy.yml              ← Deploy API + NLP + Ingest workers + Pages
```

---

## 4. Worker Reference

### `the-feed-api` — `workers/api/`
**URL:** `https://the-feed-api.workers.dev` (configure in `wrangler.toml`)

| Route | Method | Description |
|---|---|---|
| `/api/events` | GET | List events. Params: `scope`, `group`, `city`, `region`, `genre`, `limit`, `offset`, `after`, `before`, `past` |
| `/api/events/:id` | GET | Single event by `evt_` ID |
| `/api/events/ics` | GET | iCal feed |
| `/api/events/rss` | GET | RSS 2.0 feed |
| `/api/events/xml` | GET | XML feed |
| `/api/submit` | POST | Public JSON-LD submission (opens staging PR) |
| `/api/health` | GET | Health check |

**Secrets required:** `GITHUB_TOKEN`  
**KV bindings:** `EVENTS_CACHE`

---

### `the-feed-nlp` — `workers/nlp/`
**URL:** `https://the-feed-nlp.workers.dev`

| Route | Method | Description |
|---|---|---|
| `/nlp/parse` | POST | Extract event(s) from raw text. Header: `X-Api-Key: sk-...` |
| `/nlp/parse-url` | POST | Fetch URL + extract events |
| `/nlp/moderate` | POST | Brand safety check only |

**Auth:** `X-Api-Key` (BYOK — caller provides their OpenAI key)  
**No secrets required at the worker level.**

---

### `the-feed-ingest` — `workers/ingest/`
**URL:** `https://the-feed-ingest.workers.dev`

| Route | Method | Description |
|---|---|---|
| `/ingest/raw` | POST | Natural language ingest gateway ("Death of the Form") |
| `/ingest/health` | GET | Health check |

**Request body (`/ingest/raw`):**
```json
{
  "text": "The Trews are playing the Commodore this Friday at 8pm. Tix $35.",
  "location_hint": "Kamloops, BC",
  "source": "web_component"
}
```

**Headers:**
```
Authorization: Bearer <source-token>   (optional — sets trust level)
X-Api-Key: sk-...                      (OpenAI key — required unless source token has DEFAULT_OPENAI_KEY)
```

**Response:**
```json
{
  "status": "committed" | "staged" | "pending_review" | "rejected" | "no_events_found",
  "id": "evt_abc123...",
  "message": "Human-readable status string",
  "event": { /* schema.org/Event JSON-LD */ }
}
```

**Secrets required:** `GITHUB_TOKEN`, `DEFAULT_OPENAI_KEY` (optional — for verified station tokens)  
**KV bindings:** `SOURCE_TOKENS_KV` (see token setup below)

---

## 5. Identity & Trust System

Source tokens are bearer tokens that set how much an ingest submission is trusted. They are **never stored raw** — only their SHA-256 hash is stored in KV.

### Trust Score → Routing

| Trust Score | Route |
|---|---|
| ≥ 90 | Direct commit to `ledger/events/production/` |
| ≥ 70 | Direct commit to `ledger/events/staging/` |
| < 70 | Opens a GitHub PR to staging for editorial review |

### Built-in Trust Levels

| Identity Type | Score | Use Case |
|---|---|---|
| `corporate_admin` | 95 | Internal automation, admin tools |
| `verified_venue` | 80 | Trusted venue or station partner |
| `automated_scraper` | 45 | Aggregator scripts |
| `public_submission` | 10 | Anonymous web form, `[the_feed_ingest]` without a token |

### Registering a Token

**Option A — Static (deploy-time):** Edit `STATIC_REGISTRY` in `workers/ingest/token-registry.js`. Replace the placeholder SHA-256 hashes with real ones:

```js
// In a Workers script or Node.js:
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-raw-token'));
const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
console.log(hex); // paste this into STATIC_REGISTRY
```

**Option B — KV (runtime):** Use `registerToken()` from `token-registry.js` in a one-off admin script:
```js
import { registerToken } from './workers/ingest/token-registry.js';
await registerToken('my-raw-secret-token', {
  name: 'CHNL Kamloops',
  type: 'verified_venue',
  trustScore: 80,
  locationHint: 'Kamloops, BC',
  targetGroup: 'vista-radio-kamloops',
}, env.SOURCE_TOKENS_KV);
```

---

## 6. Web Components

### `<the-feed-event>` — `ui/the-feed-event.js`
Event display component. Drop into any CMS or static site.

```html
<script type="module" src="https://cdn.the-feed.ca/the-feed-event.js"></script>

<!-- Event list for Kamloops -->
<the-feed-event
  api="https://the-feed-api.workers.dev"
  group="vista-radio-kamloops"
  mode="list"
  limit="10"
  theme="dark"
></the-feed-event>

<!-- Single event card -->
<the-feed-event
  api="https://the-feed-api.workers.dev"
  token="evt_abc123def456..."
  mode="card"
></the-feed-event>
```

**CSS Custom Properties:** `--primary-color`, `--accent-color`, `--font-family`, `--card-radius`, `--card-shadow`, `--ticket-btn-bg`

---

### `<the-feed-ingest>` — `ui/the-feed-ingest.js`
Event submission component — the "Death of the Form."

```html
<script type="module" src="https://cdn.the-feed.ca/the-feed-ingest.js"></script>

<the-feed-ingest
  api="https://the-feed-ingest.workers.dev"
  token="your-source-bearer-token"
  location-hint="Kamloops, BC"
  theme="light"
></the-feed-ingest>
```

**Key behaviours:**
- Single textarea, no structured form fields
- Microphone button uses `SpeechRecognition` API (Chrome/Edge); gracefully hidden if unavailable
- BYOK key field (collapsible) — `sk-...` required unless the `token` grants access to `DEFAULT_OPENAI_KEY`
- Shows extracted event summary (performer, date, venue, ticket price) on success
- Emits `the-feed:submitted` and `the-feed:error` CustomEvents

**Attributes:** `api`, `token`, `location-hint`, `placeholder`, `theme`, `api-key`

---

## 7. WordPress Plugin

**Install:** Upload `wordpress-plugin/` to `wp-content/plugins/the-feed/`

### Shortcodes

| Shortcode | Description |
|---|---|
| `[the_feed]` | Event list/feed display |
| `[the_feed_event token="evt_..."]` | Single event card |
| `[the_feed_ingest]` | Voice/text submission form |

**`[the_feed_ingest]` attributes:**
```
[the_feed_ingest
  api="https://the-feed-ingest.workers.dev"
  token="your-source-token"
  location="Kamloops, BC"
  theme="dark"
  placeholder="Tell us about the show..."
]
```

If `token` is omitted, it inherits from **Network Admin → The Feed → Settings → Source Token**.

### Network Settings Fields
- **Edge API URL** — `the-feed-api` worker URL
- **NLP Worker URL** — `the-feed-nlp` worker URL
- **Ingest Worker URL** — `the-feed-ingest` worker URL ← *new*
- **Source Token** — bearer token for this network's ingest submissions ← *new*
- **OpenAI API Key (BYOK)** — used by the admin NLP quick-parse tool
- **Default Hub Group** — e.g. `vista-radio-bc`
- **Default Scope** — `local` / `regional` / `national`
- **Geographic Radius (km)**
- **Component CDN URL**
- **Default Theme**

---

## 8. GitHub Actions

| Workflow | Trigger | Purpose |
|---|---|---|
| `validate-and-merge.yml` | PR to `main` | Validate schema + ID integrity; comment on PR; rebuild index on merge |
| `scraper-cron.yml` | Every 6h + `workflow_dispatch` | Run `scripts/aggregator.js` against configured sources |
| `deploy.yml` | Push to `main` or `staging` | Deploy API + NLP + **Ingest** workers + Cloudflare Pages |

### Required GitHub Secrets

| Secret | Used By |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `deploy.yml` |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml` |
| `GITHUB_TOKEN` | Auto-provided by Actions |
| `OPENAI_API_KEY` | `scraper-cron.yml` |

### Required Worker Secrets (set via `wrangler secret put`)
```bash
cd workers/api    && wrangler secret put GITHUB_TOKEN
cd workers/ingest && wrangler secret put GITHUB_TOKEN
cd workers/ingest && wrangler secret put DEFAULT_OPENAI_KEY   # optional
```

---

## 9. ID System (Idempotency)

Every event gets a deterministic `evt_` ID from a SHA-256 hash of three fields:

```
sha256( lowercase( performer_name | YYYY-MM-DD | venue_name ) )
```

**Rules:**
- `startDate` is truncated to `YYYY-MM-DD` — timezone variants of the same show produce the same ID
- The same raw text submitted twice → same NLP extraction → same hash → **no duplicate**
- `commitToLedger()` in `ingest.js` checks if `evt_{id}.json` already exists before writing — idempotent at the write layer too

---

## 10. Event Data Standard

All events are `schema.org/Event` JSON-LD. Minimal required fields:

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "@id": "evt_abc123def456...",
  "name": "The Trews Live",
  "startDate": "2026-04-20T20:00:00-07:00",
  "location": {
    "@type": "Place",
    "name": "Commodore Ballroom",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Vancouver",
      "addressRegion": "BC",
      "addressCountry": "CA"
    }
  },
  "performer": [{ "@type": "MusicGroup", "name": "The Trews" }],
  "_feed": {
    "targetGroup": "vista-radio-bc",
    "scope": "regional",
    "sourceToken": "sha256_hash_of_token",
    "trustScore": 80,
    "ingestedAt": "2026-03-11T12:00:00Z",
    "status": "production"
  }
}
```

Full schema reference: `docs/DATA_STANDARD.md`

---

## 11. What's NOT Built Yet (Future Work)

| Feature | Notes |
|---|---|
| `workers/syndication/` | Push syndication worker — WebSub / webhook fan-out to subscribers. Directory exists, not yet implemented. |
| KV namespace creation | `wrangler kv:namespace create SOURCE_TOKENS_KV` needs to be run and the ID pasted into `workers/ingest/wrangler.toml` |
| Real token hashes in `STATIC_REGISTRY` | Placeholder SHA-256 hashes in `token-registry.js` need to be replaced with real station tokens |
| Gutenberg block | Stub registered in plugin, but `blocks/the-feed-event/` directory and `block.json` not yet created |
| `demo.html` update | `ui/demo.html` doesn't yet include a `<the-feed-ingest>` demo section |
| CDN asset deployment | `ui/the-feed-event.js` and `ui/the-feed-ingest.js` need to be deployed to Cloudflare Pages |
| `package.json` build script | `npm run build:ui` referenced in `deploy.yml` needs to be wired to an actual bundler/copy step |

---

## 12. First Deployment Checklist

```
□ 1. Create Cloudflare account + get API token with Workers + Pages + KV permissions
□ 2. wrangler kv:namespace create SOURCE_TOKENS_KV
     → paste the namespace ID into workers/ingest/wrangler.toml
□ 3. Set worker secrets:
     cd workers/api    && wrangler secret put GITHUB_TOKEN
     cd workers/ingest && wrangler secret put GITHUB_TOKEN
     cd workers/ingest && wrangler secret put DEFAULT_OPENAI_KEY
□ 4. Generate real source tokens for Vista Radio stations + hash them
     → replace placeholder hashes in workers/ingest/token-registry.js
     → OR use registerToken() to write to KV at runtime
□ 5. Set GitHub Actions secrets:
     CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, OPENAI_API_KEY
□ 6. Push to `main` → deploy.yml deploys all 3 workers + Pages
□ 7. Update config/rules.json with real hub coordinates/cities if needed
□ 8. Install WordPress plugin on network → configure Network Admin → The Feed → Settings
□ 9. Test end-to-end: paste show description into <the-feed-ingest> → confirm evt_ appears in ledger
□ 10. Add [the_feed_ingest] shortcode to a WordPress page for public submissions
```

---

## 13. Key Design Decisions & Why

| Decision | Rationale |
|---|---|
| GitHub as the ledger | Immutable audit trail, built-in PR review workflow, free hosting, no database to manage |
| Deterministic SHA-256 IDs | Same show submitted from 10 sources = 1 record, not 10 duplicates |
| Cloudflare Workers (not Lambda) | Sub-10ms cold starts, globally distributed, KV at the edge, no VPC overhead |
| gpt-4o-mini at temperature 0.1 | Cheap (~$0.0001/request), fast, highly deterministic at low temperature |
| BYOK for OpenAI | Prevents cost abuse; trusted station tokens can use a shared `DEFAULT_OPENAI_KEY` |
| Web Components (no framework) | Works in WordPress, static sites, React apps, and plain HTML without build tooling |
| Trust-score routing | Trusted sources (stations) go live instantly; anonymous submissions queue for review |
| Single text field | The entire product thesis — no form is the killer feature |

---

*This document was generated by the build agent on March 11, 2026. See git history for per-file change attribution.*
