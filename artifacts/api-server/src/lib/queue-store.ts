// =============================================================================
// Queue + entity store — in-memory implementation for v1
//
// Spec reference: §11.7 (review queue with 14-day auto-archive), §1.3
// (correction logging), §4 (entities).
//
// v1 uses an in-memory store. The interface is designed so the W36 Drizzle
// implementation can drop in without changing route handlers.
// =============================================================================

import { randomUUID } from "node:crypto";
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

// -----------------------------------------------------------------------------
// In-memory tables
// -----------------------------------------------------------------------------

const reviewQueue = new Map<string, ReviewQueueItem>();
const corrections: Correction[] = [];
const markets = new Map<string, Market>();
const yards = new Map<string, Yard>();
const orgs = new Map<string, Org>();
const persons = new Map<string, Person>();
const plays = new Map<string, Play>();
const meetings: MeetingLog[] = [];
const battleCards = new Map<string, BattleCard>(); // keyed by org_id
const doctrineRevisions: DoctrineRevision[] = [];

// -----------------------------------------------------------------------------
// Review queue
// -----------------------------------------------------------------------------

export function addToReviewQueue(
  item: Omit<ReviewQueueItem, "id" | "ts">,
): ReviewQueueItem {
  const id = `q_${randomUUID()}`;
  const full: ReviewQueueItem = { ...item, id, ts: new Date().toISOString() };
  reviewQueue.set(id, full);
  return full;
}

export function listReviewQueue(opts?: {
  marketId?: string;
  includeArchived?: boolean;
}): ReviewQueueItem[] {
  const items = Array.from(reviewQueue.values());
  const filtered = items.filter((i) => {
    if (opts?.marketId && i.market_id !== opts.marketId) return false;
    if (!opts?.includeArchived && isQueueItemStale(i.ts)) return false;
    return true;
  });
  // Newest first
  filtered.sort((a, b) => b.ts.localeCompare(a.ts));
  return filtered;
}

export function getReviewQueueItem(id: string): ReviewQueueItem | undefined {
  return reviewQueue.get(id);
}

export function removeFromReviewQueue(id: string): boolean {
  return reviewQueue.delete(id);
}

// -----------------------------------------------------------------------------
// Corrections (the apprentice log, §1.3)
// -----------------------------------------------------------------------------

export function logCorrection(
  c: Omit<Correction, "id" | "ts"> & { ts?: string },
): Correction {
  const id = `c_${randomUUID()}`;
  const full: Correction = { ...c, id, ts: c.ts ?? new Date().toISOString() };
  corrections.push(full);
  return full;
}

export function listCorrections(factId?: string): Correction[] {
  if (!factId) return [...corrections].reverse();
  return corrections.filter((c) => c.fact_id === factId).reverse();
}

// Rejection dedupe (US-1.3): rejected facts cannot re-render from the same
// source. Stored as content-hash on the Correction record.
const rejectionHashes = new Set<string>();

export function isRejectedContent(hash: string): boolean {
  return rejectionHashes.has(hash);
}

export function recordRejection(hash: string): void {
  rejectionHashes.add(hash);
}

// -----------------------------------------------------------------------------
// Entities (markets, yards, orgs, persons, plays)
// -----------------------------------------------------------------------------

export function upsertMarket(m: Market): Market {
  markets.set(m.id, m);
  return m;
}
export function getMarket(id: string): Market | undefined {
  return markets.get(id);
}
export function listMarkets(): Market[] {
  return Array.from(markets.values());
}

export function upsertYard(y: Yard): Yard {
  yards.set(y.id, y);
  return y;
}
export function getYard(id: string): Yard | undefined {
  return yards.get(id);
}
export function listYardsByMarket(marketId: string): Yard[] {
  return Array.from(yards.values()).filter((y) => y.market_id === marketId);
}

export function upsertOrg(o: Org): Org {
  orgs.set(o.id, o);
  return o;
}
export function getOrg(id: string): Org | undefined {
  return orgs.get(id);
}
export function listOrgs(): Org[] {
  return Array.from(orgs.values());
}
export function findOrgByMatchKey(matchKey: string): Org | undefined {
  return Array.from(orgs.values()).find(
    (o) => o.match_key === matchKey.toLowerCase(),
  );
}

export function upsertPerson(p: Person): Person {
  persons.set(p.id, p);
  return p;
}
export function getPerson(id: string): Person | undefined {
  return persons.get(id);
}
export function listPersonsByOrg(orgId: string): Person[] {
  return Array.from(persons.values()).filter((p) => p.org_id === orgId);
}

export function createPlay(p: Omit<Play, "id" | "created_at">): Play {
  const id = `play_${randomUUID()}`;
  const full: Play = { ...p, id, created_at: new Date().toISOString() };
  plays.set(id, full);
  return full;
}
export function getPlay(id: string): Play | undefined {
  return plays.get(id);
}
export function listPlaysByMarket(marketId: string): Play[] {
  return Array.from(plays.values()).filter((p) => p.market_id === marketId);
}

// -----------------------------------------------------------------------------
// Meeting logs
// -----------------------------------------------------------------------------

export function logMeeting(m: Omit<MeetingLog, "id">): MeetingLog {
  const id = `m_${randomUUID()}`;
  const full: MeetingLog = { ...m, id };
  meetings.push(full);
  return full;
}
export function listMeetingsByOrg(orgId: string): MeetingLog[] {
  return meetings.filter((m) => m.org_id === orgId).reverse();
}

// -----------------------------------------------------------------------------
// Battle cards
// -----------------------------------------------------------------------------

export function upsertBattleCard(card: BattleCard): BattleCard {
  battleCards.set(card.org_id, card);
  return card;
}
export function getBattleCard(orgId: string): BattleCard | undefined {
  return battleCards.get(orgId);
}
export function listBattleCards(): BattleCard[] {
  return Array.from(battleCards.values());
}

// Doctrine version history (§11.11)
export function recordDoctrineRevision(rev: Omit<DoctrineRevision, "ts">): DoctrineRevision {
  const full: DoctrineRevision = { ...rev, ts: new Date().toISOString() };
  doctrineRevisions.push(full);
  return full;
}
export function listDoctrineRevisions(
  contentKind: DoctrineRevision["content_kind"],
  contentId: string,
): DoctrineRevision[] {
  return doctrineRevisions
    .filter((r) => r.content_kind === contentKind && r.content_id === contentId)
    .reverse();
}

// -----------------------------------------------------------------------------
// Reset (for tests)
// -----------------------------------------------------------------------------

export function resetAllStores(): void {
  reviewQueue.clear();
  corrections.length = 0;
  markets.clear();
  yards.clear();
  orgs.clear();
  persons.clear();
  plays.clear();
  meetings.length = 0;
  battleCards.clear();
  doctrineRevisions.length = 0;
  rejectionHashes.clear();
}
