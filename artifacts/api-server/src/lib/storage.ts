// =============================================================================
// Snapshot Store — abstract interface for raw-source caching
//
// Spec reference: §8 risk 3, §11.1, §12.5 (EU/EEA jurisdiction requirement)
//
// Every fact links to a cached snapshot (always works) with the original URL
// alongside. A dead original does not invalidate the fact; it downgrades
// nothing by itself. A weekly link-checker marks each source live/dead.
//
// v1 placeholder: writes to the local filesystem under data/snapshots/. Once
// the storage decision lands (gap #4 — Replit Object Storage vs Cloudflare R2
// vs other), swap the implementation behind this interface.
// =============================================================================

import { promises as fs } from "node:fs";
import path from "node:path";

export interface SnapshotStore {
  /**
   * Persist a raw source snapshot (HTML/JSON/PDF) and return a URL that
   * always works for the lifetime of the fact.
   */
  put(key: string, data: Buffer | string, contentType?: string): Promise<string>;
  /** Read a snapshot back as a Buffer. */
  get(snapshotUrl: string): Promise<Buffer>;
  /** Check existence. */
  exists(snapshotUrl: string): Promise<boolean>;
  /** Mark a source live/dead based on a HEAD check (or no-op for local FS). */
  healthCheck(snapshotUrl: string): Promise<{ live: boolean; checkedAt: string }>;
}

const SNAPSHOTS_DIR =
  process.env["SNAPSHOTS_DIR"] ?? path.resolve(process.cwd(), "data", "snapshots");

class LocalFsSnapshotStore implements SnapshotStore {
  async put(
    key: string,
    data: Buffer | string,
    _contentType?: string,
  ): Promise<string> {
    const safeKey = key.replace(/[^a-zA-Z0-9._/-]/g, "_");
    const fullPath = path.join(SNAPSHOTS_DIR, safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    // The "URL" is the relative path. The API server will serve this under
    // /api/snapshots/* in v1; in production this is replaced with a CDN URL.
    return `/api/snapshots/${safeKey}`;
  }

  async get(snapshotUrl: string): Promise<Buffer> {
    const rel = snapshotUrl.replace(/^\/api\/snapshots\//, "");
    const fullPath = path.join(SNAPSHOTS_DIR, rel);
    return fs.readFile(fullPath);
  }

  async exists(snapshotUrl: string): Promise<boolean> {
    const rel = snapshotUrl.replace(/^\/api\/snapshots\//, "");
    const fullPath = path.join(SNAPSHOTS_DIR, rel);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(snapshotUrl: string): Promise<{ live: boolean; checkedAt: string }> {
    // Local FS snapshots are always "live" by definition; the upstream source's
    // health is tracked separately on the SourceLink record itself.
    const exists = await this.exists(snapshotUrl);
    return { live: exists, checkedAt: new Date().toISOString() };
  }
}

export const snapshotStore: SnapshotStore = new LocalFsSnapshotStore();
