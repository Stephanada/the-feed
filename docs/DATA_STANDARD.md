# The Feed — Data Standard v1.0

## Overview

All events in The Feed conform to `schema.org/Event` expressed as JSON-LD. Every record is stored as an individual `.json` file in the `ledger/events/` directory.

---

## Deterministic ID Generation

Event IDs are deterministic — the same event will always produce the same ID regardless of who submits it. This is the deduplication mechanism.

**Algorithm:**
```
input  = lowercase(primaryPerformer) + "|" + YYYY-MM-DD + "|" + lowercase(venueName)
id     = "evt_" + SHA-256(input, UTF-8)
```

**Example:**
```
input  = "the trews|2026-04-15|commodore ballroom"
id     = evt_[64-char sha256 hex]
```

Only the **date portion** (YYYY-MM-DD) is used, not the time, to ensure timezone-offset variants of the same event hash identically.

---

## Required Fields

| Field | Type | Notes |
|-------|------|-------|
| `@context` | string | Always `"https://schema.org"` |
| `@type` | string | Always `"Event"` |
| `@id` | string | `evt_[sha256]` — deterministic |
| `name` | string | Event name / title |
| `startDate` | ISO 8601 | With timezone offset: `2026-04-15T20:00:00-07:00` |
| `location.@type` | string | Always `"Place"` |
| `location.name` | string | Venue name |
| `location.address.@type` | string | Always `"PostalAddress"` |
| `location.address.addressLocality` | string | City |
| `location.address.addressCountry` | string | ISO 3166-1 alpha-2 (`CA`, `US`) |
| `_feed.scope` | enum | `local` \| `regional` \| `national` |
| `_feed.sourceAuthority` | enum | See below |
| `_feed.branch` | enum | `staging` \| `production` |
| `_feed.createdAt` | ISO 8601 | UTC timestamp |
| `_feed.updatedAt` | ISO 8601 | UTC timestamp |

---

## Optional Fields

| Field | Type | Notes |
|-------|------|-------|
| `description` | string | Event description |
| `image` | URL | Promotional image |
| `endDate` | ISO 8601 | End time |
| `doorTime` | ISO 8601 | Doors open time |
| `url` | URL | Event page |
| `genre` | string[] | Music genres |
| `typicalAgeRange` | string | `"19+"`, `"All Ages"`, etc. |
| `performer` | object or array | See Performer schema |
| `organizer` | object or array | See Organizer schema |
| `offers` | object or array | See Offer schema |
| `eventStatus` | schema.org URL | See Event Status values |
| `eventAttendanceMode` | schema.org URL | See Attendance Mode values |

---

## Performer Schema

```json
{
  "@type": "MusicGroup",
  "name": "Artist Name",
  "url": "https://artist.com",
  "sameAs": [
    "https://open.spotify.com/artist/...",
    "https://artist.bandcamp.com"
  ]
}
```

**`@type` values:** `"MusicGroup"`, `"Person"`, `"PerformingGroup"`

---

## Offer Schema

```json
{
  "@type": "Offer",
  "price": 25.00,
  "priceCurrency": "CAD",
  "availability": "https://schema.org/InStock",
  "url": "https://tickets.example.com",
  "validFrom": "2026-03-01T10:00:00-07:00",
  "description": "General Admission"
}
```

**Availability values:**
- `https://schema.org/InStock`
- `https://schema.org/SoldOut`
- `https://schema.org/PreOrder`

---

## Event Status Values

| Value | Meaning |
|-------|---------|
| `https://schema.org/EventScheduled` | Confirmed, as planned |
| `https://schema.org/EventCancelled` | Cancelled |
| `https://schema.org/EventPostponed` | Date TBD |
| `https://schema.org/EventRescheduled` | New date set |
| `https://schema.org/EventMovedOnline` | Virtual/streaming |

---

## `_feed` Metadata Extension

The `_feed` object is a proprietary extension (non-schema.org) that carries syndication routing and provenance metadata.

```json
"_feed": {
  "scope": "regional",
  "targetGroups": ["vista-radio-bc", "madeincanada"],
  "sourceAuthority": "verified_venue",
  "branch": "production",
  "createdAt": "2026-03-10T12:00:00Z",
  "updatedAt": "2026-03-10T12:00:00Z",
  "sourceUrl": "https://venue.com/events",
  "brandSafe": true
}
```

### Source Authority Weights

| Value | Weight | Description |
|-------|--------|-------------|
| `corporate_admin` | 100 | Network operator direct entry |
| `verified_venue` | 75 | Confirmed venue accounts |
| `automated_scraper` | 40 | CI/CD aggregator |
| `public_submission` | 10 | Public web form |

### Target Groups

Target groups map directly to hub IDs in `config/rules.json`. An event with `targetGroups: ["vista-radio-bc", "madeincanada"]` will be served to requests from both of those hubs.

---

## File Naming

```
ledger/events/production/evt_[sha256].json
ledger/events/staging/evt_[sha256].json
```

File name is always the `@id` value (without the `evt_` prefix stripped — keep it).

---

## Example Record

See [`ledger/event.example.json`](../ledger/event.example.json) for a complete, annotated example.
