/**
 * THE FEED — Source Token Registry
 * ══════════════════════════════════════════════════════════════
 * Maps bearer tokens to source authority levels.
 *
 * This is the "No Login Required" identity system.
 * A venue owner or radio editor gets a token once — they paste
 * it into their setup or bookmark a URL with it embedded.
 * All future submissions carry that identity automatically.
 *
 * TOKEN FORMAT:
 *   Tokens are opaque strings (UUIDs or random hex).
 *   They are stored HASHED (SHA-256) in the token registry.
 *   The registry is stored in Cloudflare KV or falls back
 *   to a static config file in the repo.
 *
 * TRUST LEVELS:
 *   corporate_admin   (score 95)  → commits directly to production
 *   verified_venue    (score 80)  → commits directly to staging
 *   automated_scraper (score 45)  → PR to staging
 *   public_submission (score 10)  → PR to staging (anonymous)
 *
 * TOKEN ISSUANCE:
 *   Tokens are issued by network admins via the WordPress plugin
 *   or directly by editing config/source-tokens.json and
 *   redeploying. No user-facing registration flow exists.
 */

// ─────────────────────────────────────────────
// Static fallback registry (used if KV is not configured)
// Production deployments should use Cloudflare KV instead.
// Each entry stores the SHA-256 hash of the raw token, never
// the token itself.
// ─────────────────────────────────────────────

const STATIC_REGISTRY = [
  // ── Example entries — replace with real hashed tokens ──
  // To generate: sha256(your-token-string) → paste hash here
  {
    tokenHash: 'REPLACE_WITH_SHA256_OF_YOUR_CORPORATE_ADMIN_TOKEN',
    name: 'Vista Radio — Network Operations',
    sourceAuthority: 'corporate_admin',
    trustScore: 95,
    defaultTargetGroups: ['vista-radio-national'],
    locationHint: 'Canada',
    active: true,
  },
  {
    tokenHash: 'REPLACE_WITH_SHA256_OF_KAMLOOPS_STATION_TOKEN',
    name: 'Vista Radio Kamloops — Program Director',
    sourceAuthority: 'verified_venue',
    trustScore: 80,
    defaultTargetGroups: ['vista-radio-kamloops', 'vista-radio-bc'],
    locationHint: 'Kamloops, BC, Canada',
    active: true,
  },
  {
    tokenHash: 'REPLACE_WITH_SHA256_OF_KELOWNA_STATION_TOKEN',
    name: 'Vista Radio Kelowna — Program Director',
    sourceAuthority: 'verified_venue',
    trustScore: 80,
    defaultTargetGroups: ['vista-radio-kelowna', 'vista-radio-bc'],
    locationHint: 'Kelowna, BC, Canada',
    active: true,
  },
  {
    tokenHash: 'REPLACE_WITH_SHA256_OF_MADEINCANADA_TOKEN',
    name: 'Made & Played in Canada — Editor',
    sourceAuthority: 'verified_venue',
    trustScore: 80,
    defaultTargetGroups: ['madeincanada', 'vista-radio-national'],
    locationHint: 'Canada',
    active: true,
  },
];

// Anonymous / no token identity
const ANONYMOUS_IDENTITY = {
  tokenId: null,
  name: 'Anonymous Public Submission',
  sourceAuthority: 'public_submission',
  trustScore: 10,
  defaultTargetGroups: [],
  locationHint: '',
  active: true,
};

// ─────────────────────────────────────────────
// Resolver
// ─────────────────────────────────────────────

/**
 * Resolves a bearer token string to a source identity object.
 * Falls back to anonymous if the token is null, invalid, or unknown.
 *
 * @param {string|null} token   - Raw bearer token from Authorization header
 * @param {object}      env     - Cloudflare Worker env (for KV access)
 * @returns {Promise<object>}   - Source identity object
 */
export async function resolveSourceToken(token, env) {
  if (!token) return { ...ANONYMOUS_IDENTITY };

  // Hash the incoming token for comparison
  const tokenHash = await sha256Hex(token);

  // ── Option A: Check Cloudflare KV (preferred in production)
  if (env?.SOURCE_TOKENS_KV) {
    try {
      const kvEntry = await env.SOURCE_TOKENS_KV.get(tokenHash, { type: 'json' });
      if (kvEntry && kvEntry.active) {
        return {
          ...kvEntry,
          tokenId: tokenHash.substring(0, 16), // short reference for logging
        };
      }
    } catch (err) {
      console.error('[Token Registry] KV lookup error:', err.message);
      // Fall through to static registry
    }
  }

  // ── Option B: Check static registry (development / fallback)
  const match = STATIC_REGISTRY.find(
    (entry) => entry.active && entry.tokenHash === tokenHash
  );

  if (match) {
    return {
      ...match,
      tokenId: tokenHash.substring(0, 16),
    };
  }

  // Unknown token — treat as anonymous but log the attempt
  console.warn(`[Token Registry] Unknown token hash: ${tokenHash.substring(0, 16)}...`);
  return {
    ...ANONYMOUS_IDENTITY,
    name: 'Unknown Token (treated as anonymous)',
  };
}

// ─────────────────────────────────────────────
// KV Token Management Helpers
// (called from admin tooling, not the hot path)
// ─────────────────────────────────────────────

/**
 * Registers a new source token in Cloudflare KV.
 * Call this from your admin tooling when onboarding a new venue/station.
 *
 * @param {string} rawToken       - The raw token string to register
 * @param {object} identityConfig - { name, sourceAuthority, trustScore, ... }
 * @param {object} kv             - Cloudflare KV namespace binding
 */
export async function registerToken(rawToken, identityConfig, kv) {
  const hash = await sha256Hex(rawToken);
  const entry = {
    ...identityConfig,
    tokenHash: hash,
    createdAt: new Date().toISOString(),
    active: true,
  };
  await kv.put(hash, JSON.stringify(entry));
  return { hash: hash.substring(0, 16) + '...', entry };
}

/**
 * Deactivates a token in KV (non-destructive revocation).
 */
export async function revokeToken(rawToken, kv) {
  const hash = await sha256Hex(rawToken);
  const existing = await kv.get(hash, { type: 'json' });
  if (!existing) return { ok: false, error: 'Token not found' };
  await kv.put(hash, JSON.stringify({ ...existing, active: false, revokedAt: new Date().toISOString() }));
  return { ok: true };
}

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

async function sha256Hex(input) {
  const encoded = new TextEncoder().encode(String(input));
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
