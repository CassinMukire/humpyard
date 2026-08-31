// =============================================================================
// DEV-ONLY in-memory implementation of queue-store
//
// Activated ONLY when ALLOW_DEMO_STORE=true (or legacy DEMO_MODE=true) AND
// NODE_ENV is not "production". In production, the store-factory refuses
// to start without a real DATABASE_URL — see lib/store-factory.ts.
//
// Why this still exists:
//   - CI fixtures and offline test runs need a deterministic backend with
//     no Postgres dependency.
//   - The W35 demo used it; the production data path is queue-store.ts.
//
// The interface mirrors queue-store.ts so the route handlers are unchanged.
// =============================================================================

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ReviewQueueItem,
  Correction,
  Market,
  Yard,
  Org,
  Person,
  Play,
  MeetingLog,
  BattleCard,
  DoctrineRevision,
} from "@workspace/api-zod";
import { isQueueItemStale } from "./trust-layer";
import { logger } from "./logger";
import { getSeedData } from "./seed-data";

const markets = new Map<string, Market>();
const yards = new Map<string, Yard>();
const orgs = new Map<string, Org>();
const persons = new Map<string, Person>();
const plays = new Map<string, Play>();
const reviewQueue = new Map<string, ReviewQueueItem>();
const corrections: Correction[] = [];
const meetings: MeetingLog[] = [];
const battleCards = new Map<string, BattleCard>();
const doctrineRevisions: DoctrineRevision[] = [];
const rejectionHashes = new Set<string>();

function id(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// -----------------------------------------------------------------------------
// File persistence — demo store survives restarts.
//
// Default path: data/demo-store.json (relative to api-server cwd). Override
// with DEMO_STORE_FILE env var. Writes are best-effort: a failed write logs
// a warning and the in-memory state continues.
// -----------------------------------------------------------------------------

const PERSIST_FILE = process.env["DEMO_STORE_FILE"] ?? join(process.cwd(), "data", "demo-store.json");
const PERSIST_DEBOUNCE_MS = 250;

interface DemoSnapshot {
  version: 1;
  saved_at: string;
  markets: Market[];
  yards: Yard[];
  orgs: Org[];
  persons: Person[];
  plays: Play[];
  review_queue: ReviewQueueItem[];
  corrections: Correction[];
  meetings: MeetingLog[];
  battle_cards: BattleCard[];
  doctrine_revisions: DoctrineRevision[];
  rejection_hashes: string[];
}

let persistTimer: NodeJS.Timeout | null = null;

function persistNow(): void {
  try {
    const snap: DemoSnapshot = {
      version: 1,
      saved_at: new Date().toISOString(),
      markets: Array.from(markets.values()),
      yards: Array.from(yards.values()),
      orgs: Array.from(orgs.values()),
      persons: Array.from(persons.values()),
      plays: Array.from(plays.values()),
      review_queue: Array.from(reviewQueue.values()),
      corrections: [...corrections],
      meetings: [...meetings],
      battle_cards: Array.from(battleCards.values()),
      doctrine_revisions: [...doctrineRevisions],
      rejection_hashes: Array.from(rejectionHashes),
    };
    mkdirSync(dirname(PERSIST_FILE), { recursive: true });
    writeFileSync(PERSIST_FILE, JSON.stringify(snap, null, 2), "utf8");
  } catch (err) {
    logger.warn({ err, file: PERSIST_FILE }, "demo-store: failed to persist snapshot");
  }
}

function persist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

function loadFromDisk(): boolean {
  if (!existsSync(PERSIST_FILE)) return false;
  try {
    const raw = readFileSync(PERSIST_FILE, "utf8");
    const snap = JSON.parse(raw) as DemoSnapshot;
    if (snap.version !== 1) {
      logger.warn({ version: snap.version }, "demo-store: unknown snapshot version, ignoring");
      return false;
    }
    markets.clear();
    snap.markets.forEach((m) => markets.set(m.id, m));
    yards.clear();
    snap.yards.forEach((y) => yards.set(y.id, y));
    orgs.clear();
    snap.orgs.forEach((o) => orgs.set(o.id, o));
    persons.clear();
    snap.persons.forEach((p) => persons.set(p.id, p));
    plays.clear();
    snap.plays.forEach((p) => plays.set(p.id, p));
    reviewQueue.clear();
    snap.review_queue.forEach((q) => reviewQueue.set(q.id, q));
    corrections.length = 0;
    corrections.push(...snap.corrections);
    meetings.length = 0;
    meetings.push(...snap.meetings);
    battleCards.clear();
    snap.battle_cards.forEach((b) => battleCards.set(b.org_id, b));
    doctrineRevisions.length = 0;
    doctrineRevisions.push(...snap.doctrine_revisions);
    rejectionHashes.clear();
    snap.rejection_hashes.forEach((h) => rejectionHashes.add(h));
    // Empty snapshot — treat as a fresh seed. A previous run might have
    // saved an empty file before the seed completed, or someone reset the
    // file by hand. Either way, re-seed.
    if (markets.size === 0 && orgs.size === 0 && persons.size === 0) {
      logger.info({ file: PERSIST_FILE }, "demo-store: snapshot empty, will re-seed");
      return false;
    }
    logger.info(
      { file: PERSIST_FILE, markets: markets.size, yards: yards.size, persons: persons.size, cards: battleCards.size },
      "demo-store: loaded snapshot from disk",
    );
    return true;
  } catch (err) {
    logger.warn({ err, file: PERSIST_FILE }, "demo-store: failed to load snapshot, will seed fresh");
    return false;
  }
}

// -----------------------------------------------------------------------------
// Seed data — loaded from lib/seed-data.ts. The data is the v1 production
// baseline, not a demo fixture; the dev in-memory store just hydrates from
// it on first access.
// -----------------------------------------------------------------------------

let seeded = false;
function seed(): void {
  if (seeded) return;
  seeded = true;

  const data = getSeedData();
  for (const m of data.markets) markets.set(m.id, m);
  for (const o of data.orgs) orgs.set(o.id, o);
  for (const y of data.yards) yards.set(y.id, y);
  for (const p of data.persons) persons.set(p.id, p);
  for (const c of data.battle_cards) battleCards.set(c.org_id, c);
  for (const r of data.review_queue) reviewQueue.set(r.id, r);

  // (Old inline seed body removed; the data now lives in lib/seed-data.ts
  //  and is shared with scripts/seed-production.ts.)
}


// -----------------------------------------------------------------------------
// Public API — mirrors queue-store.ts
// -----------------------------------------------------------------------------

export async function resetAllStores(): Promise<void> {
  markets.clear();
  yards.clear();
  orgs.clear();
  persons.clear();
  plays.clear();
  reviewQueue.clear();
  corrections.length = 0;
  meetings.length = 0;
  battleCards.clear();
  doctrineRevisions.length = 0;
  rejectionHashes.clear();
  seeded = false;
  // Force-delete the snapshot so the next access re-seeds.
  try {
    if (existsSync(PERSIST_FILE)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(PERSIST_FILE);
    }
  } catch {
    // best-effort
  }
}

export function ensureSeeded(): void {
  if (seeded) return;
  // First try to load a saved snapshot from disk. If that fails (no file or
  // empty), seed with the in-memory fixture data and persist it.
  if (loadFromDisk()) {
    seeded = true;
    return;
  }
  seed();
  persist();
}

// Markets
export async function upsertMarket(m: Market): Promise<Market> {
  ensureSeeded();
  markets.set(m.id, m);
  persist();
  return m;
}
export async function getMarket(id: string): Promise<Market | undefined> {
  ensureSeeded();
  return markets.get(id);
}
export async function listMarkets(): Promise<Market[]> {
  ensureSeeded();
  return Array.from(markets.values()).sort((a, b) => a.country_name.localeCompare(b.country_name));
}

// Yards
export async function upsertYard(y: Yard): Promise<Yard> {
  ensureSeeded();
  yards.set(y.id, y);
  persist();
  return y;
}
export async function getYard(id: string): Promise<Yard | undefined> {
  ensureSeeded();
  return yards.get(id);
}
export async function listYardsByMarket(marketId: string): Promise<Yard[]> {
  ensureSeeded();
  return Array.from(yards.values()).filter((y) => y.market_id === marketId);
}

// Orgs
export async function upsertOrg(o: Org): Promise<Org> {
  ensureSeeded();
  orgs.set(o.id, o);
  persist();
  return o;
}
export async function getOrg(id: string): Promise<Org | undefined> {
  ensureSeeded();
  return orgs.get(id);
}
export async function listOrgs(): Promise<Org[]> {
  ensureSeeded();
  return Array.from(orgs.values());
}
export async function findOrgByMatchKey(matchKey: string): Promise<Org | undefined> {
  ensureSeeded();
  return Array.from(orgs.values()).find((o) => o.match_key === matchKey.toLowerCase());
}

// Persons
export async function upsertPerson(p: Person): Promise<Person> {
  ensureSeeded();
  persons.set(p.id, p);
  persist();
  return p;
}
export async function getPerson(id: string): Promise<Person | undefined> {
  ensureSeeded();
  return persons.get(id);
}
export async function listPersonsByOrg(orgId: string): Promise<Person[]> {
  ensureSeeded();
  return Array.from(persons.values()).filter((p) => p.org_id === orgId);
}
export async function flagStalePersonsForPurge(): Promise<string[]> {
  ensureSeeded();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  return Array.from(persons.values())
    .filter((p) => p.last_engagement_at !== null && new Date(p.last_engagement_at!) < cutoff)
    .map((p) => p.id);
}
export async function touchPersonEngagement(personId: string): Promise<void> {
  const p = persons.get(personId);
  if (!p) return;
  persons.set(personId, { ...p, last_engagement_at: new Date().toISOString() });
  persist();
}

// Plays
export async function createPlay(p: Omit<Play, "id" | "created_at">): Promise<Play> {
  ensureSeeded();
  const play: Play = { ...p, id: id("play"), created_at: new Date().toISOString() };
  plays.set(play.id, play);
  persist();
  return play;
}
export async function listPlaysByMarket(marketId: string): Promise<Play[]> {
  ensureSeeded();
  return Array.from(plays.values()).filter((p) => p.market_id === marketId);
}

// Corrections
export async function logCorrection(c: Omit<Correction, "id" | "ts"> & { ts?: string }): Promise<Correction> {
  ensureSeeded();
  const correction: Correction = {
    ...c,
    id: id("c"),
    ts: c.ts ?? new Date().toISOString(),
  };
  corrections.push(correction);
  persist();
  return correction;
}
export async function listCorrections(factId?: string): Promise<Correction[]> {
  ensureSeeded();
  const filtered = factId ? corrections.filter((c) => c.fact_id === factId) : [...corrections];
  return filtered.reverse();
}
export async function isRejectedContent(hash: string): Promise<boolean> {
  return rejectionHashes.has(hash);
}
export async function recordRejection(hash: string): Promise<void> {
  rejectionHashes.add(hash);
  persist();
}

// Review queue
export const REVIEW_QUEUE_AUTO_ARCHIVE_DAYS = 14;
export async function addToReviewQueue(item: Omit<ReviewQueueItem, "id" | "ts">): Promise<ReviewQueueItem> {
  ensureSeeded();
  const rqi: ReviewQueueItem = { ...item, id: id("q"), ts: new Date().toISOString() };
  reviewQueue.set(rqi.id, rqi);
  persist();
  return rqi;
}
export async function listReviewQueue(opts?: { marketId?: string; includeArchived?: boolean }): Promise<ReviewQueueItem[]> {
  ensureSeeded();
  const items = Array.from(reviewQueue.values()).filter((i) => {
    if (opts?.marketId && i.market_id !== opts.marketId) return false;
    if (!opts?.includeArchived && isQueueItemStale(i.ts)) return false;
    return true;
  });
  return items.sort((a, b) => b.ts.localeCompare(a.ts));
}
export async function getReviewQueueItem(id: string): Promise<ReviewQueueItem | undefined> {
  ensureSeeded();
  return reviewQueue.get(id);
}
export async function removeFromReviewQueue(id: string): Promise<boolean> {
  const result = reviewQueue.delete(id);
  if (result) persist();
  return result;
}
export async function autoArchiveStaleQueueItems(): Promise<number> {
  let n = 0;
  for (const [id, item] of reviewQueue.entries()) {
    if (isQueueItemStale(item.ts)) {
      reviewQueue.delete(id);
      n++;
    }
  }
  return n;
}

// Meetings
export async function logMeeting(m: Omit<MeetingLog, "id">): Promise<MeetingLog> {
  ensureSeeded();
  const meeting: MeetingLog = { ...m, id: id("m") };
  meetings.push(meeting);
  persist();
  return meeting;
}
export async function listMeetingsByOrg(orgId: string): Promise<MeetingLog[]> {
  ensureSeeded();
  return meetings.filter((m) => m.org_id === orgId).reverse();
}

// Battle cards
export async function upsertBattleCard(card: BattleCard): Promise<BattleCard> {
  ensureSeeded();
  battleCards.set(card.org_id, card);
  persist();
  return card;
}
export async function getBattleCard(orgId: string): Promise<BattleCard | undefined> {
  ensureSeeded();
  return battleCards.get(orgId);
}
export async function listBattleCards(): Promise<BattleCard[]> {
  ensureSeeded();
  return Array.from(battleCards.values());
}
export async function recordDoctrineRevision(rev: Omit<DoctrineRevision, "ts">): Promise<DoctrineRevision> {
  ensureSeeded();
  const r: DoctrineRevision = { ...rev, ts: new Date().toISOString() };
  doctrineRevisions.push(r);
  persist();
  return r;
}
export async function listDoctrineRevisions(
  contentKind: DoctrineRevision["content_kind"],
  contentId: string,
): Promise<DoctrineRevision[]> {
  ensureSeeded();
  return doctrineRevisions
    .filter((r) => r.content_kind === contentKind && r.content_id === contentId)
    .reverse();
}
