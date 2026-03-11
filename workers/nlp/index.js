/**
 * THE FEED — NLP Parsing Worker (Cloudflare Workers)
 * ══════════════════════════════════════════════════════════════
 * Processes unstructured text (event listings, press releases,
 * social media bios, venue emails) into structured JSON-LD
 * event data conforming to The Feed data standard.
 *
 * BYOK (Bring Your Own Key): The client MUST supply their
 * OpenAI API key in the `X-Api-Key` request header.
 * This worker never stores or logs API keys.
 *
 * ROUTES:
 *   POST /nlp/parse         → Extract event(s) from raw text
 *   POST /nlp/parse-url     → Fetch a URL and extract event(s)
 *   POST /nlp/moderate      → Brand safety check only (no extraction)
 *   GET  /nlp/health        → Health check
 *
 * MODEL: gpt-4o-mini (json_object mode, deterministic temperature)
 *
 * BRAND SAFETY:
 *   Profanity, hate speech, spam, or adult content triggers
 *   an immediate { rejected: true, reason: "..." } response.
 *   No event data is returned for rejected inputs.
 */

const NLP_MODEL = "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MAX_INPUT_CHARS = 8000;

// ─────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────

const SYSTEM_PROMPT_EXTRACT = `You are a structured data extraction engine for "The Feed," a community event syndication protocol.

Your task is to extract event information from unstructured text and return it as strict JSON conforming to schema.org/Event.

BRAND SAFETY RULES (evaluate FIRST, before any extraction):
- If the input contains profanity, hate speech, adult content, spam, pyramid schemes, or anything not suitable for a community media brand, you MUST return: { "rejected": true, "reason": "<brief explanation>" }
- Do NOT extract data from rejected content.
- When in doubt, reject.

EXTRACTION RULES:
- Extract ALL events found in the text (may be multiple).
- For each event, return a JSON object matching this structure exactly.
- Use ISO 8601 datetime strings with timezone offset (e.g., "2026-04-15T20:00:00-07:00").
- If a field cannot be determined, omit it entirely (do not use null or empty strings).
- For performer "@type": use "MusicGroup" for bands/groups, "Person" for solo artists, "PerformingGroup" for comedy/theatre/other.
- For country codes: use ISO 3166-1 alpha-2 (CA, US, GB, etc.). Default to "CA" if Canadian context is clear.
- For currency: use ISO 4217 (CAD, USD). Default to "CAD" if Canadian context is clear.
- Infer scope: "local" (single city), "regional" (province/multi-city), "national" (cross-country tour/streaming).
- Do NOT invent data. Only include what is present or strongly implied in the input.

OUTPUT FORMAT (always return this exact JSON wrapper):
{
  "rejected": false,
  "events": [
    {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "string",
      "description": "string",
      "image": "url string",
      "startDate": "ISO 8601 with offset",
      "endDate": "ISO 8601 with offset",
      "doorTime": "ISO 8601 with offset",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "url": "url string",
      "genre": ["genre1", "genre2"],
      "typicalAgeRange": "19+",
      "location": {
        "@type": "Place",
        "name": "Venue Name",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "123 Main St",
          "addressLocality": "City",
          "addressRegion": "Province/State",
          "postalCode": "V1V 1V1",
          "addressCountry": "CA"
        },
        "url": "https://venue.com"
      },
      "performer": [
        {
          "@type": "MusicGroup",
          "name": "Artist Name",
          "url": "https://artist.com",
          "sameAs": ["https://open.spotify.com/artist/...", "https://bandcamp.com/..."]
        }
      ],
      "organizer": {
        "@type": "Organization",
        "name": "Promoter Name",
        "url": "https://promoter.com"
      },
      "offers": [
        {
          "@type": "Offer",
          "price": 20,
          "priceCurrency": "CAD",
          "availability": "https://schema.org/InStock",
          "url": "https://tickets.example.com",
          "description": "General Admission"
        }
      ],
      "_feed": {
        "scope": "local",
        "sourceAuthority": "automated_scraper",
        "brandSafe": true
      }
    }
  ]
}`;

const SYSTEM_PROMPT_MODERATE = `You are a brand safety content moderation engine for "The Feed," a community event syndication protocol distributed across family-friendly community radio and news platforms.

Evaluate the provided text and return a JSON object with:
{
  "safe": true/false,
  "confidence": 0.0-1.0,
  "flags": ["list", "of", "detected", "issues"],
  "reason": "brief explanation if not safe"
}

Flag content as NOT SAFE if it contains:
- Profanity or explicit language
- Hate speech, discrimination, or slurs
- Adult or sexually explicit content
- Graphic violence
- Spam, phishing, or pyramid scheme content
- Drug promotion (beyond alcohol in appropriate licensed venue context)
- Any content inappropriate for a general community audience

Be conservative. If uncertain, flag as not safe with low confidence.`;

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }), env);
    }

    if (path === "/nlp/health") {
      return corsResponse(json({ status: "ok", model: NLP_MODEL, ts: new Date().toISOString() }), env);
    }

    // All other routes require POST + API key
    if (method !== "POST") {
      return corsResponse(json({ error: "Method not allowed" }, 405), env);
    }

    // ── BYOK: Require API key in header
    const apiKey = request.headers.get("X-Api-Key");
    if (!apiKey || !apiKey.startsWith("sk-")) {
      return corsResponse(
        json(
          {
            error: "Missing or invalid OpenAI API key",
            detail:
              "Provide your OpenAI API key in the `X-Api-Key` header. This service uses Bring Your Own Key (BYOK).",
          },
          401
        ),
        env
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(json({ error: "Invalid JSON body" }, 400), env);
    }

    try {
      if (path === "/nlp/parse") {
        return handleParse(body, apiKey, env);
      }
      if (path === "/nlp/parse-url") {
        return handleParseUrl(body, apiKey, env);
      }
      if (path === "/nlp/moderate") {
        return handleModerate(body, apiKey, env);
      }
    } catch (err) {
      console.error("[NLP Worker] Error:", err);
      return corsResponse(json({ error: "Internal error", detail: err.message }, 500), env);
    }

    return corsResponse(json({ error: "Not Found" }, 404), env);
  },
};

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

async function handleParse(body, apiKey, env) {
  const { text, context: userContext } = body;

  if (!text || typeof text !== "string") {
    return corsResponse(json({ error: "`text` field is required" }, 400), env);
  }

  if (text.length > MAX_INPUT_CHARS) {
    return corsResponse(
      json({ error: `Input exceeds ${MAX_INPUT_CHARS} character limit. Please trim the text.` }, 400),
      env
    );
  }

  const userMessage = userContext
    ? `CONTEXT PROVIDED BY OPERATOR:\n${userContext}\n\nEVENT TEXT TO PARSE:\n${text}`
    : text;

  const result = await callOpenAI(SYSTEM_PROMPT_EXTRACT, userMessage, apiKey);

  if (result.error) {
    return corsResponse(json({ error: "OpenAI API error", detail: result.error }, 502), env);
  }

  // Stamp each extracted event with deterministic IDs
  if (!result.rejected && result.events?.length > 0) {
    result.events = await Promise.all(result.events.map(stampEvent));
    result.eventCount = result.events.length;
  }

  return corsResponse(json(result), env);
}

async function handleParseUrl(body, apiKey, env) {
  const { url: targetUrl, context: userContext } = body;

  if (!targetUrl || typeof targetUrl !== "string") {
    return corsResponse(json({ error: "`url` field is required" }, 400), env);
  }

  // Fetch the page content
  let pageText;
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "TheFeed-NLPBot/1.0 (https://thefeed.pages.dev; event-aggregator)",
        Accept: "text/html,text/plain",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return corsResponse(
        json({ error: `Failed to fetch URL: HTTP ${res.status}`, url: targetUrl }, 422),
        env
      );
    }

    const rawHtml = await res.text();
    // Strip HTML tags for cleaner NLP input
    pageText = rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, MAX_INPUT_CHARS);
  } catch (err) {
    return corsResponse(
      json({ error: "Failed to fetch URL", detail: err.message, url: targetUrl }, 422),
      env
    );
  }

  const userMessage = `SOURCE URL: ${targetUrl}\n\n${userContext ? `CONTEXT: ${userContext}\n\n` : ""}PAGE CONTENT:\n${pageText}`;
  const result = await callOpenAI(SYSTEM_PROMPT_EXTRACT, userMessage, apiKey);

  if (result.error) {
    return corsResponse(json({ error: "OpenAI API error", detail: result.error }, 502), env);
  }

  if (!result.rejected && result.events?.length > 0) {
    result.events = await Promise.all(result.events.map(stampEvent));
    result.eventCount = result.events.length;
    result.sourceUrl = targetUrl;
  }

  return corsResponse(json(result), env);
}

async function handleModerate(body, apiKey, env) {
  const { text } = body;

  if (!text || typeof text !== "string") {
    return corsResponse(json({ error: "`text` field is required" }, 400), env);
  }

  const result = await callOpenAI(SYSTEM_PROMPT_MODERATE, text.substring(0, MAX_INPUT_CHARS), apiKey);

  if (result.error) {
    return corsResponse(json({ error: "OpenAI API error", detail: result.error }, 502), env);
  }

  return corsResponse(json(result), env);
}

// ─────────────────────────────────────────────
// OpenAI API Call
// ─────────────────────────────────────────────

async function callOpenAI(systemPrompt, userContent, apiKey) {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NLP_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errData;
    try {
      errData = JSON.parse(errText);
    } catch {
      errData = { raw: errText };
    }
    return { error: errData?.error?.message ?? errText };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return { error: "Empty response from OpenAI" };
  }

  try {
    return JSON.parse(content);
  } catch (parseErr) {
    return { error: "Failed to parse OpenAI JSON response", raw: content };
  }
}

// ─────────────────────────────────────────────
// Event Stamping (deterministic ID + metadata)
// ─────────────────────────────────────────────

async function stampEvent(evt) {
  const now = new Date().toISOString();

  // Generate deterministic ID using Web Crypto (available in Workers)
  const performers = Array.isArray(evt.performer) ? evt.performer : [evt.performer].filter(Boolean);
  const performerName = performers[0]?.name ?? "";
  const datePart = (evt.startDate ?? "").substring(0, 10);
  const venueName = evt.location?.name ?? "";

  const normalize = (s) => String(s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  const input = `${normalize(performerName)}|${normalize(datePart)}|${normalize(venueName)}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    ...evt,
    "@id": `evt_${hashHex}`,
    _feed: {
      scope: "local",
      targetGroups: [],
      sourceAuthority: "automated_scraper",
      branch: "staging",
      brandSafe: true,
      ...evt._feed,
      createdAt: now,
      updatedAt: now,
    },
  };
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function corsResponse(response, env) {
  const allowedOrigins = (env?.ALLOWED_ORIGINS ?? "*").split(",");
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigins[0] ?? "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
  headers.set("X-Powered-By", "The Feed NLP Parser v1.0");
  return new Response(response.body, { status: response.status, headers });
}
