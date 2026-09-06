// =============================================================================
// v1/snapshots — F2b snapshot lookup (Cassin v1.6 brief §11.1)
//
// Per Cassin's v1.7 story (Wed scene): "tap a Poland fact → cached source
// snapshot opens, offline, with date". The flow is:
//   1. Background script `pnpm run snapshots:fetch` caches source URLs
//      to data/snapshots/<sha256>.html + data/snapshots/index.json
//   2. Dossier UI calls GET /api/v1/snapshots to load the index
//   3. For each rendered fact, the UI looks up the URL in the index
//   4. If a snapshot exists, the UI renders a "📸 Cached (offline-safe)"
//      badge linking to /snapshots/<sha>.html
//   5. When the user taps the badge, the static HTML opens — works
//      offline (already loaded in the browser cache) or in airplane mode
//      (the offline bundle includes the snapshot files in dist/offline/snapshots/)
//
// The api-server also serves /snapshots/:sha.html directly from
// data/snapshots/ so the live app can show the snapshot without a separate
// server. CSP allows same-origin script execution but the snapshots are
// static HTML, not scripts, so they're fine.
// =============================================================================

import { Router } from "express";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// snapshots/ lives at the repo root: <repo>/data/snapshots/
const SNAPSHOT_DIR = path.resolve(__dirname, "..", "..", "..", "..", "data", "snapshots");
const INDEX_PATH = path.join(SNAPSHOT_DIR, "index.json");

const router = Router();

interface SnapshotIndexEntry {
  url: string;
  sha256: string;
  fetched_at: string;
  size_bytes: number;
  content_type: string;
}

let cache: { loadedAt: number; entries: Map<string, SnapshotIndexEntry> } | null = null;

async function loadIndex(): Promise<Map<string, SnapshotIndexEntry>> {
  // 60s in-memory cache so the dossier page doesn't hit disk on every fact render
  if (cache && Date.now() - cache.loadedAt < 60_000) return cache.entries;
  if (!existsSync(INDEX_PATH)) {
    cache = { loadedAt: Date.now(), entries: new Map() };
    return cache.entries;
  }
  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    const arr = JSON.parse(raw) as SnapshotIndexEntry[];
    cache = { loadedAt: Date.now(), entries: new Map(arr.map((e) => [e.url, e])) };
    return cache.entries;
  } catch {
    cache = { loadedAt: Date.now(), entries: new Map() };
    return cache.entries;
  }
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

// GET /api/v1/snapshots — full index, JSON (for the client to look up per-fact)
router.get("/snapshots", async (_req, res, next) => {
  try {
    const idx = await loadIndex();
    const entries = Array.from(idx.values()).map((e) => ({
      url: e.url,
      sha256: e.sha256,
      fetched_at: e.fetched_at,
      size_bytes: e.size_bytes,
    }));
    res.json({ entries, count: entries.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/snapshots/lookup?url=<encoded-url> — single lookup
// Returns { url, sha256, has_snapshot, snapshot_url, fetched_at, size_bytes }
// 404 if no snapshot exists for the URL. The client uses this for the
// per-fact "Cached" badge.
router.get("/snapshots/lookup", async (req, res, next) => {
  try {
    const url = String(req.query["url"] ?? "").trim();
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    const idx = await loadIndex();
    const entry = idx.get(url);
    if (!entry) {
      res.status(404).json({ error: "no_snapshot", url, has_snapshot: false });
      return;
    }
    res.json({
      url: entry.url,
      sha256: entry.sha256,
      has_snapshot: true,
      snapshot_url: `/snapshots/${entry.sha256}.html`,
      fetched_at: entry.fetched_at,
      size_bytes: entry.size_bytes,
    });
  } catch (err) {
    next(err);
  }
});

export { SNAPSHOT_DIR, INDEX_PATH, hashUrl };
export default router;
