// =============================================================================
// Store factory — picks the right queue-store at startup
//
// Active when:
//   - DATABASE_URL is unset, OR
//   - DATABASE_URL === "memory", OR
//   - DEMO_MODE === "true"
// → use ./demo-store (in-memory, seeded, lost on restart).
//
// Otherwise → use ./queue-store (Drizzle/Postgres).
//
// Decision is logged once at boot so it's obvious which path is live. Route
// handlers import from THIS module (not queue-store/demo-store directly) so
// the swap is invisible to the rest of the app.
//
// Both store modules are imported statically. The Postgres one is safe to
// import without a live DB because @workspace/db's `db` export is a lazy
// Proxy — no connection pool is created until the first query. The unused
// module's functions are never called, so the cost is a few KB of JS.
// =============================================================================
// Store factory — production-grade backend selection
//
// Rules (in priority order):
//   1. NODE_ENV=production + no DATABASE_URL → FAIL FAST. We do not allow
//      in-memory stores in production. This is a hard error so an
//      operator who forgets to set DATABASE_URL sees a clear log line and
//      the process exits non-zero.
//   2. ALLOW_DEMO_STORE=true → in-memory demo store regardless of NODE_ENV.
//      Use this only for local dev / CI. Default OFF in all envs.
//   3. DATABASE_URL set + reachable → Drizzle/Postgres.
//   4. None of the above → in-memory demo store (dev only).
//
// The legacy `DEMO_MODE=true` env var is honored as a synonym for
// `ALLOW_DEMO_STORE=true` for backward compat with dev scripts.
// =============================================================================

import * as queueStore from "./queue-store";
import * as demoStore from "./demo-store";
import { logger } from "./logger";

const isProd = process.env["NODE_ENV"] === "production";
const hasDb = !!process.env["DATABASE_URL"] && process.env["DATABASE_URL"] !== "memory";
const allowDemo =
  process.env["ALLOW_DEMO_STORE"] === "true" || process.env["DEMO_MODE"] === "true";

let wantDemo: boolean;
if (allowDemo) {
  wantDemo = true;
} else if (!hasDb) {
  if (isProd) {
    // Hard fail in production. A misconfigured prod deploy must not silently
    // start with a blank in-memory store.
    logger.fatal(
      "DATABASE_URL is not set. Refusing to start in production with an in-memory store. " +
        "Set DATABASE_URL or run in dev mode (unset NODE_ENV).",
    );
    process.exit(1);
  }
  wantDemo = true; // dev: fall back to demo store with a clear log
} else {
  wantDemo = false;
}

const active: typeof queueStore = wantDemo ? demoStore : queueStore;

if (wantDemo) {
  if (isProd) {
    // Cannot reach here (the prod branch exits above), but type narrowing
    // wants the log anyway.
    logger.fatal("store-factory: refused to start — demo store not allowed in production");
    process.exit(1);
  }
  logger.warn(
    "store-factory: DEV/IN-MEMORY store active (data lost on restart). " +
      "Set DATABASE_URL to a Postgres URL and unset ALLOW_DEMO_STORE to run the real backend.",
  );
} else {
  logger.info({ databaseUrl: maskUrl(process.env["DATABASE_URL"]!) }, "store-factory: Postgres store active");
}

function maskUrl(url: string): string {
  // Hide the password in connection strings before logging
  return url.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/, "$1***$3");
}

// Re-export every public symbol from the active module so route handlers
// can `import { ... } from "../lib/store-factory"` and not care which
// backend is live.
export const upsertMarket = active.upsertMarket;
export const getMarket = active.getMarket;
export const listMarkets = active.listMarkets;

export const upsertYard = active.upsertYard;
export const getYard = active.getYard;
export const listYardsByMarket = active.listYardsByMarket;

export const upsertOrg = active.upsertOrg;
export const getOrg = active.getOrg;
export const listOrgs = active.listOrgs;
export const findOrgByMatchKey = active.findOrgByMatchKey;

export const upsertPerson = active.upsertPerson;
export const getPerson = active.getPerson;
export const listPersonsByOrg = active.listPersonsByOrg;
export const flagStalePersonsForPurge = active.flagStalePersonsForPurge;
export const touchPersonEngagement = active.touchPersonEngagement;

export const createPlay = active.createPlay;
export const listPlaysByMarket = active.listPlaysByMarket;

export const upsertSignal = active.upsertSignal;
export const getSignal = active.getSignal;
export const listSignals = active.listSignals;
export const promoteSignal = active.promoteSignal;
export const dismissSignal = active.dismissSignal;

export const logCorrection = active.logCorrection;
export const listCorrections = active.listCorrections;
export const isRejectedContent = active.isRejectedContent;
export const recordRejection = active.recordRejection;

export const REVIEW_QUEUE_AUTO_ARCHIVE_DAYS = active.REVIEW_QUEUE_AUTO_ARCHIVE_DAYS;
export const addToReviewQueue = active.addToReviewQueue;
export const listReviewQueue = active.listReviewQueue;
export const getReviewQueueItem = active.getReviewQueueItem;
export const removeFromReviewQueue = active.removeFromReviewQueue;
export const autoArchiveStaleQueueItems = active.autoArchiveStaleQueueItems;

export const logMeeting = active.logMeeting;
export const listMeetingsByOrg = active.listMeetingsByOrg;

export const upsertBattleCard = active.upsertBattleCard;
export const getBattleCard = active.getBattleCard;
export const listBattleCards = active.listBattleCards;
export const recordDoctrineRevision = active.recordDoctrineRevision;
export const listDoctrineRevisions = active.listDoctrineRevisions;

export const resetAllStores = active.resetAllStores;

// Boot-time introspection (used by /api/v1/system/info and the smoke test).
export function isDemoMode(): boolean {
  return wantDemo;
}
