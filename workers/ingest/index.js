/**
 * THE FEED — /ingest/raw Natural Language Ingestion Gateway
 * ══════════════════════════════════════════════════════════════
 * "The Death of the Form"
 *
 * This is the primary public-facing ingestion endpoint.
 * It accepts raw, unstructured text — a pasted email, a radio
 * script, a voice transcript, a Facebook post copy-paste — and
 * runs the full extraction, validation, trust-scoring, and
 * ledger-commit pipeline automatically.
 *
 * NO LOGIN REQUIRED. Source identity is established via an
 * optional bearer token in the Authorization header.
 * Anonymous submissions are valid and route to staging.
 *
 * ENDPOINT:
 *   POST /ingest/raw
 *
 * REQUEST:
 *   Headers:
 *     Authorization: Bearer <source_token>   (optional)
 *     X-Api-Key: sk-...                       (BYOK OpenAI key)
 *     Content-Type: application/json
 *
 *   Body:
 *     {
 *       "text": "The Trews are playing the Commodore this Friday at 8pm...",
 *       "url": "https://bandsintown.com/...",   // optional — URL to event page
 *       "source": "optional human label for this submission",
 *       "location_hint": "Vancouver, BC"        // optional geo context
 *     }
 *
 * OPENAI KEY RESOLUTION (BYOK):
 *   1. X-Api-Key request header       (end-user provides their own key)
 *   2. Source token's registered key  (org key stored in KV token entry)
 *   3. env.DEFAULT_OPENAI_KEY secret  (deployment owner's fallback key)
 *
 * ORG TOKEN MANAGEMENT:
 *   POST   /admin/tokens   → create or update an org's source token + optional shared key
 *   DELETE /admin/tokens   → revoke a token
 *   Both require:  Authorization: Bearer <ADMIN_SECRET>
 *
 * RESPONSE (success):
 *   {
 *     "status": "committed" | "pending_review",
 *     "trustScore": 85,
 *     "event": { ...full JSON-LD event },
 *     "id": "evt_[sha256]",
 *     "prUrl": "https://github.com/...",   // if pending_review
 *     "message": "Human-readable status"
 *   }
 *
 * TRUST SCORING:
 *   90-100  corporate_admin token   → direct commit to production
 *   70-89   verified_venue token    → direct commit to staging, auto-approved
 *   40-69   automated_scraper token → PR to staging, requires review
 *   0-39    anonymous / public      → PR to staging, requires review
 *
 * IDEMPOTENCY:
 *   The SHA-256 ID is derived deterministically from
 *   lowercase(performer|date|venue). Submitting the same event
 *   twice — even with different wording — produces the same ID
 *   and will not create a duplicate.
 */

import { ingestRaw } from './ingest.js';
import { resolveSourceToken } from './token-registry.js';

const ALLOWED_METHODS = ['GET', 'POST', 'DELETE', 'OPTIONS'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), env);
    }

    if (!ALLOWED_METHODS.includes(request.method)) {
      return cors(json({ error: 'Method not allowed' }, 405), env);
    }

    if (url.pathname === '/ingest/raw') {
      return cors(await handleIngestRaw(request, env, ctx), env);
    }

    if (url.pathname === '/ingest/health') {
      return cors(json({ status: 'ok', ts: new Date().toISOString() }), env);
    }

    // ── Admin: token management (protected by ADMIN_SECRET)
    if (url.pathname === '/admin/tokens') {
      return cors(await handleAdminTokens(request, env), env);
    }

    return cors(json({ error: 'Not found' }, 404), env);
  },
};

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

async function handleIngestRaw(request, env, ctx) {
  // ── 1. Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400);
  }

  const { text, url, source, location_hint } = body;

  if (!text && !url) {
    return json({
      error: 'A `text` description or `url` (or both) is required.',
      hint: 'Paste a URL to an event page, describe the event in plain language, or provide both.',
    }, 400);
  }

  if (text && (typeof text !== 'string' || text.trim().length < 5)) {
    return json({ error: 'If provided, `text` must be at least 5 characters.' }, 400);
  }

  if (text && text.length > 10000) {
    return json({ error: 'Text exceeds 10,000 character limit. Please trim to the relevant event details.' }, 400);
  }

  if (url && typeof url === 'string') {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Bad protocol');
    } catch {
      return json({ error: 'The `url` field must be a valid http:// or https:// URL.' }, 400);
    }
  }

  // ── 2. Resolve BYOK OpenAI key
  // Priority: X-Api-Key header → source token's registered key → env.DEFAULT_OPENAI_KEY
  // This lets:
  //   - End users provide their own key via the component's key field
  //   - Verified stations have their key stored server-side in their token registry entry
  //   - Network admins set a fallback key in wrangler secrets for their deployment
  const authHeader = request.headers.get('Authorization') ?? '';
  const sourceToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const sourceIdentity = await resolveSourceToken(sourceToken, env);

  const apiKey = request.headers.get('X-Api-Key')
    ?? sourceIdentity.openaiKey
    ?? env.DEFAULT_OPENAI_KEY;

  if (!apiKey || !apiKey.startsWith('sk-')) {
    return json({
      error: 'An OpenAI API key is required.',
      detail: 'Provide your key in the `X-Api-Key` request header. This service uses Bring Your Own Key (BYOK). Verified source tokens may have a key registered server-side.',
    }, 401);
  }

  // ── 3. Run the full ingestion pipeline
  const submitterIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const result = await ingestRaw({
    text: text?.trim() ?? '',
    url: url?.trim() ?? '',
    source: source ?? sourceIdentity.name,
    locationHint: location_hint ?? sourceIdentity.locationHint ?? '',
    apiKey,
    sourceIdentity,
    submitterIp,
    env,
    ctx,
  });

  return json(result, result.error ? (result.statusCode ?? 500) : 200);
}

// ─────────────────────────────────────────────
// Admin — Token Management
// POST   /admin/tokens   → create or update an org token
// DELETE /admin/tokens   → revoke a token (by raw token value)
//
// Protected by ADMIN_SECRET wrangler secret.
// Set it once:  npx wrangler secret put ADMIN_SECRET
//
// POST body:
//   {
//     "token":          "raw-token-string",   // the secret you'll hand to the org
//     "name":           "CFBX Kamloops",
//     "sourceAuthority":"verified_venue",      // corporate_admin | verified_venue | automated_scraper
//     "trustScore":     80,
//     "locationHint":   "Kamloops, BC, Canada",
//     "targetGroups":   ["vista-radio-kamloops"],
//     "openaiKey":      "sk-..."               // optional — org's shared key
//   }
//
// DELETE body:
//   { "token": "raw-token-string-to-revoke" }
// ─────────────────────────────────────────────

async function handleAdminTokens(request, env) {
  // ── Auth
  const adminSecret = env.ADMIN_SECRET;
  if (!adminSecret) {
    return json({ error: 'Admin API is not configured. Set the ADMIN_SECRET wrangler secret.' }, 503);
  }
  const authHeader = request.headers.get('Authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!provided || provided !== adminSecret) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  if (!env.SOURCE_TOKENS_KV) {
    return json({ error: 'SOURCE_TOKENS_KV binding is not configured.' }, 503);
  }

  // ── Parse body
  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const { token } = body;
  if (!token || typeof token !== 'string' || token.length < 8) {
    return json({ error: '`token` must be a string of at least 8 characters.' }, 400);
  }

  const tokenHash = await sha256Hex(token);

  // ── DELETE — revoke
  if (request.method === 'DELETE') {
    await env.SOURCE_TOKENS_KV.delete(tokenHash);
    return json({ ok: true, action: 'revoked', tokenHash: tokenHash.substring(0, 16) + '…' });
  }

  // ── POST — create or update
  if (request.method !== 'POST') {
    return json({ error: 'Use POST to create/update a token or DELETE to revoke.' }, 405);
  }

  const VALID_AUTHORITIES = ['corporate_admin', 'verified_venue', 'automated_scraper', 'public_submission'];
  const sourceAuthority = body.sourceAuthority ?? 'verified_venue';
  if (!VALID_AUTHORITIES.includes(sourceAuthority)) {
    return json({ error: `sourceAuthority must be one of: ${VALID_AUTHORITIES.join(', ')}` }, 400);
  }

  const trustDefaults = { corporate_admin: 95, verified_venue: 80, automated_scraper: 45, public_submission: 10 };

  const entry = {
    tokenHash,
    name:                body.name           ?? 'Unnamed Source',
    sourceAuthority,
    trustScore:          body.trustScore      ?? trustDefaults[sourceAuthority],
    defaultTargetGroups: body.targetGroups    ?? [],
    locationHint:        body.locationHint    ?? '',
    active:              true,
    createdAt:           new Date().toISOString(),
  };

  // Only store openaiKey if explicitly provided — never store undefined
  if (body.openaiKey && body.openaiKey.startsWith('sk-')) {
    entry.openaiKey = body.openaiKey;
  }

  await env.SOURCE_TOKENS_KV.put(tokenHash, JSON.stringify(entry));

  return json({
    ok: true,
    action: 'upserted',
    tokenHash: tokenHash.substring(0, 16) + '…',
    name: entry.name,
    sourceAuthority: entry.sourceAuthority,
    trustScore: entry.trustScore,
    hasOrgKey: !!entry.openaiKey,
  }, 201);
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function cors(response, env) {
  const origins = (env?.ALLOWED_ORIGINS ?? '*').split(',');
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', origins[0] ?? '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  h.set('X-Powered-By', 'The Feed — Open Event Protocol');
  return new Response(response.body, { status: response.status, headers: h });
}
