#!/usr/bin/env node
/**
 * THE FEED — Ledger Index Rebuilder
 * Rebuilds ledger/events/production/index.json from all .json
 * files in the production events directory.
 *
 * Run after merging new events to main branch.
 * Called automatically by the GitHub Actions validate-and-merge.yml workflow.
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTION_DIR = join(__dirname, "../ledger/events/production");
const INDEX_FILE = join(PRODUCTION_DIR, "index.json");

const files = readdirSync(PRODUCTION_DIR).filter(
  (f) => f.endsWith(".json") && f !== "index.json" && f.startsWith("evt_")
);

const events = [];

for (const file of files) {
  const filePath = join(PRODUCTION_DIR, file);
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    events.push({
      id: data["@id"],
      name: data.name,
      startDate: data.startDate,
      city: data.location?.address?.addressLocality,
      region: data.location?.address?.addressRegion,
      scope: data._feed?.scope,
      targetGroups: data._feed?.targetGroups ?? [],
      updatedAt: data._feed?.updatedAt,
    });
  } catch (err) {
    console.warn(`Warning: Could not read ${file}: ${err.message}`);
  }
}

// Sort chronologically
events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

const index = {
  generatedAt: new Date().toISOString(),
  count: events.length,
  events: events.map((e) => e.id),
  summary: events,
};

writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");
console.log(`✅ Rebuilt index with ${events.length} events → ${INDEX_FILE}`);
