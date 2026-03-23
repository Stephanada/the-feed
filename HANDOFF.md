# THE FEED — Developer Handoff
**Updated:** March 22, 2026  
**Milestone:** First real use case live — Sunshine Coast events, live marquee, CI/CD auto-deploy  
**Repository:** https://github.com/Stephanada/the-feed (public, MIT)

---

## 1. What This Is

**The Feed** is an open, headless event syndication protocol. A musician, venue, or promoter describes their show in plain English; The Feed's NLP pipeline (the "Eventizer") extracts a structured `schema.org/Event` JSON-LD record, stamps it with a deterministic SHA-256 ID, and routes it to production or an editorial review queue based on the source's trust score — automatically.

**Core thesis:** No form. One submission. Everywhere.

---

## 2. Live System

| Service | URL | Status |
|---|---|---|
| Landing page | https://thefeed.site | ✅ Live (custom domain) |
| Pages (alias) | https://the-feed-ui.pages.dev | ✅ Live |
| API Worker | https://the-feed-api.stephan-99b.workers.dev | ✅ Live |
| Ingest Worker | https://the-feed-ingest.stephan-99b.workers.dev | ✅ Live |
| NLP Worker | https://the-feed-nlp.stephan-99b.workers.dev | ✅ Live |

**Cloudflare account:** `stephan-99b`  
**Pages project:** `the-feed-ui`  
**CORS:** `ALLOWED_ORIGINS = "*"` on both API and ingest workers — open for any public site to embed.

---

## 3. Architecture

```
                        ┌──────────────────────────┐
  Raw text / voice ───▶ │  <the-feed-ingest>        │  Web Component
                        │  POST /ingest/raw          │  ui/the-feed-ingest.js
                        └─────────────┬────────────┘
                                      │ Bearer token + text
                                      ▼
                        ┌──────────────────────────┐
                        │  the-feed-ingest (Worker) │  workers/ingest/
                        │  Eventizer (gpt-4o-mini)  │
                        │  Token trust scoring      │
                        └─────────────┬────────────┘
                                      │
                   ┌──────────────────┼──────────────────┐
              ≥90  │             ≥70  │            <70   │
                   ▼                  ▼                   ▼
           direct → prod       direct → staging    PR → staging
                   └──────────────────┼──────────────────┘
                                      │
                        ┌─────────────▼────────────┐
                        │  GitHub Ledger (this repo)│
                        │  ledger/events/           │
                        │  production/  staging/    │
                        └─────────────┬────────────┘
                                      │
                        ┌─────────────▼────────────┐
                        │  the-feed-api (Worker)    │  workers/api/
                        │  REST · ICS · RSS · XML   │
                        └─────────────┬────────────┘
                                      │
          ┌───────────────────────────┼──────────────────────────┐
          ▼                           ▼                           ▼
  <the-feed-calendar>         WordPress Plugin          embed.html (iframe)
  <the-feed-event>            [the_feed] shortcode      Weebly/Wix/Squarespace
```

---

## 4. File Inventory

```
The Feed/
│
├── HANDOFF.md                               ← this file
├── README.md                                ← public-facing overview
├── package.json                             ← monorepo scripts (build:ui, deploy:*)
├── pages.toml                               ← Cloudflare Pages config
│
├── config/
│   └── rules.json                           ← Hub & Spoke routing rules (8 hubs)
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   └── DATA_STANDARD.md
│
├── ledger/
│   ├── schema.js                            ← Zod schema + generateEventId()
│   ├── event.example.json
│   └── events/
│       ├── production/
│       │   ├── index.json                   ← { count: 10, events: [...] }
│       │   ├── evt_sc_001.json              ← RC Legion: Open Mic And Jam (Roberts Creek, Mar 25)
│       │   ├── evt_sc_002.json              ← SSAC: Ukulele Jam & Sing-Along (Sechelt, Mar 26)
│       │   ├── evt_sc_003.json              ← Gibsons Legion: Eclectic Singers' Circle (Mar 26)
│       │   ├── evt_sc_004.json              ← Tapworks: Timbitz (Gibsons, Mar 26)
│       │   ├── evt_sc_005.json              ← RC Legion: Celtic Night – Two Thistles (Mar 26)
│       │   ├── evt_sc_006.json              ← Gibsons Legion: Bob Ross Painting Party (Mar 27)
│       │   ├── evt_sc_007.json              ← Persephone Brewing: Blue Western (Gibsons, Mar 27)
│       │   ├── evt_sc_008.json              ← Gibsons Legion: Beginner Line Dancing (Mar 27)
│       │   ├── evt_sc_009.json              ← Madeira Park Legion: Eddy Edrik (Mar 27)
│       │   └── evt_sc_010.json              ← St Hilda's Church: Bach & Friends (Sechelt, Mar 27)
│       └── staging/
│           └── .gitkeep
│
├── scripts/
│   ├── validate-events.js
│   ├── rebuild-index.js
│   ├── aggregator.js
│   └── scraper-sources.json
│
├── workers/
│   ├── api/
│   │   ├── index.js                         ← 8 REST routes + ICS/RSS/XML, CORS wildcard
│   │   └── wrangler.toml
│   ├── nlp/
│   │   ├── index.js                         ← gpt-4o-mini, BYOK, brand safety
│   │   └── wrangler.toml
│   └── ingest/
│       ├── index.js                         ← fetch handler
│       ├── ingest.js                        ← Eventizer pipeline
│       ├── token-registry.js                ← KV + static fallback token registry
│       └── wrangler.toml
│
├── ui/
│   ├── index.html                           ← Landing page (thefeed.site) — live marquee hero
│   ├── embed.html                           ← Hosted iframe shim for no-code builders
│   ├── feed-icon.svg                        ← Logomark / favicon / og:image
│   ├── the-feed-ingest.js                   ← <the-feed-ingest> component
│   ├── the-feed-calendar.js                 ← <the-feed-calendar> component
│   ├── the-feed-event.js                    ← <the-feed-event> component
│   ├── demo.html
│   └── skins/                               ← broadcast.json, poster.json, default.json
│
├── wordpress-plugin/
│   ├── the-feed.php
│   └── admin/
│       ├── network-settings.php
│       ├── shortcode-builder.php
│       └── nlp-tool.php
│
└── .github/
    └── workflows/
        └── deploy-pages.yml                 ← Auto-deploy UI on push to main (active)
```

---

## 5. Secrets & Config — Current State

### Wrangler secrets

| Worker | Secret | Status |
|---|---|---|
| `the-feed-api` | `GITHUB_TOKEN` | ✅ Set |
| `the-feed-api` | `CACHE_VERSION` | ✅ Set (`4`) — bump to bust edge cache |
| `the-feed-ingest` | `GITHUB_TOKEN` | ✅ Set |
| `the-feed-ingest` | `DEFAULT_OPENAI_KEY` | ✅ Set |
| `the-feed-ingest` | `ADMIN_SECRET` | ✅ Set (`8c7c4cbb...`) |

**Cache busting:** The API worker uses `?v=${CACHE_VERSION}` as the cache key suffix for all GitHub raw fetches. To force all edge nodes to re-fetch from GitHub after a ledger update:
```bash
echo "5" | npx wrangler secret put CACHE_VERSION --cwd workers/api
cd workers/api && npx wrangler deploy
```

### wrangler.toml vars (both workers)

```toml
GITHUB_OWNER             = "Stephanada"
GITHUB_REPO              = "the-feed"
GITHUB_PRODUCTION_BRANCH = "main"
GITHUB_STAGING_BRANCH    = "staging"
ALLOWED_ORIGINS          = "*"
```

### GitHub Actions secrets

| Secret | Status |
|---|---|
| `CLOUDFLARE_API_TOKEN` | ✅ Set |
| `CF_ACCOUNT_ID` | ✅ Set (`99b098b59733ba9dfc7068871a2cd8bb`) |
| `OPENAI_API_KEY` | ✅ Set |

### CI/CD

`.github/workflows/deploy-pages.yml` — triggers on push to `main` when `ui/**` changes:
1. `npm ci`
2. `npm run build:ui` (copies `ui/` → `dist/`)
3. `wrangler pages deploy ./dist --project-name=the-feed-ui`

**No manual deploy needed for UI changes** — just `git push`.

---

## 6. API Reference

**Base URL:** `https://the-feed-api.stephan-99b.workers.dev`  
**CORS:** Open (`*`)

| Route | Method | Description |
|---|---|---|
| `/api/events` | GET | List events. Params: `group`, `scope`, `city`, `region`, `genre`, `venue`, `performer`, `limit`, `offset`, `after`, `before` |
| `/api/events/:id` | GET | Single event by `evt_` ID |
| `/api/events/submit` | POST | Public JSON-LD submission (opens staging PR) |
| `/api/feed.ics` | GET | iCalendar |
| `/api/feed.rss` | GET | RSS 2.0 |
| `/api/feed.xml` | GET | Atom/XML |
| `/api/rules` | GET | Hub routing rules |
| `/api/health` | GET | `{ status: "ok" }` |

---

## 7. Ingest API

**Base URL:** `https://the-feed-ingest.stephan-99b.workers.dev`

| Route | Method | Auth |
|---|---|---|
| `/ingest/raw` | POST | Optional Bearer token |
| `/ingest/health` | GET | None |
| `/admin/tokens` | GET/POST/DELETE | `ADMIN_SECRET` header |

**POST `/ingest/raw` body:**
```json
{
  "text": "The Trews are playing the Commodore this Friday at 8pm. Tix $35.",
  "location_hint": "Kamloops, BC"
}
```

---

## 8. Web Components

Self-contained ES modules — no build step, no framework.

**jsDelivr CDN (public repo):**
```
https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-ingest.js
https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-calendar.js
https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-event.js
```

| Component | Attributes |
|---|---|
| `<the-feed-ingest>` | `api`, `token`, `skin`, `mode`, `group`, `location-hint` |
| `<the-feed-calendar>` | `api`, `token`, `skin`, `view`, `views`, `mode`, `group`, `venue`, `performer`, `genre`, `limit` |
| `<the-feed-event>` | `api`, `token`, `skin`, `mode` |

**Skins:** `default` · `broadcast` · `poster` · (custom URL to skin JSON)

---

## 9. Embed Shim

`https://thefeed.site/embed.html` — hosted page that loads the right component from URL params. Use inside `<iframe>` for no-code builders.

```html
<iframe
  src="https://thefeed.site/embed.html?mode=calendar&group=sunshine-coast&skin=default&view=mosaic"
  width="100%" height="600" style="border:none;border-radius:12px;" loading="lazy">
</iframe>
```

**Group-filtered embeds (ready to use):**
```
https://thefeed.site/embed.html?mode=calendar&group=sunshine-coast
https://thefeed.site/embed.html?mode=calendar&group=nanaimo
```

---

## 10. Identity & Trust

| Type | Score | Routes to |
|---|---|---|
| `corporate_admin` | 95 | `production/` direct commit |
| `verified_venue` | 80 | `staging/` direct commit |
| `automated_scraper` | 45 | PR to staging |
| Public (no token) | 10 | PR to staging |

Register tokens via `/admin/tokens` (requires `ADMIN_SECRET`) or at deploy-time in `token-registry.js`.

---

## 11. Deployment Checklist

```
✅  Cloudflare account active (stephan-99b)
✅  All 3 workers deployed (api, nlp, ingest)
✅  Cloudflare Pages project (the-feed-ui) live
✅  GITHUB_TOKEN set on api + ingest workers
✅  DEFAULT_OPENAI_KEY set on ingest worker
✅  ADMIN_SECRET set on ingest worker
✅  CACHE_VERSION secret on api worker (value: 4)
✅  CORS open (*) on both workers
✅  Landing page live at thefeed.site (custom domain)
✅  thefeed.site DNS live (Cloudflare nameservers)
✅  Repo public (enables jsDelivr CDN)
✅  GitHub Actions deploy-pages.yml wired — git push auto-deploys UI
✅  10 real Sunshine Coast events in production ledger (coastculture.com source)
✅  Nanaimo + Sunshine Coast hubs in config/rules.json (8 hubs total)
✅  Live scrolling marquee on landing page hero (pulls from API)
✅  Group filtering working: ?group=sunshine-coast, ?group=nanaimo
✅  Upcoming filter uses endDate — same-day events stay visible until they end

⬜  Add thefeed.site as custom domain in CF Pages dashboard
      Workers & Pages → the-feed-ui → Custom domains → Add domain
⬜  KV namespace for live token storage:
      wrangler kv:namespace create SOURCE_TOKENS_KV
      → paste namespace ID into workers/ingest/wrangler.toml → redeploy
⬜  Register real station/venue tokens via /admin/tokens
⬜  Nanaimo events — nanaimonewsnow.com has data; need scraper script
      (unbrowse discovered endpoint: /more/eventGrid?id=all,12227,29049&...)
⬜  GitHub Action: nightly coastculture scraper cron (auto-refresh ledger)
⬜  Gutenberg block (stub registered, blocks/ dir not yet created)
⬜  workers/syndication/ — push syndication via WebSub/webhooks (reserved)
```

---

## 12. ID System

```
SHA-256( lowercase( performer_name | YYYY-MM-DD | venue_name ) )
→ evt_[64-char hex]
```

Same show from 10 sources = 1 record. `commitToLedger()` checks for existing `evt_{id}.json` before writing — idempotent at the write layer.

---

## 13. Key Design Decisions

| Decision | Rationale |
|---|---|
| GitHub as ledger | Immutable audit trail, PR review workflow, no database |
| Deterministic SHA-256 IDs | No duplicates across sources or resubmissions |
| Cloudflare Workers | Sub-10ms cold starts, globally distributed |
| gpt-4o-mini at temp 0.1 | ~$0.0001/request, fast, deterministic |
| BYOK for OpenAI | No cost abuse; trusted tokens share DEFAULT_OPENAI_KEY |
| Web Components (no framework) | Works everywhere without build tooling |
| Trust-score routing | Trusted sources live instantly; anonymous submissions queue |
| CORS open (`*`) | Public protocol — any site embeds freely |
| Single text field | The product thesis — no form is the killer feature |
| Public repo | jsDelivr CDN without npm publish |

---

*Updated March 22, 2026. See `git log` for per-change attribution.*
