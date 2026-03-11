# Contributing to The Feed

## How Events Enter The Feed

There are four paths to production:

### 1. Natural Language Ingest (the Eventizer)
The primary path. Anyone drops a show description — plain text, a poster blurb, a social post — into `<the-feed-ingest>`. The Eventizer (gpt-4o-mini) extracts the structured event and routes it based on the source token's trust score.

```html
<script type="module"
  src="https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-ingest.js">
</script>
<the-feed-ingest skin="broadcast"></the-feed-ingest>
```

Or via the API directly:
```bash
curl -X POST https://the-feed-ingest.stephan-99b.workers.dev/ingest/raw \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: sk-..." \
  -d '{"text": "The Trews at the Commodore, April 15 at 8pm. Tickets $35.", "location_hint": "Vancouver, BC"}'
```

### 2. Public Structured Submission
Send a complete `schema.org/Event` JSON-LD payload to `POST /api/events/submit`. This opens a PR to the `staging` branch for editorial review.

### 3. Automated Scraper
The GitHub Actions cron job runs every 6 hours. It polls sources in `scripts/scraper-sources.json`, parses via the NLP worker, and opens PRs to staging.

### 4. Direct Editor Commit
Editors with repo write access commit event files directly. Run `node scripts/validate-events.js [file]` before committing.

---

## Embedding the Components

All components are served via jsDelivr from this public repo. No npm install, no build step.

```html
<!-- Submit widget -->
<script type="module"
  src="https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-ingest.js">
</script>
<the-feed-ingest></the-feed-ingest>

<!-- Event calendar -->
<script type="module"
  src="https://cdn.jsdelivr.net/gh/Stephanada/the-feed@main/ui/the-feed-calendar.js">
</script>
<the-feed-calendar view="mosaic"></the-feed-calendar>
```

**No-code (iframe):** Use `https://the-feed-ui.pages.dev/embed.html` — see the landing page embed guide for URL params.

---

## Adding a New Network Hub

1. Edit `config/rules.json` — add a new entry to `hubs`
2. Assign a unique `targetGroup` (e.g. `"vista-radio-victoria"`)
3. Set `geo.city`, `geo.region`, `geo.radiusKm`
4. Commit and merge to `main`
5. Events are now serveable via `GET /api/events?group=vista-radio-victoria`

---

## Adding a New Scraper Source

1. Edit `scripts/scraper-sources.json`
2. Add a GitHub Secret: `OPENAI_KEY_<SOURCE_ID_UPPERCASE>` with the operator's OpenAI key
3. The next cron run picks it up automatically

---

## Provisioning a Source Token

Source tokens elevate trust score, enabling direct commits to production or staging.

```bash
# Register a token via the admin endpoint:
curl -X POST https://the-feed-ingest.stephan-99b.workers.dev/admin/tokens \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-raw-secret-token",
    "name": "CHNL Kamloops",
    "type": "verified_venue",
    "trustScore": 80,
    "locationHint": "Kamloops, BC",
    "targetGroup": "vista-radio-kamloops"
  }'
```

Token types: `corporate_admin` (95) · `verified_venue` (80) · `automated_scraper` (45) · `public_submission` (10)

---

## Adding a New WordPress Site

1. Activate the plugin on the site
2. **Network Admin → The Feed → Settings** — set the default group and source token
3. Add shortcodes: `[the_feed]`, `[the_feed_ingest]`, `[the_feed_event token="evt_..."]`

---

## Event File Format

All event files must:
- Be valid JSON conforming to `ledger/schema.js`
- Use a deterministic `@id` (`evt_` + SHA-256)
- Be named `evt_[id].json`
- Live in `ledger/events/staging/` on submission, `ledger/events/production/` after merge

```bash
# Validate a file
node scripts/validate-events.js ledger/events/staging/evt_abc123.json

# Rebuild the production index
node scripts/rebuild-index.js
```

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production events. Protected. Requires PR + CI pass. |
| `staging` | Events pending editorial review. |
| `submission/*` | Auto-created per public submission. |
| `scraper/*` | Auto-created per scraped event. |

---

## Code of Conduct

The Feed serves community media. Content must be appropriate for a general audience. The NLP moderation layer enforces brand safety automatically, but human editors are the final gatekeepers.


---
