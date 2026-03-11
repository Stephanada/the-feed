/**
 * THE FEED — Edge API Worker (Cloudflare Workers)
 * ══════════════════════════════════════════════════════════════
 * Hub & Spoke Event Syndication Engine
 *
 * ROUTES:
 *   GET  /api/events            → Full production event ledger (JSON-LD)
 *   GET  /api/events/:id        → Single event by evt_ token
 *   GET  /api/events?...        → Filtered feed (scope, group, city, date range)
 *   GET  /api/feed.ics          → iCalendar format (all or filtered)
 *   GET  /api/feed.rss          → RSS 2.0 format
 *   GET  /api/feed.xml          → XML sitemap-compatible format
 *   POST /api/events/submit     → Public event submission → staging branch
 *   GET  /api/rules             → Expose current routing rules (read-only)
 *   GET  /api/health            → Health check
 *
 * ENV VARS (set in Cloudflare dashboard / wrangler.toml):
 *   GITHUB_TOKEN                → GitHub PAT for ledger read & PR creation
 *   GITHUB_OWNER                → e.g. "vistaradio"
 *   GITHUB_REPO                 → e.g. "the-feed-ledger"
 *   GITHUB_PRODUCTION_BRANCH    → default "main"
 *   GITHUB_STAGING_BRANCH       → default "staging"
 *   FEED_CDN_BASE               → Cloudflare Pages base URL for raw JSON files
 *   ALLOWED_ORIGINS             → Comma-separated CORS origins
 */

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }), env, request);
    }

    try {
      // Route matching
      if (path === "/api/health") {
        return corsResponse(json({ status: "ok", ts: new Date().toISOString() }), env, request);
      }

      if (path === "/api/rules" && method === "GET") {
        return handleGetRules(env, request);
      }

      if (path === "/api/events" && method === "GET") {
        return handleGetEvents(url, env, ctx, request);
      }

      if (path.startsWith("/api/events/") && method === "GET") {
        const id = path.replace("/api/events/", "");
        return handleGetEventById(id, env, ctx, request);
      }

      if (path === "/api/events/submit" && method === "POST") {
        return handleSubmitEvent(request, env);
      }

      if (path === "/api/feed.ics" && method === "GET") {
        return handleSyndicationICS(url, env, ctx);
      }

      if (path === "/api/feed.rss" && method === "GET") {
        return handleSyndicationRSS(url, env, ctx);
      }

      if (path === "/api/feed.xml" && method === "GET") {
        return handleSyndicationXML(url, env, ctx);
      }

      return corsResponse(json({ error: "Not Found" }, 404), env, request);
    } catch (err) {
      console.error("[The Feed] Unhandled error:", err);
      return corsResponse(json({ error: "Internal Server Error", detail: err.message }, 500), env, request);
    }
  },
};

// ─────────────────────────────────────────────
// Ledger Access (GitHub raw content)
// ─────────────────────────────────────────────

/**
 * Fetches all production events from the GitHub-hosted ledger.
 * Uses the Cloudflare CDN cache with a configurable TTL.
 */
async function fetchLedger(env, ctx) {
  const owner  = env.GITHUB_OWNER;
  const repo   = env.GITHUB_REPO;
  const branch = env.GITHUB_PRODUCTION_BRANCH ?? "main";

  // Public repo — no auth needed for raw content
  const indexUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/ledger/events/production/index.json`;

  const cache    = caches.default;
  const cacheKey = new Request(indexUrl);
  let cachedIndex = await cache.match(cacheKey).catch(() => null);

  let index;
  if (cachedIndex) {
    index = await cachedIndex.json();
  } else {
    const res = await fetch(indexUrl);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Ledger index fetch failed: ${res.status}`);
    }
    index = await res.json();

    try {
      ctx.waitUntil(cache.put(cacheKey,
        new Response(JSON.stringify(index), { headers: { "Cache-Control": "public, max-age=60" } })
      ));
    } catch (_) {}
  }

  if (!Array.isArray(index?.events) || index.events.length === 0) return [];

  const events = await Promise.all(
    index.events.map((id) => fetchEventById(id, env, ctx, branch))
  );
  return events.filter(Boolean);
}

async function fetchEventById(id, env, ctx, branch) {
  const owner = env.GITHUB_OWNER;
  const repo  = env.GITHUB_REPO;
  const b     = branch ?? env.GITHUB_PRODUCTION_BRANCH ?? "main";

  // Public repo — no auth needed
  const url      = `https://raw.githubusercontent.com/${owner}/${repo}/${b}/ledger/events/production/${id}.json`;
  const cache    = caches.default;
  const cacheKey = new Request(url);

  let cached = await cache.match(cacheKey).catch(() => null);
  if (cached) return cached.json();

  const res = await fetch(url);
  if (!res.ok) return null;

  const event = await res.json();
  try {
    ctx.waitUntil(cache.put(cacheKey,
      new Response(JSON.stringify(event), { headers: { "Cache-Control": "public, max-age=60" } })
    ));
  } catch (_) {}
  return event;
}

// ─────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────

async function handleGetEvents(url, env, ctx, request) {
  const params = url.searchParams;
  let events = await fetchLedger(env, ctx);

  // ── Filter: geographic scope
  const scope = params.get("scope"); // local | regional | national
  if (scope) {
    events = events.filter((e) => e._feed?.scope === scope);
  }

  // ── Filter: target group (hub routing)
  const group = params.get("group");
  if (group) {
    events = events.filter((e) => e._feed?.targetGroups?.includes(group));
  }

  // ── Filter: city (addressLocality)
  const city = params.get("city");
  if (city) {
    events = events.filter((e) =>
      e.location?.address?.addressLocality?.toLowerCase() === city.toLowerCase()
    );
  }

  // ── Filter: region / province
  const region = params.get("region");
  if (region) {
    events = events.filter((e) =>
      e.location?.address?.addressRegion?.toLowerCase() === region.toLowerCase()
    );
  }

  // ── Filter: date range
  const after = params.get("after") ? new Date(params.get("after")) : null;
  const before = params.get("before") ? new Date(params.get("before")) : null;
  if (after) events = events.filter((e) => new Date(e.startDate) >= after);
  if (before) events = events.filter((e) => new Date(e.startDate) <= before);

  // ── Filter: upcoming only (default behaviour unless past=true)
  if (params.get("past") !== "true") {
    const now = new Date();
    events = events.filter((e) => new Date(e.startDate) >= now);
  }

  // ── Filter: genre
  const genre = params.get("genre");
  if (genre) {
    events = events.filter((e) =>
      e.genre?.some((g) => g.toLowerCase().includes(genre.toLowerCase()))
    );
  }

  // ── Sort: chronological by default
  events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  // ── Pagination
  const limit = Math.min(parseInt(params.get("limit") ?? "100"), 500);
  const offset = parseInt(params.get("offset") ?? "0");
  const total = events.length;
  const page = events.slice(offset, offset + limit);

  return corsResponse(
    json({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "The Feed — Event Ledger",
      "description": "Open Event Protocol — Canonical event data for the Vista Radio & MadeInCanada network",
      "numberOfItems": total,
      "itemListElement": page.map((evt, i) => ({
        "@type": "ListItem",
        "position": offset + i + 1,
        "item": evt,
      })),
      "_feed": {
        "limit": limit,
        "offset": offset,
        "total": total,
        "hasMore": offset + limit < total,
      },
    }),
    env,
    request
  );
}

async function handleGetEventById(id, env, ctx, request) {
  if (!id.startsWith("evt_")) {
    return corsResponse(json({ error: "Invalid event ID format. Must be evt_[sha256]" }, 400), env, request);
  }

  const event = await fetchEventById(id, env, ctx);
  if (!event) {
    return corsResponse(json({ error: "Event not found", id }, 404), env, request);
  }

  return corsResponse(json(event), env, request);
}

async function handleGetRules(env, request) {
  const cdnBase = env.FEED_CDN_BASE ?? "https://raw.githubusercontent.com";
  const rulesUrl = `${cdnBase}/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_PRODUCTION_BRANCH ?? "main"}/config/rules.json`;
  const res = await fetch(rulesUrl, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}` },
  });
  if (!res.ok) return corsResponse(json({ error: "Rules not found" }, 404), env, request);
  const rules = await res.json();
  return corsResponse(json(rules), env, request);
}

async function handleSubmitEvent(request, env) {
  // Rate limit: check Cloudflare IP header
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse(json({ error: "Invalid JSON body" }, 400), env, request);
  }

  // Forward to NLP worker for validation + ID generation, then open a PR on staging
  // The NLP worker handles moderation; this path handles structured submissions
  const prResult = await createStagingPR(body, env, ip);

  if (!prResult.ok) {
    return corsResponse(
      json({ error: "Failed to create staging submission", detail: prResult.error }, 500),
      env,
      request
    );
  }

  return corsResponse(
    json({
      status: "submitted",
      message:
        "Your event has been received and is pending editorial review. Thank you!",
      submissionId: prResult.submissionId,
      prUrl: prResult.prUrl,
    }),
    env,
    request
  );
}

// ─────────────────────────────────────────────
// GitHub PR creation (staging branch write)
// ─────────────────────────────────────────────

async function createStagingPR(eventPayload, env, submitterIp) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = env;
  const stagingBranch = env.GITHUB_STAGING_BRANCH ?? "staging";
  const productionBranch = env.GITHUB_PRODUCTION_BRANCH ?? "main";

  const id = deriveId(eventPayload);
  const fileName = `${id}.json`;
  const filePath = `ledger/events/staging/${fileName}`;

  const now = new Date().toISOString();
  const stamped = {
    ...eventPayload,
    "@id": id,
    _feed: {
      ...eventPayload._feed,
      branch: "staging",
      sourceAuthority: "public_submission",
      createdAt: now,
      updatedAt: now,
      submitterIp,
    },
  };

  const content = btoa(JSON.stringify(stamped, null, 2));

  // 1. Get current SHA of production branch HEAD
  const refRes = await ghApi(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${productionBranch}`,
    "GET",
    null,
    GITHUB_TOKEN
  );
  if (!refRes.ok) return { ok: false, error: "Could not get branch ref" };
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Create a new branch off production for this submission
  const newBranchName = `submission/${id.substring(0, 20)}-${Date.now()}`;
  await ghApi(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
    "POST",
    { ref: `refs/heads/${newBranchName}`, sha: baseSha },
    GITHUB_TOKEN
  );

  // 3. Write the event file to the new branch
  await ghApi(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    "PUT",
    {
      message: `feat(submission): add event ${id}`,
      content,
      branch: newBranchName,
    },
    GITHUB_TOKEN
  );

  // 4. Open a Pull Request → staging
  const prRes = await ghApi(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
    "POST",
    {
      title: `[Submission] ${eventPayload.name ?? id}`,
      body: `**Automated public submission**\n\nEvent ID: \`${id}\`\nSubmitter IP: ${submitterIp}\n\nPlease review for brand safety and accuracy before merging to \`${productionBranch}\`.`,
      head: newBranchName,
      base: stagingBranch,
      draft: false,
    },
    GITHUB_TOKEN
  );

  if (!prRes.ok) {
    const err = await prRes.text();
    return { ok: false, error: err };
  }

  const pr = await prRes.json();
  return { ok: true, submissionId: id, prUrl: pr.html_url };
}

function ghApi(path, method, body, token) {
  return fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "TheFeed-EdgeWorker/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─────────────────────────────────────────────
// Syndication Formatters
// ─────────────────────────────────────────────

async function handleSyndicationICS(url, env, ctx) {
  const events = await applyFilters(url, await fetchLedger(env, ctx));
  const ics = buildICS(events);
  return corsResponse(
    new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="the-feed.ics"',
        "Cache-Control": "public, max-age=300",
      },
    }),
    env,
    null
  );
}

async function handleSyndicationRSS(url, env, ctx) {
  const events = await applyFilters(url, await fetchLedger(env, ctx));
  const rss = buildRSS(events, url);
  return corsResponse(
    new Response(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    }),
    env,
    null
  );
}

async function handleSyndicationXML(url, env, ctx) {
  const events = await applyFilters(url, await fetchLedger(env, ctx));
  const xml = buildXML(events);
  return corsResponse(
    new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    }),
    env,
    null
  );
}

function applyFilters(url, events) {
  const params = url.searchParams;
  let filtered = events;

  const group = params.get("group");
  if (group) filtered = filtered.filter((e) => e._feed?.targetGroups?.includes(group));

  const city = params.get("city");
  if (city)
    filtered = filtered.filter(
      (e) => e.location?.address?.addressLocality?.toLowerCase() === city.toLowerCase()
    );

  const region = params.get("region");
  if (region)
    filtered = filtered.filter(
      (e) => e.location?.address?.addressRegion?.toLowerCase() === region.toLowerCase()
    );

  if (params.get("past") !== "true") {
    const now = new Date();
    filtered = filtered.filter((e) => new Date(e.startDate) >= now);
  }

  filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return filtered;
}

// ── iCalendar (.ics) builder ──

function buildICS(events) {
  const escape = (s) =>
    String(s ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");

  const foldLine = (line) => {
    const MAX = 75;
    if (line.length <= MAX) return line;
    const chunks = [];
    chunks.push(line.substring(0, MAX));
    let i = MAX;
    while (i < line.length) {
      chunks.push(" " + line.substring(i, i + MAX - 1));
      i += MAX - 1;
    }
    return chunks.join("\r\n");
  };

  const toIcsDate = (iso) => {
    if (!iso) return "";
    return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z");
  };

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Feed//Open Event Protocol//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:The Feed — Community Events`,
    `X-WR-CALDESC:Powered by The Feed Open Event Protocol`,
  ];

  for (const evt of events) {
    const performers = Array.isArray(evt.performer) ? evt.performer : [evt.performer].filter(Boolean);
    const offers = Array.isArray(evt.offers) ? evt.offers : [evt.offers].filter(Boolean);
    const ticketUrl = offers[0]?.url ?? evt.url ?? "";

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${evt["@id"]}@thefeed`));
    lines.push(foldLine(`SUMMARY:${escape(evt.name)}`));
    lines.push(foldLine(`DTSTART:${toIcsDate(evt.startDate)}`));
    if (evt.endDate) lines.push(foldLine(`DTEND:${toIcsDate(evt.endDate)}`));
    if (evt.description) lines.push(foldLine(`DESCRIPTION:${escape(evt.description)}`));
    lines.push(
      foldLine(
        `LOCATION:${escape(evt.location?.name)}, ${escape(evt.location?.address?.streetAddress)}, ${escape(evt.location?.address?.addressLocality)}, ${escape(evt.location?.address?.addressRegion)}`
      )
    );
    if (evt.location?.geo) {
      lines.push(`GEO:${evt.location.geo.latitude};${evt.location.geo.longitude}`);
    }
    if (performers.length > 0) {
      lines.push(foldLine(`DESCRIPTION:${escape(evt.description ?? "")} | Performers: ${performers.map((p) => p.name).join(", ")}`));
    }
    if (ticketUrl) lines.push(foldLine(`URL:${ticketUrl}`));
    lines.push(foldLine(`DTSTAMP:${toIcsDate(new Date().toISOString())}`));
    lines.push(foldLine(`LAST-MODIFIED:${toIcsDate(evt._feed?.updatedAt)}`));
    lines.push(`STATUS:CONFIRMED`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ── RSS 2.0 builder ──

function buildRSS(events, url) {
  const escXml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const items = events
    .map((evt) => {
      const performers = Array.isArray(evt.performer)
        ? evt.performer
        : [evt.performer].filter(Boolean);
      const offers = Array.isArray(evt.offers) ? evt.offers : [evt.offers].filter(Boolean);
      const ticketUrl = offers[0]?.url ?? evt.url ?? "";
      const pubDate = new Date(evt.startDate).toUTCString();

      return `  <item>
    <title>${escXml(evt.name)}</title>
    <link>${escXml(ticketUrl)}</link>
    <guid isPermaLink="false">${escXml(evt["@id"])}</guid>
    <pubDate>${pubDate}</pubDate>
    <description><![CDATA[
      <strong>${escXml(evt.name)}</strong><br>
      📍 ${escXml(evt.location?.name)}, ${escXml(evt.location?.address?.addressLocality)}<br>
      🗓️ ${new Date(evt.startDate).toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}<br>
      🎤 ${performers.map((p) => escXml(p.name)).join(", ") || "TBA"}<br>
      🎟️ ${offers[0]?.price ? `$${offers[0].price} ${offers[0].priceCurrency}` : "Free / TBA"}<br>
      ${evt.description ? `<p>${escXml(evt.description)}</p>` : ""}
    ]]></description>
    <category>${escXml(evt._feed?.scope)}</category>
    ${evt.image ? `<enclosure url="${escXml(evt.image)}" type="image/jpeg"/>` : ""}
  </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>The Feed — Community Events</title>
    <link>https://thefeed.pages.dev</link>
    <description>Open Event Protocol — Local community culture, powered by The Feed</description>
    <language>en-ca</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${url.origin}/api/feed.rss" rel="self" type="application/rss+xml"/>
    <generator>The Feed Edge API v1.0</generator>
${items}
  </channel>
</rss>`;
}

// ── XML (structured event list) builder ──

function buildXML(events) {
  const escXml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const items = events
    .map((evt) => {
      const performers = Array.isArray(evt.performer)
        ? evt.performer
        : [evt.performer].filter(Boolean);
      const offers = Array.isArray(evt.offers) ? evt.offers : [evt.offers].filter(Boolean);

      return `  <event id="${escXml(evt["@id"])}">
    <name>${escXml(evt.name)}</name>
    <startDate>${escXml(evt.startDate)}</startDate>
    <endDate>${escXml(evt.endDate)}</endDate>
    <status>${escXml(evt.eventStatus?.split("/").pop())}</status>
    <venue>
      <name>${escXml(evt.location?.name)}</name>
      <city>${escXml(evt.location?.address?.addressLocality)}</city>
      <region>${escXml(evt.location?.address?.addressRegion)}</region>
      <country>${escXml(evt.location?.address?.addressCountry)}</country>
    </venue>
    <performers>
      ${performers.map((p) => `<performer type="${escXml(p["@type"])}">${escXml(p.name)}</performer>`).join("\n      ")}
    </performers>
    <offers>
      ${offers.map((o) => `<offer price="${o.price ?? ""}" currency="${escXml(o.priceCurrency)}" url="${escXml(o.url)}">${escXml(o.description)}</offer>`).join("\n      ")}
    </offers>
    <url>${escXml(evt.url)}</url>
    <image>${escXml(evt.image)}</image>
    <scope>${escXml(evt._feed?.scope)}</scope>
  </event>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:schema="https://schema.org" version="1.0" generated="${new Date().toISOString()}">
  <title>The Feed — Open Event Protocol</title>
  <description>Canonical event ledger — Vista Radio &amp; MadeInCanada Network</description>
  <events count="${events.length}">
${items}
  </events>
</feed>`;
}

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
    },
  });
}

function corsResponse(response, env, request) {
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "*").split(",").map(s => s.trim());
  const origin = request?.headers?.get("Origin") ?? "";
  const isAllowed =
    allowedOrigins.includes("*") ||
    allowedOrigins.includes(origin) ||
    /^https:\/\/[a-z0-9]+([-a-z0-9]*[a-z0-9])?\.the-feed-ui\.pages\.dev$/.test(origin);
  const allowOrigin = isAllowed ? origin : (allowedOrigins[0] ?? "*");
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
  headers.set("Vary", "Origin");
  headers.set("X-Powered-By", "The Feed — Open Event Protocol");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

/** Simple deterministic ID derivation for incoming payloads (no crypto module in Workers) */
async function deriveId(payload) {
  const performers = Array.isArray(payload.performer) ? payload.performer : [payload.performer];
  const performerName = performers[0]?.name ?? "";
  const datePart = (payload.startDate ?? "").substring(0, 10);
  const venueName = payload.location?.name ?? "";

  const normalize = (s) => String(s).toLowerCase().trim().replace(/\s+/g, " ");
  const input = `${normalize(performerName)}|${normalize(datePart)}|${normalize(venueName)}`;

  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `evt_${hashHex}`;
}
