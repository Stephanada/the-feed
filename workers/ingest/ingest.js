/**
 * THE FEED — Ingest Pipeline Core
 * ══════════════════════════════════════════════════════════════
 * The "Eventizer" pipe. Takes raw text through the full
 * NLP → Validate → ID → Trust → Commit chain.
 *
 * This module is the single source of truth for what happens
 * to raw text between receipt and ledger entry.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const NLP_MODEL = 'gpt-4o-mini';

// ─────────────────────────────────────────────
// System Prompt — The Eventizer
// ─────────────────────────────────────────────
// Key mandates from Addendum II:
//   1. Resolve relative dates from current timestamp
//   2. Sanitize slang → professional metadata
//   3. Preserve the "vibe" in description
//   4. Brand safety FIRST
//   5. Idempotency: same event = same extracted core fields

function buildEventizerPrompt(currentTimestamp, locationHint) {
  return `You are "The Eventizer" — the ingestion engine for The Feed, an open community event protocol used across Canadian community radio and media platforms.

## YOUR MISSION
Convert raw, messy, unstructured text into a clean, structured schema.org/Event JSON object. The input may be:
- A copy-pasted venue email
- A Facebook event description
- A voice-to-text transcript (expect "um", "uh", incomplete sentences)
- A radio DJ's handwritten show notes
- A promoter's casual text message
- A poster description read aloud

## CURRENT TIMESTAMP
${currentTimestamp}
Use this to resolve ALL relative date references:
- "this Friday" → calculate the actual date
- "next Saturday" → calculate the actual date  
- "tomorrow night" → calculate the actual date
- "August long weekend" → resolve to the correct Friday/Monday
- If a year is not specified, assume the nearest future occurrence

## LOCATION CONTEXT
${locationHint ? `Submitter's location hint: "${locationHint}". Use this to fill in missing city/province/country when the event text is ambiguous.` : 'No location hint provided. Infer from context if possible.'}
Default country to "CA" (Canada) if context suggests it.
Default currency to "CAD" if context suggests it.

## BRAND SAFETY (EVALUATE FIRST)
If the input contains profanity, hate speech, adult content, spam, or anything inappropriate for a family-friendly community media platform, return:
{ "rejected": true, "reason": "brief explanation" }
Do NOT extract any data from rejected content.

## SLANG & VIBE RULES
- Sanitize casual language into professional event metadata for structured fields (name, location, performer names)
- BUT preserve the original energy, personality, and "vibe" in the "description" field
- Example: Input says "gonna be absolutely ripping, don't miss this banger" → description: "An electrifying night of live music. Don't miss this one."
- Performer names: capitalize properly, remove nicknames from structured fields (put them in description)
- Venue names: use the formal/legal name in location.name

## IDEMPOTENCY RULE
Extract the SAME core fields (performer name, date, venue name) regardless of how differently the same event is described. Two submissions about "The Trews at the Commodore on April 15" must yield identical performer[0].name, startDate (date portion), and location.name values.

## OUTPUT FORMAT
Always return this exact JSON structure (omit fields you cannot determine — never use null):

{
  "rejected": false,
  "confidence": 0.0-1.0,
  "events": [
    {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "string",
      "description": "string (preserve vibe here)",
      "image": "url",
      "startDate": "ISO 8601 with offset (e.g. 2026-04-15T20:00:00-07:00)",
      "endDate": "ISO 8601 with offset",
      "doorTime": "ISO 8601 with offset",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "url": "url",
      "genre": ["genre1"],
      "typicalAgeRange": "19+",
      "location": {
        "@type": "Place",
        "name": "Venue Name",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "123 Main St",
          "addressLocality": "City",
          "addressRegion": "Province",
          "postalCode": "V1V 1V1",
          "addressCountry": "CA"
        },
        "url": "url"
      },
      "performer": [
        {
          "@type": "MusicGroup",
          "name": "Artist Name",
          "url": "url",
          "sameAs": ["spotify url", "bandcamp url"]
        }
      ],
      "organizer": {
        "@type": "Organization",
        "name": "Promoter",
        "url": "url"
      },
      "offers": [
        {
          "@type": "Offer",
          "price": 20,
          "priceCurrency": "CAD",
          "availability": "https://schema.org/InStock",
          "url": "ticket url",
          "description": "General Admission"
        }
      ],
      "_feed": {
        "scope": "local",
        "brandSafe": true
      }
    }
  ],
  "extractionNotes": "optional: note anything ambiguous or that required inference"
}`;
}

// ─────────────────────────────────────────────
// Main Ingestion Pipeline
// ─────────────────────────────────────────────

export async function ingestRaw({
  text,
  source,
  locationHint,
  apiKey,
  sourceIdentity,
  submitterIp,
  env,
  ctx,
}) {
  const now = new Date();
  const currentTimestamp = now.toISOString();

  // ── Step 1: NLP extraction
  const systemPrompt = buildEventizerPrompt(
    now.toLocaleString('en-CA', {
      timeZone: 'America/Vancouver',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
    locationHint
  );

  const nlpResult = await callOpenAI(systemPrompt, text, apiKey);

  if (nlpResult.error) {
    return { error: 'NLP extraction failed', detail: nlpResult.error, statusCode: 502 };
  }

  // ── Step 2: Brand safety gate
  if (nlpResult.rejected) {
    return {
      status: 'rejected',
      reason: nlpResult.reason,
      message: 'This submission was rejected by the automated brand safety filter. Please review your content.',
    };
  }

  const rawEvents = nlpResult.events ?? [];
  if (rawEvents.length === 0) {
    return {
      status: 'no_events_found',
      confidence: nlpResult.confidence ?? 0,
      message: 'No event details could be extracted from the provided text. Please include a performer name, date, and venue.',
      extractionNotes: nlpResult.extractionNotes,
    };
  }

  // ── Step 3: Stamp each event (deterministic ID + trust metadata)
  const stampedEvents = await Promise.all(
    rawEvents.map((evt) => stampEvent(evt, sourceIdentity, now, source, submitterIp))
  );

  // ── Step 4: Trust routing
  // Each event may route differently based on trust score
  const results = await Promise.all(
    stampedEvents.map((evt) => routeByTrust(evt, sourceIdentity, env))
  );

  // ── Step 5: Build response
  // For single-event submissions (the common case), unwrap for UX simplicity
  if (results.length === 1) {
    const r = results[0];
    return {
      status: r.status,
      trustScore: sourceIdentity.trustScore,
      trustLevel: sourceIdentity.sourceAuthority,
      confidence: nlpResult.confidence ?? null,
      event: r.event,
      id: r.event['@id'],
      ...(r.prUrl ? { prUrl: r.prUrl } : {}),
      message: buildStatusMessage(r.status, sourceIdentity, r.event),
      extractionNotes: nlpResult.extractionNotes ?? null,
    };
  }

  // Multi-event submission
  return {
    status: 'multi',
    trustScore: sourceIdentity.trustScore,
    trustLevel: sourceIdentity.sourceAuthority,
    eventCount: results.length,
    events: results.map((r) => ({
      id: r.event['@id'],
      name: r.event.name,
      status: r.status,
      ...(r.prUrl ? { prUrl: r.prUrl } : {}),
    })),
    message: `${results.length} events extracted and submitted.`,
  };
}

// ─────────────────────────────────────────────
// Trust Routing
// ─────────────────────────────────────────────

async function routeByTrust(evt, sourceIdentity, env) {
  const { trustScore, sourceAuthority } = sourceIdentity;

  // High trust: commit directly to production (corporate admin)
  if (trustScore >= 90 && sourceAuthority === 'corporate_admin') {
    const result = await commitToLedger(evt, 'production', env);
    return { status: 'committed', event: evt, ...result };
  }

  // Verified venue: commit directly to staging (auto-passes review)
  if (trustScore >= 70 && sourceAuthority === 'verified_venue') {
    const result = await commitToLedger(evt, 'staging', env);
    return { status: 'committed_staging', event: evt, ...result };
  }

  // Lower trust: open a PR to staging for human review
  const result = await openStagingPR(evt, sourceIdentity, env);
  return { status: 'pending_review', event: evt, ...result };
}

// ─────────────────────────────────────────────
// GitHub Operations
// ─────────────────────────────────────────────

async function commitToLedger(evt, branch, env) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = env;
  const filePath = `ledger/events/${branch}/${evt['@id']}.json`;
  const content = btoa(JSON.stringify(evt, null, 2));

  // Check if file already exists (idempotency — same ID = same event)
  const existsRes = await ghApi(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${branch}`,
    'GET', null, GITHUB_TOKEN
  );

  if (existsRes.status === 200) {
    // Event already exists in the ledger — true idempotency
    return { alreadyExists: true };
  }

  const writeRes = await ghApi(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    'PUT',
    {
      message: `feat(ingest): ${evt._feed?.sourceAuthority} — add ${evt['@id']}`,
      content,
      branch,
    },
    GITHUB_TOKEN
  );

  if (!writeRes.ok) {
    const err = await writeRes.text();
    throw new Error(`GitHub commit failed: ${err}`);
  }

  return { committed: true };
}

async function openStagingPR(evt, sourceIdentity, env) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = env;
  const productionBranch = env.GITHUB_PRODUCTION_BRANCH ?? 'main';
  const stagingBranch = env.GITHUB_STAGING_BRANCH ?? 'staging';
  const filePath = `ledger/events/staging/${evt['@id']}.json`;

  const content = btoa(JSON.stringify(evt, null, 2));

  // Get HEAD SHA
  const refRes = await ghApi(
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${productionBranch}`,
    'GET', null, GITHUB_TOKEN
  );
  if (!refRes.ok) throw new Error('Could not read branch ref');
  const { object: { sha: baseSha } } = await refRes.json();

  // New branch for this submission
  const branchName = `ingest/${evt['@id'].substring(0, 20)}-${Date.now()}`;
  await ghApi(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, 'POST', {
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  }, GITHUB_TOKEN);

  // Write event file
  await ghApi(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, 'PUT', {
    message: `feat(ingest): public submission — ${evt['@id']}`,
    content,
    branch: branchName,
  }, GITHUB_TOKEN);

  // Open PR
  const performers = Array.isArray(evt.performer) ? evt.performer : [evt.performer].filter(Boolean);
  const performerNames = performers.map((p) => p.name).join(', ') || 'Unknown';

  const prBody = [
    `## 📬 Raw Text Submission`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Event ID** | \`${evt['@id']}\` |`,
    `| **Event Name** | ${evt.name ?? 'Unknown'} |`,
    `| **Performer(s)** | ${performerNames} |`,
    `| **Date** | ${evt.startDate ?? 'Unknown'} |`,
    `| **Venue** | ${evt.location?.name ?? 'Unknown'}, ${evt.location?.address?.addressLocality ?? ''} |`,
    `| **Source** | ${sourceIdentity.name} |`,
    `| **Trust Score** | ${sourceIdentity.trustScore}/100 (${sourceIdentity.sourceAuthority}) |`,
    `| **IP** | ${evt._feed?._submitterIp ?? 'unknown'} |`,
    ``,
    `### Extracted via NLP Ingestion`,
    `This event was submitted as raw text and extracted by the Eventizer NLP pipeline.`,
    `Please verify the extracted data matches the original intent before merging to \`${productionBranch}\`.`,
  ].join('\n');

  const prRes = await ghApi(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, 'POST', {
    title: `[Ingest] ${evt.name ?? evt['@id']}`,
    body: prBody,
    head: branchName,
    base: stagingBranch,
  }, GITHUB_TOKEN);

  if (!prRes.ok) {
    const err = await prRes.text();
    throw new Error(`PR creation failed: ${err}`);
  }

  const pr = await prRes.json();
  return { prUrl: pr.html_url };
}

function ghApi(path, method, body, token) {
  return fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'TheFeed-IngestWorker/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─────────────────────────────────────────────
// Event Stamping
// ─────────────────────────────────────────────

async function stampEvent(evt, sourceIdentity, now, sourceName, submitterIp) {
  const performers = Array.isArray(evt.performer) ? evt.performer : [evt.performer].filter(Boolean);
  const performerName = performers[0]?.name ?? '';
  const datePart = (evt.startDate ?? '').substring(0, 10);
  const venueName = evt.location?.name ?? '';

  const normalize = (s) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  const input = `${normalize(performerName)}|${normalize(datePart)}|${normalize(venueName)}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const id = `evt_${hashHex}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    ...evt,
    '@id': id,
    _feed: {
      scope: 'local',
      targetGroups: sourceIdentity.defaultTargetGroups ?? [],
      sourceAuthority: sourceIdentity.sourceAuthority,
      branch: sourceIdentity.trustScore >= 70 ? 'staging' : 'staging',
      brandSafe: true,
      ...evt._feed,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ingestedAs: 'raw_text',
      sourceToken: sourceIdentity.tokenId ?? null,
      sourceName: sourceName ?? sourceIdentity.name,
      // Strip submitter IP from public fields — store internally only
      _submitterIp: submitterIp,
    },
  };
}

// ─────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────

async function callOpenAI(systemPrompt, userContent, apiKey) {
  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NLP_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let parsed;
    try { parsed = JSON.parse(errText); } catch { parsed = { raw: errText }; }
    return { error: parsed?.error?.message ?? errText };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { error: 'Empty response from OpenAI' };

  try {
    return JSON.parse(content);
  } catch {
    return { error: 'Failed to parse NLP JSON response', raw: content };
  }
}

// ─────────────────────────────────────────────
// UX message builder
// ─────────────────────────────────────────────

function buildStatusMessage(status, sourceIdentity, evt) {
  const name = evt?.name ?? 'your event';
  const venue = evt?.location?.name ?? 'the venue';
  const date = evt?.startDate ? new Date(evt.startDate).toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }) : 'the scheduled date';

  switch (status) {
    case 'committed':
      return `✅ "${name}" at ${venue} on ${date} has been added to The Feed. It will appear on all connected sites shortly.`;
    case 'committed_staging':
      return `✅ "${name}" has been added to the staging ledger. It will go live after a quick editorial check.`;
    case 'pending_review':
      return `📬 "${name}" has been received and is pending editorial review. You'll be notified once it's approved. Thank you for contributing to The Feed!`;
    default:
      return `Submission received.`;
  }
}
