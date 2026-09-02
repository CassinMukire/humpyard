// =============================================================================
// Radar fetch — Phase 7 (post-fair)
//
// Per Cassin's v1.6 brief §4: "the radar that feeds" the Morning Queue. The
// skeleton is here; the first real feed (TED EU multilingual) is wired in
// October per the Oct 15 MVP deadline.
//
// What this script does TODAY (2026-09-02, Phase 7 skeleton):
//   1. Loads feed configs from env: TED_EU_API_KEY, EXA_API_KEY, etc.
//   2. For each enabled feed, runs the corresponding fetcher function.
//   3. Normalises the raw output to the Signal shape and ingests via
//      store-factory.upsertSignal (idempotent on source+external_id).
//   4. Prints a summary: per-feed ingested/skipped/error counts.
//
// What this script does NOT do (intentional):
//   - No actual feed HTTP calls yet. The fetcher functions return a
//     `not_implemented` result so the operator sees the wiring is live
//     but knows the data path is gated on Oct 15 wiring.
//   - No LLM call to parse the feed. Per v1.6 §3: "radar beats encyclopedia"
//     means the feed itself is the source of truth (SourcedFact.confidence
//     stays at [O] or [V] for primary tender pages).
//   - No operator approval step. The whole point of a radar is that items
//     flow in; humans review the radar page, not the fetcher.
//
// USAGE:
//   pnpm run radar:fetch                       # dry run: print feed status
//   pnpm run radar:fetch --feed=ted_eu --demo  # ingest 2 demo signals for
//                                              # the ted_eu feed (no API call)
//   pnpm run radar:fetch --feed=exa --query=…  # (Oct 15) hit EXA for a query
//
// In demo mode the signals are tagged "DEMO seed — not real" in `notes` so
// they never get promoted to a real Play without the operator noticing.
// =============================================================================

import { readFile } from "node:fs/promises";
import { upsertSignal, isDemoMode } from "../artifacts/api-server/src/lib/store-factory";
import type { Signal } from "@workspace/api-zod";

const args = process.argv.slice(2);
const feed = args.find((a) => a.startsWith("--feed="))?.split("=")[1];
const demo = args.includes("--demo");
const query = args.find((a) => a.startsWith("--query="))?.split("=").slice(1).join("=");
const jsonInput = args.find((a) => a.endsWith(".json"));

// ---- Feed registry -----------------------------------------------------

interface FeedConfig {
  source: Signal["source"];
  enabled: boolean;
  reason: string;
}

function getFeedStatus(): Record<string, FeedConfig> {
  return {
    ted_eu: {
      source: "ted_eu",
      enabled: !!process.env["TED_EU_API_KEY"],
      reason: process.env["TED_EU_API_KEY"]
        ? "TED_EU_API_KEY set"
        : "no TED_EU_API_KEY (wire in October per Oct 15 MVP)",
    },
    cupt_feniks: {
      source: "cupt_feniks",
      enabled: false,
      reason: "no public API; manual scrape or RSS once wired",
    },
    eradis: {
      source: "eradis",
      enabled: false,
      reason: "ERA ERADIS portal requires auth token; not yet configured",
    },
    utk: {
      source: "utk",
      enabled: false,
      reason: "UTK stacje rozrządowe registry; manual export per quarter",
    },
    zakazky_sz: {
      source: "zakazky_sz",
      enabled: false,
      reason: "zakazky.spravazeleznic.cz RSS; wire in October",
    },
    vaylavirasto: {
      source: "vaylavirasto",
      enabled: !!process.env["EXA_API_KEY"],
      reason: process.env["EXA_API_KEY"]
        ? "EXA API key set — fetcher can query Väylävirasto"
        : "no EXA_API_KEY (EXA fallback for FI search)",
    },
    exa: {
      source: "exa",
      enabled: !!process.env["EXA_API_KEY"],
      reason: process.env["EXA_API_KEY"]
        ? "EXA_API_KEY set — wired"
        : "no EXA_API_KEY (post-fair primary feed)",
    },
  };
}

// ---- Feed fetchers -----------------------------------------------------
// These are the per-feed entry points. Each returns a list of raw items
// that get normalised to Signal shape and ingested. For Phase 7 they
// return empty arrays; the wiring is the point.

interface RawFeedItem {
  external_id: string;
  url: string;
  title: string;
  body: string;
  posted_at: string | null;
  market_id: string | null;
}

async function fetchTedEu(_query?: string): Promise<RawFeedItem[]> {
  // TODO Oct 15: hit https://api.ted.europa.eu/v3/notices/search with
  // multilingual query terms (górka rozrządowa, spádoviště, Rangierbahnhof,
  // Gleisbremse, etc.) per Cassin's v1.6 brief §4.
  return [];
}

async function fetchExa(_query?: string): Promise<RawFeedItem[]> {
  // TODO Oct 15: hit https://api.exa.ai/search with the operator's query.
  return [];
}

async function fetchZakazkySz(_query?: string): Promise<RawFeedItem[]> {
  // TODO Oct 15: scrape https://zakazky.spravazeleznic.cz RSS.
  return [];
}

// ---- Normalisation + ingest --------------------------------------------

const RETRIEVED_AT = new Date().toISOString();

function rawToSignal(source: Signal["source"], raw: RawFeedItem): Signal {
  return {
    id: `sig_${source}_${raw.external_id}`,
    source,
    external_id: raw.external_id,
    url: raw.url,
    title: raw.title,
    summary: {
      value: raw.body,
      source_url: raw.url,
      retrieved_at: RETRIEVED_AT,
      confidence: "O", // Feed items are [O] until a human reviews them.
      verified_by: "rule",
    },
    market_id: raw.market_id,
    posted_at: raw.posted_at,
    fetched_at: RETRIEVED_AT,
    status: "new",
    promoted_to_play_id: null,
    dismissed_reason: null,
    notes: null,
  };
}

async function ingestDemoSignals(): Promise<number> {
  // Two demo signals so the operator can verify the radar page renders,
  // the badge colors work, and the promote/dismiss buttons are wired.
  // These are CLEARLY marked as demo in `notes` so they never get
  // promoted to a real Play without the operator noticing.
  const demoItems: { source: Signal["source"]; raw: RawFeedItem }[] = [
    {
      source: feed ? (feed as Signal["source"]) : "ted_eu",
      raw: {
        external_id: "DEMO-2026-001",
        url: "https://www.example.com/tender/DEMO-2026-001",
        title: "DEMO: Fictional tender for Ostrava hump yard track brakes",
        body: "DEMO seed signal — not a real feed item. Used to verify the radar UI renders correctly. Delete via Dismiss before any real work begins.",
        posted_at: new Date().toISOString(),
        market_id: "cz",
      },
    },
    {
      source: feed ? (feed as Signal["source"]) : "exa",
      raw: {
        external_id: "DEMO-2026-002",
        url: "https://www.example.com/news/DEMO-2026-002",
        title: "DEMO: Fictional press release about Tampere arrival-yard",
        body: "DEMO seed signal — not a real feed item. Verifies the EXA fetcher wiring. Delete via Dismiss.",
        posted_at: new Date().toISOString(),
        market_id: "fi",
      },
    },
  ];

  let count = 0;
  for (const { source, raw } of demoItems) {
    const sig = rawToSignal(source, raw);
    sig.notes = "DEMO seed — not a real feed item. Dismiss before real work.";
    await upsertSignal(sig);
    count++;
  }
  return count;
}

async function main(): Promise<void> {
  if (isDemoMode() && !demo) {
    console.error("FATAL: store-factory is in demo mode. Set DATABASE_URL or unset ALLOW_DEMO_STORE.");
    console.error("       (Or pass --demo to ingest demo-only signals without a DB write.)");
    process.exit(1);
  }

  // JSON import path: --json-input=path/to/file.json
  // The file is { "items": [{ source, external_id, url, title, body, market_id, posted_at }, ...] }
  if (jsonInput) {
    const raw = JSON.parse(await readFile(jsonInput, "utf8")) as { items: RawFeedItem[] };
    const src = (feed ?? "manual") as Signal["source"];
    let ingested = 0;
    for (const item of raw.items) {
      await upsertSignal(rawToSignal(src, item));
      ingested++;
    }
    console.log(`radar-fetch: imported ${ingested} signals from ${jsonInput} (source=${src})`);
    return;
  }

  // Status dry-run
  const status = getFeedStatus();
  if (!feed && !demo) {
    console.log("radar-fetch: DRY RUN (no --feed or --demo passed)\n");
    console.log("Feed status:");
    for (const [name, cfg] of Object.entries(status)) {
      const tag = cfg.enabled ? "✅ enabled" : "⚪ not wired";
      console.log(`  ${name.padEnd(12)} ${tag.padEnd(20)} ${cfg.reason}`);
    }
    console.log("\nUsage:");
    console.log("  pnpm run radar:fetch --feed=ted_eu --demo    # ingest 2 demo signals");
    console.log("  pnpm run radar:fetch --feed=ted_eu          # real fetch (Oct 15)");
    console.log("  pnpm run radar:fetch --json-input=path      # import a JSON file");
    return;
  }

  if (demo) {
    const n = await ingestDemoSignals();
    console.log(`radar-fetch: ingested ${n} demo signals. Dismiss them via the radar page before real work.`);
    return;
  }

  // Real fetch path
  const f = feed as string;
  let items: RawFeedItem[] = [];
  switch (f) {
    case "ted_eu":
      items = await fetchTedEu(query);
      break;
    case "exa":
      items = await fetchExa(query);
      break;
    case "zakazky_sz":
      items = await fetchZakazkySz(query);
      break;
    default:
      console.error(`radar-fetch: feed '${f}' is not implemented yet.`);
      console.error("             Enable status: see the dry-run output above.");
      process.exit(2);
  }

  let ingested = 0;
  for (const item of items) {
    await upsertSignal(rawToSignal(f as Signal["source"], item));
    ingested++;
  }
  console.log(`radar-fetch: ingested ${ingested} signals from feed=${f}${query ? ` query=${query}` : ""}`);
}

main().catch((err) => {
  console.error("radar-fetch FAILED:", err);
  process.exit(1);
});
