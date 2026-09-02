// =============================================================================
// F2b snapshot layer (Cassin v1.6 brief)
//
// "Every claim links to the page evidencing that claim + cached snapshot
//  (§11.1); homepage/Wikipedia ≠ [V]."
//
// v1 ships with this as an on-demand script (not an automatic background
// job) because:
//   1. We don't want N background fetches per fact on seed.
//   2. The audit call ("which sources are stale?") wants a list, not
//      surprise network calls.
//   3. The Sep 4 demo is the cutoff for "freeze gate Sep 18" — running
//      this script once on the live facts gives the demo a coherent
//      snapshot set without putting an orchestrator in the critical path.
//
// USAGE:
//   pnpm tsx scripts/fetch-snapshots.ts [concurrency=4] [max=200]
//
//   - concurrency: parallel fetch limit (default 4)
//   - max: max number of unique URLs to fetch this run (default 200)
//
// SNAPSHOTS are stored at:
//   data/snapshots/<sha256(source_url)>.html
// plus a sidecar index file:
//   data/snapshots/index.json  →  { url, sha256, fetched_at, size_bytes, content_type }
//
// The SourcedFact envelope doesn't currently point at a snapshot — the
// UI links to the live URL. v1.1 (P2) can render a "Cached snapshot"
// link that points at the local file when present.
// =============================================================================

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_DIR = path.join(REPO_ROOT, "data", "snapshots");
const INDEX_PATH = path.join(SNAPSHOT_DIR, "index.json");

interface SnapshotIndex {
  url: string;
  sha256: string;
  fetched_at: string;
  size_bytes: number;
  content_type: string;
}

async function loadIndex(): Promise<SnapshotIndex[]> {
  if (!existsSync(INDEX_PATH)) return [];
  try {
    return JSON.parse(await readFile(INDEX_PATH, "utf8")) as SnapshotIndex[];
  } catch {
    return [];
  }
}

async function saveIndex(idx: SnapshotIndex[]): Promise<void> {
  await writeFile(INDEX_PATH, JSON.stringify(idx, null, 2));
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

// ---------------------------------------------------------------------------
// Collect unique URLs from the live data
// ---------------------------------------------------------------------------

async function collectUrls(): Promise<string[]> {
  // We collect URLs from 3 sources:
  //   1. The Postgres markets.verdict + five_questions[*].source_url
  //   2. The Postgres orgs.sources[].url
  //   3. The Postgres battle_cards.sources[].url
  //
  // For v1 we use the queue-store's exports; the in-memory store
  // exposes the same data via the demo-seed.
  const { listMarkets, listOrgs, listBattleCards } = await import(
    "../artifacts/api-server/src/lib/store-factory.js"
  );
  const urls = new Set<string>();

  for (const m of await listMarkets()) {
    if (m.verdict?.source_url) urls.add(m.verdict.source_url);
    for (const key of Object.keys(m.five_questions ?? {})) {
      const f = m.five_questions?.[key as keyof typeof m.five_questions];
      if (f?.source_url) urls.add(f.source_url);
    }
    for (const s of m.sources ?? []) urls.add(s.url);
  }
  for (const o of await listOrgs()) {
    for (const s of o.sources ?? []) urls.add(s.url);
  }
  for (const c of await listBattleCards()) {
    for (const s of c.sources ?? []) urls.add(s.url);
  }
  return Array.from(urls);
}

// ---------------------------------------------------------------------------
// Fetch with simple retry + timeout
// ---------------------------------------------------------------------------

async function fetchOne(url: string, timeoutMs = 15_000): Promise<{ body: string; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "DECEL-SnapshotFetcher/1.0 (+https://decel.com)",
        accept: "text/html,application/json,text/plain",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      console.log(`  [skip] ${res.status} ${url}`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "text/html";
    const body = await res.text();
    return { body, contentType };
  } catch (err) {
    console.log(`  [err] ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Concurrency-limited worker
// ---------------------------------------------------------------------------

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const inFlight = new Set<Promise<void>>();
  while (queue.length > 0 || inFlight.size > 0) {
    while (inFlight.size < limit && queue.length > 0) {
      const item = queue.shift()!;
      const p = worker(item).then((r) => {
        results.push(r);
      });
      const tracked = p.finally(() => inFlight.delete(tracked));
      inFlight.add(tracked);
    }
    if (inFlight.size > 0) {
      await Promise.race(inFlight);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const concurrency = Number(process.argv[2] ?? "4");
  const max = Number(process.argv[3] ?? "200");

  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const existing = await loadIndex();
  const existingByUrl = new Map(existing.map((e) => [e.url, e]));
  console.log(`F2b snapshot fetch`);
  console.log(`  snapshot dir: ${path.relative(REPO_ROOT, SNAPSHOT_DIR)}`);
  console.log(`  existing snapshots: ${existing.length}`);

  const urls = await collectUrls();
  console.log(`  unique source URLs in live data: ${urls.length}`);

  // Skip already-cached URLs (within 7 days)
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const fresh = urls.filter((u) => {
    const e = existingByUrl.get(u);
    if (!e) return true;
    return Date.now() - new Date(e.fetched_at).getTime() > SEVEN_DAYS;
  }).slice(0, max);
  console.log(`  to fetch (≤${max}): ${fresh.length}`);

  let fetched = 0;
  let skipped = 0;
  let errors = 0;
  await runWithConcurrency(
    fresh,
    async (url) => {
      const result = await fetchOne(url);
      if (!result) {
        errors++;
        return;
      }
      const sha = hashUrl(url);
      const file = path.join(SNAPSHOT_DIR, `${sha}.html`);
      await writeFile(file, result.body, "utf8");
      const st = await stat(file);
      const entry: SnapshotIndex = {
        url,
        sha256: sha,
        fetched_at: new Date().toISOString(),
        size_bytes: st.size,
        content_type: result.contentType,
      };
      existingByUrl.set(url, entry);
      fetched++;
      if (fetched % 10 === 0) {
        await saveIndex(Array.from(existingByUrl.values()));
      }
    },
    concurrency,
  );
  await saveIndex(Array.from(existingByUrl.values()));

  console.log(`\n=== Summary ===`);
  console.log(`  fetched:   ${fetched}`);
  console.log(`  unchanged: ${urls.length - fresh.length}`);
  console.log(`  errors:    ${errors}`);
  console.log(`  total snapshots: ${existingByUrl.size}`);
  console.log(`  index: ${path.relative(REPO_ROOT, INDEX_PATH)}`);
}

main().catch((err) => {
  console.error("Snapshot fetch failed:", err);
  process.exit(1);
});
