# Contributing to The Feed

## How Events Enter The Feed

There are three paths to production:

### 1. Public Submission (Web Form / API)
Anyone can submit an event via `POST /api/events/submit`. This creates a PR to the `staging` branch. A human editor must approve and merge to `production`. Brand safety is checked automatically.

### 2. Automated Scraper
The GitHub Actions cron job runs every 6 hours. It polls configured sources (`scripts/scraper-sources.json`), parses content via the NLP worker, and opens PRs to `staging`. Brand safety is enforced at the NLP layer.

### 3. Direct Editor Commit (Verified Venue / Corporate Admin)
Editors with repository write access can commit event files directly to a branch and open a PR. Use `node scripts/validate-events.js [file]` to validate before committing.

---

## Adding a New Network Hub

1. Edit `config/rules.json` — add a new entry to the `hubs` array
2. Assign a unique `targetGroup` string (e.g. `"vista-radio-victoria"`)
3. Set `geo.city`, `geo.region`, `geo.radiusKm`
4. Commit and merge to `main`
5. The Edge API will serve events to requests using `?group=vista-radio-victoria`

## Adding a New Scraper Source

1. Edit `scripts/scraper-sources.json` — add a new source object
2. Add a GitHub Secret: `OPENAI_KEY_<SOURCE_ID_UPPERCASE>` with the operator's OpenAI key
3. The next cron run will pick it up automatically

## Adding a New WordPress Site to the Network

1. Activate "The Feed" plugin on the site
2. In **Network Admin → The Feed**, set the default group for the network
3. Individual sites can override in **The Feed → Settings**
4. Drop `[the_feed]` shortcode or `<the-feed-event>` Web Component anywhere

---

## Event File Format

All event files must:
- Be valid JSON
- Conform to the Zod schema in `ledger/schema.js`
- Use a deterministic `@id` (run `node scripts/validate-events.js <file>` to check)
- Be named `[evt_id].json`
- Live in `ledger/events/staging/` on submission, `ledger/events/production/` after merge

## Validation

```bash
# Validate a specific file
node scripts/validate-events.js ledger/events/staging/evt_abc123.json

# Rebuild the production index after merging events
node scripts/rebuild-index.js
```

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production events. Protected. Requires PR + CI pass. |
| `staging` | Events pending editorial review. |
| `submission/*` | Auto-created per public submission. |
| `scraper/*` | Auto-created per scraped event. |

---

## Code of Conduct

The Feed serves community media. Content must be appropriate for a general community audience. The NLP moderation layer enforces brand safety automatically, but human editors are the final gatekeepers.
