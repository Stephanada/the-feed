# The Feed — Architecture

## System Design Principles

1. **GitOps as Database** — The GitHub repository is the canonical data store. No relational DB. Events are flat `.json` files. History is the audit log. Branching is the editorial workflow.

2. **Edge-First** — All reads are served at sub-50ms from Cloudflare's edge network. No origin server for read traffic.

3. **Serverless Write Path** — Writes go through `<the-feed-ingest>` → Cloudflare Workers → GitHub API → production or staging. The trust score determines which path.

4. **BYOK NLP** — The NLP parsing capability requires no platform API key. Callers bring their own OpenAI key, or use a shared `DEFAULT_OPENAI_KEY` provisioned per verified source token.

5. **Framework-Agnostic UI** — All three Web Components work via a single `<script type="module">` tag. No framework. Shadow DOM ensures CSS isolation from the host CMS. jsDelivr serves them directly from this public GitHub repo.

---

## Data Flow Diagrams

### Natural Language Ingest (the Eventizer)

```
Submitter (any site, any device)
   │
   ▼
<the-feed-ingest> Web Component
   │  POST /ingest/raw
   │  Headers: Authorization: Bearer <token>, X-Api-Key: sk-...
   │  Body: { text, location_hint }
   ▼
the-feed-ingest Worker (Cloudflare Edge)
   │
   ├── Resolve source token → trust score
   │       KV lookup → SHA-256 hash match
   │       Falls back to STATIC_REGISTRY
   │
   ├── POST /nlp/parse → the-feed-nlp Worker
   │       gpt-4o-mini (json_object, temp 0.1)
   │       Brand safety evaluation
   │       → schema.org/Event JSON-LD
   │
   ├── Validate + stamp
   │       SHA-256(performer | date | venue) → evt_[hex]
   │
   └── Route by trust score
           ≥ 90 → commitToLedger('production')
           ≥ 70 → commitToLedger('staging')
           < 70 → createPR(staging branch)
```

### Public Event Submission (structured)

```
Submitter
   │
   ▼
POST /api/events/submit  (the-feed-api Worker)
   │  Validate JSON-LD structure
   │  Generate evt_ ID
   │
   ▼
GitHub API → PR to staging branch
   │
   ▼
Human editor reviews + merges
   │
   ▼
validate-and-merge.yml CI
   │  Schema validation
   │  ID integrity check
   │  Rebuild index.json
```

### Read / Syndication Flow

```
Client (Browser, CMS, Feed Reader, iframe)
   │
   ▼
Cloudflare Edge Network (300+ PoPs)
   │
   ▼
the-feed-api Worker
   │
   ├── GET /api/events?group=vista-radio-kamloops
   │       Fetch production/index.json (GitHub raw, cached)
   │       Fetch individual evt_*.json files
   │       Apply filters: scope, group, city, region, genre, venue, performer
   │       Return JSON-LD ItemList
   │
   ├── GET /api/feed.ics   → iCalendar
   ├── GET /api/feed.rss   → RSS 2.0
   ├── GET /api/feed.xml   → Atom/XML
   └── GET /api/events/:id → single event
```

### iframe / No-code Embed Flow

```
No-code builder (Weebly, Wix, Squarespace, Showit)
   │  HTML block / Embed widget
   │
   ▼
<iframe src="https://the-feed-ui.pages.dev/embed.html?mode=calendar&skin=default">
   │
   ▼
embed.html (Cloudflare Pages)
   │  Parses URL params
   │  Loads <the-feed-calendar> or <the-feed-ingest> from same origin
   │
   ▼
<the-feed-calendar> Web Component
   │  GET /api/events
   │
   ▼
the-feed-api Worker → ledger → rendered calendar
```

---

## Hub & Spoke Topology

```
                    ┌─────────────────┐
                    │   THE LEDGER    │
                    │   (GitHub)      │
                    │  main / staging │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   EDGE API HUB  │
                    │  (CF Worker)    │
                    │  rules.json     │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼──────┐
   │ Kamloops    │   │ Kelowna      │   │ MadeInCanada│
   │ ?group=     │   │ ?group=      │   │ ?group=     │
   │ vista-radio-│   │ vista-radio- │   │ madeincanada│
   │ kamloops    │   │ kelowna      │   │             │
   └─────────────┘   └──────────────┘   └─────────────┘
```

Each spoke receives only events for its `targetGroup` and geographic `scope`. Routing rules live in `config/rules.json` — no per-site deploys.

---

## Security Model

| Layer | Mechanism |
|---|---|
| Public submissions | Staging branch → human editorial approval |
| Ingest trust | Token trust score (0–100) determines production vs staging vs PR |
| NLP API keys | BYOK — client supplies key in `X-Api-Key`, never stored unless `DEFAULT_OPENAI_KEY` set per token |
| Brand safety | Every NLP parse evaluates content safety before extraction |
| CORS | `ALLOWED_ORIGINS = "*"` — open public protocol |
| GitHub writes | Scoped PAT with only `contents:write` + `pull_requests:write` |
| Admin endpoints | `ADMIN_SECRET` bearer token required for `/admin/tokens` |

---

## Conflict Resolution

When the same event ID is submitted by multiple sources, `sourceAuthorityWeights` in `rules.json` determine which record wins:

| Source | Weight |
|---|---|
| `corporate_admin` | 100 |
| `verified_venue` | 75 |
| `automated_scraper` | 40 |
| `public_submission` | 10 |

Higher weight overwrites lower weight. Equal weight triggers a human review flag.


---
