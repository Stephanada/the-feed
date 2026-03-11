# The Feed — Architecture

## System Design Principles

1. **GitOps as Database** — The GitHub repository is the canonical data store. No relational DB. Events are flat `.json` files. History is the audit log. Branching is the editorial workflow.

2. **Edge-First** — All reads are served at sub-50ms from Cloudflare's edge network. No origin server for read traffic.

3. **Serverless Write Path** — Writes go through Cloudflare Workers → GitHub API → Pull Request. The PR is both the submission receipt and the moderation queue.

4. **BYOK NLP** — The NLP parsing capability requires no platform API key. Clients bring their own OpenAI key. The platform never stores or proxies keys without explicit configuration.

5. **Framework-Agnostic UI** — The Web Component works via a single `<script type="module">` tag. No framework dependency. Shadow DOM ensures CSS isolation from the host CMS.

---

## Data Flow Diagrams

### Public Event Submission

```
Submitter
   │
   ▼
POST /api/events/submit
   │
   ▼
Edge API Worker
   │  Validate structure
   │  Generate evt_ ID
   │  Rate limit check
   │
   ▼
GitHub API
   │  Create branch: submission/evt_[id]
   │  Commit: ledger/events/staging/[id].json
   │
   ▼
Pull Request → staging branch
   │
   ▼
Human Editor reviews PR
   │
   ├─── Merge → staging → production (via another PR)
   └─── Close → rejected (with comment)
```

### Automated Scraper Flow

```
GitHub Actions Cron (every 6h)
   │
   ▼
aggregator.js
   │  Load scraper-sources.json
   │  Resolve BYOK key per source
   │
   ▼
Fetch source URL / RSS
   │
   ▼
POST /nlp/parse (NLP Worker)
   │  gpt-4o-mini (json_object mode)
   │  Brand safety evaluation
   │  Event extraction → JSON-LD
   │
   ├─── Rejected? → Log, skip
   └─── Accepted?
           │
           ▼
       GitHub API
           │  Create branch
           │  Commit event file
           │
           ▼
       Pull Request → staging
           │
           ▼
       validate-and-merge.yml
           │  Schema validation
           │  ID integrity check
           │
           ▼
       Human Editor merge
```

### Read / Syndication Flow

```
Client (Browser, CMS, Feed Reader)
   │
   ▼
Cloudflare Edge Network (300+ PoPs)
   │
   ▼
Edge API Worker (the-feed-api.workers.dev)
   │
   ├── GET /api/events?group=vista-radio-kamloops
   │       │  Fetch production/index.json (cached 5min)
   │       │  Fetch individual event files (cached 5min)
   │       │  Apply filters: scope, group, city, region, genre
   │       └─ Return JSON-LD ItemList
   │
   ├── GET /api/feed.ics
   │       └─ Same data → iCalendar format
   │
   ├── GET /api/feed.rss
   │       └─ Same data → RSS 2.0 format
   │
   └── GET /api/feed.xml
           └─ Same data → XML format
```

---

## Hub & Spoke Topology

The Feed uses a centralized ledger with federated delivery:

```
                    ┌─────────────────┐
                    │   THE LEDGER    │
                    │   (GitHub)      │
                    │  main / staging │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   EDGE API HUB  │
                    │ (CF Worker)     │
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

Each spoke receives only the events relevant to its configured `targetGroup` and geographic `scope`. The hub applies routing rules from `config/rules.json` dynamically at the edge — no per-site deployments needed.

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Public submissions | Staging branch → human editorial approval required |
| Source authority | Trust hierarchy enforced during conflict resolution |
| NLP API keys | BYOK — client supplies key in `X-Api-Key` header, never stored |
| Brand safety | Every NLP parse evaluates content safety before extraction |
| Rate limiting | Cloudflare Worker rate limits on public submission endpoint |
| CORS | Configurable `ALLOWED_ORIGINS` env var on workers |
| GitHub writes | Scoped PAT with only `contents:write` and `pull_requests:write` |

---

## Conflict Resolution

When the same event (same deterministic ID) is submitted by multiple sources, the `sourceAuthorityWeights` from `rules.json` determine which record wins:

| Source | Weight |
|--------|--------|
| `corporate_admin` | 100 |
| `verified_venue` | 75 |
| `automated_scraper` | 40 |
| `public_submission` | 10 |

Higher weight overwrites lower weight. Equal weight triggers a human review flag.

---

## Deployment Checklist

- [ ] Create GitHub ledger repository
- [ ] Copy workflow files to `.github/workflows/`
- [ ] Set GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NLP_WORKER_URL`, `OPENAI_KEY_DEFAULT`
- [ ] Set Wrangler secret: `GITHUB_TOKEN` (via `wrangler secret put`)
- [ ] Update `config/rules.json` with your network hubs
- [ ] Update `scripts/scraper-sources.json` with your event sources
- [ ] Deploy API Worker: `npm run deploy:api`
- [ ] Deploy NLP Worker: `npm run deploy:nlp`
- [ ] Deploy Pages: `npm run deploy:pages`
- [ ] Install WordPress plugin on network
- [ ] Configure network settings: API URL, NLP URL, OpenAI key, default group
