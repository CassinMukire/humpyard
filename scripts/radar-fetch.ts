// =============================================================================
// Radar fetch — Phase 7 (post-fair) — REAL DATA ONLY
//
// Per Cassin's v1.6 brief §4: "the radar that feeds" the Morning Queue.
// Per Hitank (2026-09-02): no demo, no fake signals, real time.
//
// What this script does:
//   1. Hits EXA search for hump-yard-related queries (multilingual per the
//      brief: górka rozrządowa, kolejové brzdy, Rangierbahnhof, Gleisbremse,
//      hump yard, etc.). EXA is the post-fair primary feed (v1.6 §4).
//   2. Normalises each EXA result to the Signal shape and ingests via
//      store-factory.upsertSignal (idempotent on source+external_id).
//   3. Prints a summary: per-feed ingested/skipped/error counts.
//
// What this script does NOT do (intentional):
//   - No demo mode. No fake signals. No "seed" flag. The only way data
//     lands in the signals table is via a live EXA query.
//   - No LLM call to parse the feed. Per v1.6 §3: "radar beats encyclopedia"
//     means the feed itself is the source of truth (SourcedFact.confidence
//     stays at [O] or [V] for primary tender pages).
//   - No operator approval step. The whole point of a radar is that items
//     flow in; humans review the radar page, not the fetcher.
//
// USAGE:
//   pnpm run radar:fetch                       # run all enabled feeds
//   pnpm run radar:fetch --feed=exa            # run only EXA
//   pnpm run radar:fetch --feed=ted_eu         # run only TED EU
//
// The first EXA query run against the live API will be the smoke test.
// Cost: ~$0.04–0.10 per query (v1.6 brief §2 D1 + the cost ceiling).
// =============================================================================

import { upsertSignal, isDemoMode } from "../artifacts/api-server/src/lib/store-factory";
import type { Signal } from "@workspace/api-zod";

const args = process.argv.slice(2);
const feed = args.find((a) => a.startsWith("--feed="))?.split("=")[1];

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
        : "no TED_EU_API_KEY (wire it in October per Oct 15 MVP — TED multilingual endpoint requires API key)",
    },
    exa: {
      source: "exa",
      enabled: !!process.env["EXA_API_KEY"],
      reason: process.env["EXA_API_KEY"]
        ? "EXA_API_KEY set — live search enabled"
        : "no EXA_API_KEY (EXA is the post-fair primary feed per v1.6 §4)",
    },
  };
}

// ---- EXA fetcher (real HTTP call) ---------------------------------------

interface ExaResult {
  title: string;
  url: string;
  id?: string;
  publishedDate?: string;
  text?: string;
  score?: number;
}

interface ExaSearchResponse {
  requestId?: string;
  results: ExaResult[];
}

async function fetchExa(query: string, numResults = 8): Promise<ExaResult[]> {
  const apiKey = process.env["EXA_API_KEY"];
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not set — cannot run real-time search");
  }
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      numResults,
      useAutoprompt: true,
      type: "auto",
      contents: { text: { maxCharacters: 1500 } },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EXA search failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as ExaSearchResponse;
  return json.results ?? [];
}

// ---- TED EU fetcher (real HTTP call, Oct 15 wiring) --------------------

async function fetchTedEu(query: string): Promise<ExaResult[]> {
  const apiKey = process.env["TED_EU_API_KEY"];
  if (!apiKey) {
    throw new Error("TED_EU_API_KEY is not set — TED EU search requires API key (get one at op.europa.eu/development/apis)");
  }
  // TED EU v3 search — multilingual query terms per Cassin's brief §4
  // Endpoint per https://api.ted.europa.eu/v3/notices/search
  const res = await fetch("https://api.ted.europa.eu/v3/notices/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `(${query}) AND (ND IN ('hump yard','Rangierbahnhof','górka rozrządowa','spádoviště','kolejové brzdy','Gleisbremse','hamulce torowe') OR CPV IN ('34632000','45234100','45234110','45234120'))`,
      limit: 20,
      scope: "ACTIVE",
      sortBy: "PUBLICATION_DATE",
      sortOrder: "DESC",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TED EU search failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { notices?: Array<{ noticeId: string; title: string; url: string; publicationDate: string; description?: string }> };
  return (json.notices ?? []).map((n) => ({
    title: n.title,
    url: n.url,
    id: n.noticeId,
    publishedDate: n.publicationDate,
    text: n.description ?? "",
  }));
}

// ---- Normalisation + ingest --------------------------------------------

const RETRIEVED_AT = new Date().toISOString();

function rawToSignal(source: Signal["source"], raw: ExaResult, marketId: string | null = null): Signal {
  // External ID: use feed-provided id if present, otherwise hash the URL so
  // the same URL never creates duplicate signals.
  const externalId = raw.id ?? raw.url;
  const body = raw.text?.slice(0, 1500) ?? raw.title;
  return {
    id: `sig_${source}_${externalId.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120)}`,
    source,
    external_id: externalId,
    url: raw.url,
    title: raw.title,
    summary: {
      value: body,
      source_url: raw.url,
      retrieved_at: RETRIEVED_AT,
      // EXA results are [O] (secondary, aggregator) until a human verifies
      // the underlying page is the primary tender. TED EU notice pages are
      // the primary source, so they get [V] on first ingest.
      confidence: source === "ted_eu" ? "V" : "O",
      verified_by: source === "ted_eu" ? "rule" : "rule",
    },
    market_id: marketId,
    posted_at: raw.publishedDate ?? null,
    fetched_at: RETRIEVED_AT,
    status: "new",
    promoted_to_play_id: null,
    dismissed_reason: null,
    notes: null,
  };
}

// Default query set per Cassin's v1.6 brief §4 — multilingual terms
const EXA_QUERIES: Array<{ query: string; market: string | null }> = [
  { query: "hump yard modernization tender 2026 OR 2027 retarder", market: null },
  { query: "PKP PLK Idzikowice Karsznice Łódź Olechów track brake", market: "pl" },
  { query: "SŽ Ostrava hump yard kolejové brzdy spádoviště MORAVIA CONSULT", market: "cz" },
  { query: "Väylävirasto Tampere arrival yard hankintaohjelma 2026", market: "fi" },
  { query: "ÖBB Rangierbahnhof Gleisbremse Rahmenplan 2026 OR 2027", market: "at" },
  { query: "KTZ Kazakhstan hump yard retarder 2026 tender", market: "middle-corridor" },
];

const TED_EU_QUERIES: Array<{ query: string; market: string | null }> = [
  { query: 'NOTICE_TYPE IN ("tender") AND ("hump yard" OR "Rangierbahnhof" OR "górka rozrządowa" OR "spádoviště" OR "Gleisbremse" OR "kolejové brzdy")', market: null },
];

async function runFeed(source: Signal["source"], query: string, marketId: string | null): Promise<{ ingested: number; errors: string[] }> {
  const items = source === "exa" ? await fetchExa(query) : await fetchTedEu(query);
  let ingested = 0;
  const errors: string[] = [];
  for (const item of items) {
    try {
      const sig = rawToSignal(source, item, marketId);
      await upsertSignal(sig);
      ingested++;
    } catch (err) {
      errors.push(`${item.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ingested, errors };
}

async function main(): Promise<void> {
  if (isDemoMode()) {
    console.error("FATAL: store-factory is in demo mode. Refusing to ingest real data into an in-memory store.");
    console.error("       Set DATABASE_URL to a real Postgres URL and unset ALLOW_DEMO_STORE.");
    process.exit(1);
  }

  console.log(`[debug] EXA_API_KEY set: ${!!process.env["EXA_API_KEY"]} (length ${process.env["EXA_API_KEY"]?.length ?? 0})`);

  const status = getFeedStatus();
  const requestedFeed = feed as Signal["source"] | undefined;

  if (!requestedFeed) {
    // No --feed specified → run all enabled feeds with their default queries
    let totalIngested = 0;
    let totalErrors = 0;
    for (const [name, cfg] of Object.entries(status)) {
      if (!cfg.enabled) {
        console.log(`[${name}] skipped — ${cfg.reason}`);
        continue;
      }
      const queries = name === "exa" ? EXA_QUERIES : TED_EU_QUERIES;
      console.log(`[${name}] running ${queries.length} query(ies)…`);
      for (const { query, market } of queries) {
        try {
          const { ingested, errors } = await runFeed(name as Signal["source"], query, market);
          console.log(`  [${name}] "${query.slice(0, 60)}…" → ${ingested} ingested, ${errors.length} errors`);
          totalIngested += ingested;
          totalErrors += errors.length;
        } catch (err) {
          console.error(`  [${name}] "${query.slice(0, 60)}…" → FETCH FAILED: ${err instanceof Error ? err.message : err}`);
          totalErrors++;
        }
      }
    }
    console.log(`\nradar-fetch: ${totalIngested} signals ingested, ${totalErrors} errors`);
    if (totalIngested === 0) {
      console.log("  no new signals — check feed status above + EXA_API_KEY / TED_EU_API_KEY env vars");
    }
    return;
  }

  // Single feed mode
  const cfg = status[requestedFeed];
  if (!cfg) {
    console.error(`FATAL: unknown feed '${requestedFeed}'. Available: ${Object.keys(status).join(", ")}`);
    process.exit(2);
  }
  if (!cfg.enabled) {
    console.error(`FATAL: feed '${requestedFeed}' is not enabled — ${cfg.reason}`);
    process.exit(2);
  }
  const queries = requestedFeed === "exa" ? EXA_QUERIES : TED_EU_QUERIES;
  let totalIngested = 0;
  for (const { query, market } of queries) {
    try {
      const { ingested, errors } = await runFeed(requestedFeed, query, market);
      console.log(`[${requestedFeed}] "${query.slice(0, 60)}…" → ${ingested} ingested, ${errors.length} errors`);
      if (errors.length > 0) {
        for (const e of errors) console.log(`    err: ${e}`);
      }
      totalIngested += ingested;
    } catch (err) {
      console.error(`[${requestedFeed}] "${query.slice(0, 60)}…" → FETCH FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\nradar-fetch: ${totalIngested} signals ingested from feed=${requestedFeed}`);
}

main().catch((err) => {
  console.error("radar-fetch FAILED:", err);
  process.exit(1);
});
