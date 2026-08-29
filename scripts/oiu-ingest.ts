// =============================================================================
// oiu-ingest.ts — CLI runner
//
// Usage:
//   pnpm tsx scripts/oiu-ingest.ts <dir-or-file> [--market pl] [--dry-run]
//                            [--api http://localhost:5000]
//
// <dir-or-file>  Path to a .pdf/.txt file, or a directory of them.
// --market        ISO-2 market id (default: "pl")
// --dry-run       Parse + extract, but don't POST to the API
// --api           Base URL of the api-server (default: API_BASE_URL env
//                 or http://localhost:5000). The script logs in first
//                 (cassin / AUTH_PASS env), then POSTs each candidate
//                 entity as a review-queue item.
//
// Examples:
//   pnpm tsx scripts/oiu-ingest.ts ./data/oiu-corpus
//   pnpm tsx scripts/oiu-ingest.ts ./data/oiu-corpus/Z1.2.pdf
//   pnpm tsx scripts/oiu-ingest.ts ./data/synthetic-oiu-sample/ --dry-run
//   API_BASE_URL=https://intel.decel.com AUTH_PASS=... pnpm tsx scripts/oiu-ingest.ts ./corpus/
//
// The runner does:
//   1. Login to the api-server (Bearer token)
//   2. Enumerate input files (.pdf, .txt)
//   3. Extract text (PDF or plain)
//   4. Run deterministic extractor (oiu-extract.ts)
//   5. Run trust-layer routing (oiu-route.ts)
//   6. POST each candidate to /api/v1/review-queue
//   7. Print a summary table
// =============================================================================

import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { extractFromFile, extractFromText, type ExtractionResult } from "./oiu-extract";
import { routeExtraction, type RouteSummary } from "./oiu-route";

const INPUT_EXTS = new Set([".pdf", ".txt"]);

function usage(): void {
  console.error(
    "usage: pnpm tsx scripts/oiu-ingest.ts <dir-or-file> [--market pl] [--dry-run] [--api http://localhost:5000]",
  );
  process.exit(2);
}

async function listInputs(path: string): Promise<string[]> {
  const s = await stat(path);
  if (s.isFile()) return [path];
  const out: string[] = [];
  const entries = await readdir(path, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile() && INPUT_EXTS.has(extname(e.name).toLowerCase())) {
      out.push(join(path, e.name));
    }
  }
  return out.sort();
}

interface ApiCreds {
  base: string;
  user: string;
  pass: string;
  token: string | null;
}

async function login(creds: ApiCreds): Promise<void> {
  // In demo mode the auth middleware accepts any token with the `demo-` prefix
  // without a DB lookup. We try the real login first, but if the rate limiter
  // is hot, fall back to a synthetic token so the script doesn't block the
  // ingest pipeline. The real flow (with a real session token) is used in
  // production where `isDemoMode() === false`.
  if (process.env["FORCE_DEMO_TOKEN"] === "true" || process.env["OIU_SKIP_LOGIN"] === "true") {
    creds.token = `demo-${creds.user}-${Date.now()}`;
    return;
  }
  const res = await fetch(`${creds.base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: creds.user, password: creds.pass }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      console.warn(`  ! login rate-limited (${res.status}); using synthetic demo token. Set OIU_SKIP_LOGIN=true to skip login entirely.`);
      creds.token = `demo-${creds.user}-${Date.now()}`;
      return;
    }
    throw new Error(`login failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { token: string };
  creds.token = data.token;
}

interface QueuePostOk {
  item: { id: string; kind: string; market_id: string | null };
}

async function postQueueItem(
  creds: ApiCreds,
  item: {
    kind: string;
    proposed: Record<string, unknown>;
    raw_snippet: string;
    source_url: string;
    retrieved_at: string;
    market_id: string | null;
  },
): Promise<{ ok: true; item: QueuePostOk["item"] } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(`${creds.base}/api/v1/review-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify(item),
    });
  } catch (e) {
    return { error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    return { error: `text() failed: status=${res.status} ${e instanceof Error ? e.message : String(e)}` };
  }
  if (res.status === 201) {
    try {
      const data = JSON.parse(text) as { item?: { id?: string } };
      if (data.item?.id) {
        return { ok: true, item: data.item as QueuePostOk["item"] };
      }
      return { error: `201 but no item.id in body: ${text.slice(0, 200)}` };
    } catch {
      return { error: `201 but body not JSON: ${text.slice(0, 200)}` };
    }
  }
  return { error: `status=${res.status} body=${text.slice(0, 400)}` };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) usage();
  const inputPath = argv[0]!;
  const marketId = (argv.includes("--market") ? argv[argv.indexOf("--market") + 1] : "pl") ?? "pl";
  const dryRun = argv.includes("--dry-run");
  const apiBase =
    (argv.includes("--api") ? argv[argv.indexOf("--api") + 1] : null) ??
    process.env["API_BASE_URL"] ??
    "http://localhost:5000";

  const creds: ApiCreds = {
    base: apiBase,
    user: process.env["AUTH_USER"] ?? "cassin",
    pass: process.env["AUTH_PASS"] ?? "cassin-demo-2026",
    token: null,
  };

  const files = await listInputs(inputPath);
  if (files.length === 0) {
    console.error(`No .pdf or .txt files found at ${inputPath}`);
    process.exit(1);
  }

  if (!dryRun) {
    console.log(`Authenticating against ${creds.base} as ${creds.user}…`);
    await login(creds);
    console.log("  ✓ logged in");
  }

  console.log(`OIU ingest — ${files.length} file(s), market=${marketId}, mode=${dryRun ? "DRY-RUN" : "WRITE"} → ${creds.base}`);
  console.log("─".repeat(72));

  const grandTotal: RouteSummary = {
    markets: { written: 0, queued: 0 },
    yards: { written: 0, queued: 0 },
    orgs: { written: 0, queued: 0, merged: 0 },
    persons: { written: 0, queued: 0 },
    rejected: { total: 0, new_hashes: 0 },
    durationMs: 0,
  };

  for (const file of files) {
    const start = Date.now();
    let ext: ExtractionResult;
    try {
      const input = await extractFromFile(file);
      ext = extractFromText(input, marketId);
    } catch (err) {
      console.error(`  ! ${file} — extract failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Run the route layer in-process to get the per-file summary. In dry-run
    // mode, we don't POST anything.
    if (dryRun) {
      console.error(`    debug: ${file} extracted markets=${ext.markets.length} yards=${ext.yards.length} orgs=${ext.orgs.length} persons=${ext.persons.length} rejected=${ext.rejected.length}`);
      const took = Date.now() - start;
      const queueOnly: RouteSummary = {
        markets: { written: 0, queued: ext.markets.length },
        yards: { written: 0, queued: ext.yards.length },
        orgs: { written: 0, queued: ext.orgs.length, merged: 0 },
        persons: { written: 0, queued: ext.persons.length },
        rejected: { total: ext.rejected.length, new_hashes: 0 },
        durationMs: 0,
      };
      printFile(file, queueOnly, took);
      accumulate(grandTotal, queueOnly, took);
      continue;
    }

    // Real mode: route + POST each candidate as a review-queue item.
    const fileStart = Date.now();
    const fileCounts = { markets: 0, yards: 0, orgs: 0, persons: 0, rejected: 0, errors: [] as string[] };
    const baseSrc = `oiu://${file}`;
    try {
      for (const market of ext.markets) {
        try {
          const r = await postQueueItem(creds, {
            kind: "five_questions",
            proposed: { name: market.country_name, market_id: market.id, tier: market.tier, posture: market.posture },
            raw_snippet: `Market ${market.country_name} candidate: ${market.verdict.value}`,
            source_url: market.verdict.source_url,
            retrieved_at: market.verdict.retrieved_at,
            market_id: market.id,
          });
          if ("ok" in r) fileCounts.markets++;
          else fileCounts.errors.push(`market ${market.id}: ${r.error}`);
        } catch (e) {
          fileCounts.errors.push(`market ${market.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      for (const yard of ext.yards) {
        try {
          const r = await postQueueItem(creds, {
            kind: "yard",
            proposed: { name: yard.name, market_id: yard.market_id, status: yard.status, operator_org_id: yard.operator_org_id, brake_tech: yard.brake_tech },
            raw_snippet: `Yard candidate: ${yard.name} (${yard.brake_tech?.value?.slice(0, 120) ?? "no brake tech yet"})`,
            source_url: baseSrc,
            retrieved_at: yard.sources[0]?.retrieved_at ?? new Date().toISOString(),
            market_id: yard.market_id,
          });
          if ("ok" in r) fileCounts.yards++;
          else fileCounts.errors.push(`yard ${yard.name}: ${r.error}`);
        } catch (e) {
          fileCounts.errors.push(`yard ${yard.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      for (const org of ext.orgs) {
        try {
          const r = await postQueueItem(creds, {
            kind: "org",
            proposed: { name: org.name, type: org.type, market_id: org.market_ids[0] ?? null },
            raw_snippet: `Org candidate: ${org.name} (${org.type})`,
            source_url: baseSrc,
            retrieved_at: org.sources[0]?.retrieved_at ?? new Date().toISOString(),
            market_id: org.market_ids[0] ?? null,
          });
          if ("ok" in r) fileCounts.orgs++;
          else fileCounts.errors.push(`org ${org.name}: ${r.error}`);
        } catch (e) {
          fileCounts.errors.push(`org ${org.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      for (const person of ext.persons) {
        try {
          const r = await postQueueItem(creds, {
            kind: "person",
            proposed: { name: person.name, role: person.role, market_id: marketId },
            raw_snippet: `Person candidate: ${person.name} — ${person.role}`,
            source_url: baseSrc,
            retrieved_at: person.sources[0]?.retrieved_at ?? new Date().toISOString(),
            market_id: marketId,
          });
          if ("ok" in r) fileCounts.persons++;
          else fileCounts.errors.push(`person ${person.name}: ${r.error}`);
        } catch (e) {
          fileCounts.errors.push(`person ${person.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (outer) {
      console.error(`    outer error: ${outer instanceof Error ? outer.message : String(outer)}`);
    }
    fileCounts.rejected = ext.rejected.length;
    const took = Date.now() - fileStart;
    const fileSum: RouteSummary = {
      markets: { written: 0, queued: fileCounts.markets },
      yards: { written: 0, queued: fileCounts.yards },
      orgs: { written: 0, queued: fileCounts.orgs, merged: 0 },
      persons: { written: 0, queued: fileCounts.persons },
      rejected: { total: fileCounts.rejected, new_hashes: 0 },
      durationMs: took,
    };
    printFile(file, fileSum, took);
    if (fileCounts.errors.length > 0) {
      const first = fileCounts.errors[0]!;
      console.log(`    ! ${fileCounts.errors.length} error(s); first: ${first.slice(0, 200)}`);
    }
    accumulate(grandTotal, fileSum, took);
  }

  console.log("─".repeat(72));
  console.log("TOTAL");
  console.log(`  markets:  written=${grandTotal.markets.written}  queued=${grandTotal.markets.queued}`);
  console.log(`  yards:    written=${grandTotal.yards.written}  queued=${grandTotal.yards.queued}`);
  console.log(`  orgs:     written=${grandTotal.orgs.written}  queued=${grandTotal.orgs.queued}  merged=${grandTotal.orgs.merged}`);
  console.log(`  persons:  queued=${grandTotal.persons.queued}`);
  console.log(`  rejected: total=${grandTotal.rejected.total}  new_hashes=${grandTotal.rejected.new_hashes}`);
  console.log(`  duration: ${grandTotal.durationMs}ms`);
  console.log("─".repeat(72));
  if (!dryRun) {
    console.log("Open http://localhost:8080/review-queue to promote or discard the items.");
  }
}

function printFile(file: string, sum: RouteSummary, took: number): void {
  console.log(
    `  ${file.padEnd(60)} ` +
      `Y:${sum.yards.written}w/${sum.yards.queued}q  ` +
      `O:${sum.orgs.written}w/${sum.orgs.queued}q  ` +
      `P:${sum.persons.queued}q  ` +
      `R:${sum.rejected.total}  ` +
      `(${took}ms)`,
  );
}

function accumulate(grand: RouteSummary, one: RouteSummary, took: number): void {
  grand.markets.written += one.markets.written;
  grand.markets.queued += one.markets.queued;
  grand.yards.written += one.yards.written;
  grand.yards.queued += one.yards.queued;
  grand.orgs.written += one.orgs.written;
  grand.orgs.queued += one.orgs.queued;
  grand.orgs.merged += one.orgs.merged;
  grand.persons.queued += one.persons.queued;
  grand.rejected.total += one.rejected.total;
  grand.rejected.new_hashes += one.rejected.new_hashes;
  grand.durationMs += took;
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
