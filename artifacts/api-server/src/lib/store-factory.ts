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

import * as queueStore from "./queue-store";
import * as demoStore from "./demo-store";
import { logger } from "./logger";

const wantDemo =
  !process.env["DATABASE_URL"] ||
  process.env["DATABASE_URL"] === "memory" ||
  process.env["DEMO_MODE"] === "true";

const active: typeof queueStore = wantDemo ? demoStore : queueStore;

if (wantDemo) {
  logger.info(
    "store-factory: DEMO MODE active (in-memory store, seeded on first access). " +
      "Data is lost on restart. Set DATABASE_URL to a Postgres URL to use the real store.",
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
