/**
 * THE FEED — Automated Aggregator Script
 * ══════════════════════════════════════════════════════════════
 * Polls configured event sources, passes raw content through
 * the NLP Parser worker, and opens GitHub PRs for new events.
 *
 * Run by GitHub Actions scraper-cron.yml on a schedule.
 *
 * Sources are configured in scripts/scraper-sources.json.
 * Each source maps to a BYOK OpenAI key stored as a GitHub Secret.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_FILE = join(__dirname, "scraper-sources.json");

const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  NLP_WORKER_URL,
  SOURCE_ID,
  DRY_RUN,
} = process.env;

const isDryRun = DRY_RUN === "true";

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  let sources = JSON.parse(readFileSync(SOURCES_FILE, "utf8"));

  // Filter to a specific source if requested via workflow_dispatch
  if (SOURCE_ID) {
    sources = sources.filter((s) => s.id === SOURCE_ID);
    if (sources.length === 0) {
      console.error(`No source found with id: ${SOURCE_ID}`);
      process.exit(1);
    }
  }

  const report = {
    runAt: new Date().toISOString(),
    dryRun: isDryRun,
    sources: [],
  };

  for (const source of sources) {
    console.log(`\n──────────────────────────────────`);
    console.log(`Processing source: ${source.name} (${source.id})`);

    // Resolve BYOK OpenAI key for this source
    const envKeyName = `OPENAI_KEY_${source.id.toUpperCase().replace(/-/g, "_")}`;
    const apiKey = process.env[envKeyName] ?? process.env.OPENAI_KEY_DEFAULT;

    if (!apiKey) {
      console.warn(`⚠️  No OpenAI key for source ${source.id} (tried ${envKeyName} and OPENAI_KEY_DEFAULT). Skipping.`);
      report.sources.push({ id: source.id, status: "skipped", reason: "no_api_key" });
      continue;
    }

    const sourceReport = { id: source.id, name: source.name, events: [], errors: [] };

    try {
      // Fetch source content
      const content = await fetchSourceContent(source);
      if (!content) {
        sourceReport.status = "skipped";
        sourceReport.reason = "no_content";
        continue;
      }

      // Parse via NLP worker
      const parsed = await parseWithNLP(content, source, apiKey);

      if (parsed.rejected) {
        console.warn(`⚠️  Source ${source.id} content rejected by brand safety: ${parsed.reason}`);
        sourceReport.status = "rejected";
        sourceReport.reason = parsed.reason;
        report.sources.push(sourceReport);
        continue;
      }

      const events = parsed.events ?? [];
      console.log(`   Found ${events.length} event(s)`);

      for (const evt of events) {
        if (isDryRun) {
          console.log(`   [DRY RUN] Would submit: ${evt["@id"]} — ${evt.name}`);
          sourceReport.events.push({ id: evt["@id"], name: evt.name, status: "dry_run" });
          continue;
        }

        // Submit to staging via GitHub API (create PR)
        const result = await submitEventToPR(evt, source);
        if (result.ok) {
          console.log(`   ✅ PR created: ${result.prUrl}`);
          sourceReport.events.push({ id: evt["@id"], name: evt.name, status: "pr_created", prUrl: result.prUrl });
        } else {
          console.warn(`   ❌ Failed to create PR for ${evt["@id"]}: ${result.error}`);
          sourceReport.events.push({ id: evt["@id"], name: evt.name, status: "error", error: result.error });
        }
      }

      sourceReport.status = "ok";
    } catch (err) {
      console.error(`❌ Error processing source ${source.id}:`, err.message);
      sourceReport.status = "error";
      sourceReport.errors.push(err.message);
    }

    report.sources.push(sourceReport);
  }

  // Write report artifact
  writeFileSync(".aggregator-report.json", JSON.stringify(report, null, 2), "utf8");
  console.log(`\n══════════════════════════════════════`);
  console.log(`Aggregator run complete.`);
  console.log(`Sources processed: ${report.sources.length}`);
  console.log(`Total PRs created: ${report.sources.flatMap((s) => s.events ?? []).filter((e) => e.status === "pr_created").length}`);
}

// ─────────────────────────────────────────────
// Fetch source content
// ─────────────────────────────────────────────

async function fetchSourceContent(source) {
  const { type, url, selector } = source;

  if (type === "url") {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "TheFeed-Aggregator/1.0 (https://thefeed.pages.dev; event-aggregator)",
      },
    });
    if (!res.ok) {
      console.warn(`   Failed to fetch ${url}: HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    // Strip HTML for NLP consumption
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 8000);
  }

  if (type === "rss" || type === "atom") {
    const res = await fetch(url, {
      headers: { "User-Agent": "TheFeed-Aggregator/1.0" },
    });
    if (!res.ok) return null;
    // Return raw XML — NLP handles feed format extraction
    return (await res.text()).substring(0, 8000);
  }

  console.warn(`Unknown source type: ${type}`);
  return null;
}

// ─────────────────────────────────────────────
// NLP Parse
// ─────────────────────────────────────────────

async function parseWithNLP(content, source, apiKey) {
  const nlpUrl = `${NLP_WORKER_URL}/nlp/parse`;
  const res = await fetch(nlpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      text: content,
      context: `Source: ${source.name}. Location context: ${source.locationContext ?? "Canada"}. Target group: ${source.targetGroup}.`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NLP worker error: ${res.status} ${err}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────
// GitHub PR creation
// ─────────────────────────────────────────────

async function submitEventToPR(evt, source) {
  const productionBranch = "main";
  const stagingBranch = "staging";
  const filePath = `ledger/events/staging/${evt["@id"]}.json`;

  const stamped = {
    ...evt,
    _feed: {
      ...evt._feed,
      branch: "staging",
      sourceAuthority: "automated_scraper",
      sourceUrl: source.url,
      updatedAt: new Date().toISOString(),
    },
  };

  const content = Buffer.from(JSON.stringify(stamped, null, 2)).toString("base64");

  // Get HEAD of production branch
  const refRes = await ghApi(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${productionBranch}`);
  if (!refRes.ok) return { ok: false, error: "Could not get branch ref" };
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // Create a branch for this event
  const branchName = `scraper/${source.id}/${evt["@id"].substring(0, 20)}-${Date.now()}`;
  await ghApi(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, "POST", {
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // Write the event file
  await ghApi(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, "PUT", {
    message: `feat(scraper): ${source.id} — add event ${evt["@id"]}`,
    content,
    branch: branchName,
  });

  // Open PR to staging
  const prRes = await ghApi(`repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, "POST", {
    title: `[Scraper: ${source.name}] ${evt.name ?? evt["@id"]}`,
    body: `**Automated scraper submission** from \`${source.name}\`\n\nEvent ID: \`${evt["@id"]}\`\nSource: ${source.url}\nPerformer: ${Array.isArray(evt.performer) ? evt.performer[0]?.name : evt.performer?.name ?? "Unknown"}\nDate: ${evt.startDate}\nVenue: ${evt.location?.name}, ${evt.location?.address?.addressLocality}\n\n> This event has been parsed by the NLP engine and passed brand safety checks. Please review for accuracy before merging to \`${productionBranch}\`.`,
    head: branchName,
    base: stagingBranch,
  });

  if (!prRes.ok) {
    const err = await prRes.text();
    return { ok: false, error: err };
  }

  const pr = await prRes.json();
  return { ok: true, prUrl: pr.html_url };
}

function ghApi(path, method = "GET", body = null) {
  return fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "TheFeed-Aggregator/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

main().catch((err) => {
  console.error("Fatal aggregator error:", err);
  process.exit(1);
});
