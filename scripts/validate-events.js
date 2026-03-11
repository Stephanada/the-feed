#!/usr/bin/env node
/**
 * THE FEED — Event Validation Script
 * Used by the GitHub Actions CI pipeline to validate changed
 * event JSON files against the Zod schema and check ID integrity.
 *
 * Usage: node scripts/validate-events.js <file1.json> [file2.json ...]
 */

import { readFileSync } from "fs";
import { createHash } from "crypto";
import { EventSchema } from "../ledger/schema.js";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.log("No event files to validate.");
  process.exit(0);
}

let hasErrors = false;
const results = [];

for (const filePath of files) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`❌ [${filePath}] Invalid JSON: ${err.message}`);
    hasErrors = true;
    results.push({ file: filePath, status: "error", error: "Invalid JSON" });
    continue;
  }

  // 1. Verify ID integrity
  const performers = Array.isArray(raw.performer) ? raw.performer : [raw.performer].filter(Boolean);
  const performerName = performers[0]?.name ?? "";
  const datePart = (raw.startDate ?? "").substring(0, 10);
  const venueName = raw.location?.name ?? "";

  const normalize = (s) => String(s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  const hashInput = `${normalize(performerName)}|${normalize(datePart)}|${normalize(venueName)}`;
  const expectedHash = createHash("sha256").update(hashInput, "utf8").digest("hex");
  const expectedId = `evt_${expectedHash}`;

  if (raw["@id"] !== expectedId) {
    console.error(`❌ [${filePath}] ID mismatch!`);
    console.error(`   File declares:  ${raw["@id"]}`);
    console.error(`   Expected:       ${expectedId}`);
    console.error(`   Hash input was: "${hashInput}"`);
    hasErrors = true;
    results.push({ file: filePath, status: "error", error: "ID hash mismatch" });
    continue;
  }

  // 2. Zod schema validation
  const parseResult = EventSchema.safeParse(raw);
  if (!parseResult.success) {
    console.error(`❌ [${filePath}] Schema validation failed:`);
    for (const issue of parseResult.error.issues) {
      console.error(`   • ${issue.path.join(".")} — ${issue.message}`);
    }
    hasErrors = true;
    results.push({
      file: filePath,
      status: "error",
      errors: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
    continue;
  }

  console.log(`✅ [${filePath}] Valid (${raw["@id"]})`);
  results.push({ file: filePath, status: "ok", id: raw["@id"] });
}

// Summary
console.log(`\n──────────────────────────────────`);
console.log(`Validated ${files.length} file(s)`);
console.log(`Passed: ${results.filter((r) => r.status === "ok").length}`);
console.log(`Failed: ${results.filter((r) => r.status === "error").length}`);

if (hasErrors) {
  console.error("\n❌ Validation failed. Please fix the errors above.");
  process.exit(1);
} else {
  console.log("\n✅ All files passed validation.");
  process.exit(0);
}
