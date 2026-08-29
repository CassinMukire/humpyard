// =============================================================================
// oiu-route.ts — candidates → SourcedFacts → store or review queue
//
// For each candidate entity, this layer:
//   1. Checks the trust layer for the source URL (primary whitelist = [V])
//   2. Cross-references with data/aliases.yaml to merge org names
//   3. Routes to the right store action:
//        [V]    → upsert (write to markets/yards/orgs/persons)
//        [O]/[I] → addToReviewQueue (operator confirms later)
//        junk   → recordRejection (never seen again)
//
// Uses the same store-factory as the API, so a run against demo-store looks
// identical to a run against a real Postgres-backed store.
// =============================================================================

import type { Market, Yard, Org, Person, SourcedFact } from "@workspace/api-zod";
import { readFile } from "node:fs/promises";
import {
  upsertMarket,
  upsertYard,
  upsertOrg,
  upsertPerson,
  addToReviewQueue,
  isRejectedContent,
  recordRejection,
} from "../artifacts/api-server/src/lib/store-factory";
import { isPrimaryDomain } from "../artifacts/api-server/src/lib/trust-layer";
import type { ExtractionResult } from "./oiu-extract";

export interface RouteSummary {
  markets: { written: number; queued: number };
  yards: { written: number; queued: number };
  orgs: { written: number; queued: number; merged: number };
  persons: { written: number; queued: number };
  rejected: { total: number; new_hashes: number };
  durationMs: number;
}

interface AliasEntry {
  canonical: string;
  match_key: string;
  type: Org["type"];
  market_ids: string[];
  aliases: string[];
}

async function loadAliases(): Promise<AliasEntry[]> {
  const raw = await readFile("data/aliases.yaml", "utf8");
  // Naive YAML parser — only the shape we control (no nested keys, no anchors).
  const entries: AliasEntry[] = [];
  const blocks = raw.split(/^- canonical:/m).slice(1);
  for (const block of blocks) {
    const out: Partial<AliasEntry> = {};
    const canonicalLine = block.split("\n", 1)[0]?.trim() ?? "";
    out.canonical = canonicalLine;
    const lines = block.split("\n");
    const aliasLines: string[] = [];
    let inAliases = false;
    for (const line of lines) {
      const stripped = line.replace(/^ {2}/, "");
      if (stripped.startsWith("match_key:")) {
        out.match_key = String(stripped.split(":", 2)[1] ?? "").trim();
        inAliases = false;
      } else if (stripped.startsWith("type:")) {
        out.type = String(stripped.split(":", 2)[1] ?? "").trim() as Org["type"];
        inAliases = false;
      } else if (stripped.startsWith("market_ids:")) {
        // market_ids: [pl]  OR  market_ids: [pl, de]  OR  market_ids: []
        const arr = String(stripped.split(":", 2)[1] ?? "[]").trim();
        const inside = arr.replace(/^\[|\]$/g, "").trim();
        if (inside === "") {
          out.market_ids = [];
        } else {
          out.market_ids = inside
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
        }
        inAliases = false;
      } else if (stripped.startsWith("aliases:")) {
        inAliases = true;
      } else if (inAliases && stripped.startsWith("- ")) {
        aliasLines.push(stripped.slice(2).replace(/^"|"$/g, ""));
      } else if (inAliases && stripped.trim() === "") {
        inAliases = false;
      }
    }
    out.aliases = aliasLines;
    if (out.canonical && out.match_key && out.type) {
      entries.push(out as AliasEntry);
    }
  }
  return entries;
}

function asciiNormalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pickConfidenceForSource(sourceUrl: string, fallback: SourcedFact["confidence"]): SourcedFact["confidence"] {
  // OIU documents are typically secondary (not the operator's own site).
  // A primary-domain hit (PKP PLK's own page, EU TED, etc.) upgrades to [V].
  try {
    const host = new URL(sourceUrl.startsWith("oiu://") ? `https://example.com/${sourceUrl}` : sourceUrl).hostname;
    if (isPrimaryDomain(host)) return "V";
  } catch {
    /* oiu:// or malformed */
  }
  return fallback;
}

export async function routeExtraction(ext: ExtractionResult): Promise<RouteSummary> {
  const start = Date.now();
  const aliases = await loadAliases();
  const aliasByKey = new Map<string, AliasEntry>(aliases.map((a) => [a.match_key, a]));
  const aliasByName = new Map<string, AliasEntry>(aliases.map((a) => [asciiNormalize(a.canonical), a]));
  for (const a of aliases) {
    for (const alias of a.aliases) {
      aliasByName.set(asciiNormalize(alias), a);
    }
  }

  const summary: RouteSummary = {
    markets: { written: 0, queued: 0 },
    yards: { written: 0, queued: 0 },
    orgs: { written: 0, queued: 0, merged: 0 },
    persons: { written: 0, queued: 0 },
    rejected: { total: 0, new_hashes: 0 },
    durationMs: 0,
  };

  // ---- Markets (only one per run — PL by default) ----
  for (const market of ext.markets) {
    const sourceUrl = market.verdict.source_url;
    const conf = pickConfidenceForSource(sourceUrl, market.verdict.confidence);
    if (conf === "V") {
      const upgraded: Market = { ...market, verdict: { ...market.verdict, confidence: "V" } };
      await upsertMarket(upgraded);
      summary.markets.written++;
    } else {
      await addToReviewQueue({
        kind: "five_questions",
        proposed: { name: market.country_name, market_id: market.id },
        raw_snippet: `Market ${market.country_name} candidate: ${market.verdict.value}`,
        source_url: sourceUrl,
        retrieved_at: market.verdict.retrieved_at,
        market_id: market.id,
      });
      summary.markets.queued++;
    }
  }

  // ---- Yards ----
  for (const yard of ext.yards) {
    const sourceUrl = yard.sources[0]?.source_url ?? "";
    const conf = pickConfidenceForSource(sourceUrl, yard.brake_tech?.confidence ?? "O");
    if (conf === "V") {
      await upsertYard({
        ...yard,
        brake_tech: yard.brake_tech ? { ...yard.brake_tech, confidence: "V" } : null,
        last_modernized: yard.last_modernized ? { ...yard.last_modernized, confidence: "V" } : null,
      });
      summary.yards.written++;
    } else {
      await addToReviewQueue({
        kind: "yard",
        proposed: { name: yard.name, market_id: yard.market_id },
        raw_snippet: `Yard candidate: ${yard.name} (${yard.brake_tech?.value?.slice(0, 120) ?? "no brake tech yet"})`,
        source_url: sourceUrl,
        retrieved_at: yard.sources[0]?.retrieved_at ?? new Date().toISOString(),
        market_id: yard.market_id,
      });
      summary.yards.queued++;
    }
  }

  // ---- Orgs (with alias cross-walk) ----
  for (const org of ext.orgs) {
    // Cross-walk: if the org's match_key matches an alias entry, use that
    // canonical. Otherwise add the new alias.
    const alias = aliasByKey.get(org.match_key);
    const targetName = alias?.canonical ?? org.name;
    const targetKey = alias?.match_key ?? org.match_key;
    if (alias && asciiNormalize(alias.canonical) !== asciiNormalize(org.name)) {
      summary.orgs.merged++;
    }
    const sourceUrl = org.sources[0]?.source_url ?? "";
    const conf = pickConfidenceForSource(sourceUrl, "O");
    if (conf === "V") {
      await upsertOrg({ ...org, name: targetName, match_key: targetKey });
      summary.orgs.written++;
    } else {
      await addToReviewQueue({
        kind: "org",
        proposed: { name: targetName, type: org.type, market_id: org.market_ids[0] ?? null },
        raw_snippet: `Org candidate: ${targetName} (${org.type})`,
        source_url: sourceUrl,
        retrieved_at: org.sources[0]?.retrieved_at ?? new Date().toISOString(),
        market_id: org.market_ids[0] ?? null,
      });
      summary.orgs.queued++;
    }
  }

  // ---- Persons (always [O] from OIU docs; operator confirms in the UI) ----
  for (const person of ext.persons) {
    const sourceUrl = person.sources[0]?.source_url ?? "";
    await addToReviewQueue({
      kind: "person",
      proposed: { name: person.name, role: person.role, market_id: person.import_meta.source_ref },
      raw_snippet: `Person candidate: ${person.name} — ${person.role}`,
      source_url: sourceUrl,
      retrieved_at: person.sources[0]?.retrieved_at ?? new Date().toISOString(),
      market_id: "pl",
    });
    summary.persons.queued++;
  }

  // ---- Junk ----
  for (const r of ext.rejected) {
    const hash = `oiu_junk_${r.kind}_${r.snippet.length}_${r.snippet.slice(0, 32).replace(/\W+/g, "_")}`;
    if (!(await isRejectedContent(hash))) {
      await recordRejection(hash);
      summary.rejected.new_hashes++;
    }
    summary.rejected.total++;
  }

  summary.durationMs = Date.now() - start;
  return summary;
}
