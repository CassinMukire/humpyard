// =============================================================================
// Queue + entity store — Drizzle/Postgres-backed
//
// Spec reference: §11.7 (review queue with 14-day auto-archive), §1.3
// (correction logging), §4 (entities), §12.5 (EU/EEA + retention).
//
// All v1 entities persist to Postgres via @workspace/db. Every function is
// async. The interface mirrors the in-memory v0 so route handlers can be
// refactored without churn.
// =============================================================================

import { randomUUID } from "node:crypto";
import { eq, and, desc, sql, isNull, gte, lte, isNotNull } from "drizzle-orm";
import { db } from "@workspace/db";
import * as schema from "@workspace/db/schema";
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

// -----------------------------------------------------------------------------
// Row → wire-format helpers (Drizzle rows ↔ Zod types)
// -----------------------------------------------------------------------------

function rowToMarket(r: schema.MarketRow): Market {
  return {
    id: r.id,
    country_iso: r.country_iso,
    country_name: r.country_name,
    tier: r.tier,
    posture: r.posture,
    verdict: r.verdict as Market["verdict"],
    five_questions: r.five_questions as Market["five_questions"],
    window_opens: r.window_opens?.toISOString() ?? null,
    window_closes: r.window_closes?.toISOString() ?? null,
    depth: (r.depth as Market["depth"]) ?? "scan",
    yard_count: r.yard_count ?? null,
    yard_count_source_url: r.yard_count_source_url ?? null,
    closed_at: r.closed_at?.toISOString() ?? null,
    sources: r.sources as Market["sources"],
    posture_history: r.posture_history as Market["posture_history"],
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

function rowToYard(r: schema.YardRow): Yard {
  return {
    id: r.id,
    market_id: r.market_id,
    name: r.name,
    geo: (r.geo as Yard["geo"]) ?? null,
    operator_org_id: r.operator_org_id ?? null,
    status: r.status,
    brake_tech: (r.brake_tech as Yard["brake_tech"]) ?? null,
    last_modernized: (r.last_modernized as Yard["last_modernized"]) ?? null,
    sources: r.sources as Yard["sources"],
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

function rowToOrg(r: schema.OrgRow): Org {
  return {
    id: r.id,
    name: r.name,
    match_key: r.match_key,
    type: r.type,
    market_ids: r.market_ids as string[],
    monday_item_id: r.monday_item_id ?? null,
    innotrans_target: r.innotrans_target,
    customer_category: (r.customer_category as Org["customer_category"]) ?? null,
    k1_door: (r.k1_door as Org["k1_door"]) ?? null,
    risk_facts: r.risk_facts as Org["risk_facts"],
    sources: r.sources as Org["sources"],
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

function rowToPerson(r: schema.PersonRow): Person {
  return {
    id: r.id,
    name: r.name,
    org_id: r.org_id ?? null,
    role: r.role,
    role_history: r.role_history as Person["role_history"],
    linkedin_url: r.linkedin_url ?? null,
    manual_linkedin_url: r.manual_linkedin_url ?? null,
    interests: (r.interests as Person["interests"]) ?? [],
    relationship_owner: r.relationship_owner ?? null,
    relationship_status: r.relationship_status,
    import_meta: (r.import_meta as Person["import_meta"]) ?? null,
    last_engagement_at: r.last_engagement_at?.toISOString() ?? null,
    monday_item_id: r.monday_item_id ?? null,
    sources: r.sources as Person["sources"],
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

function rowToPlay(r: schema.PlayRow): Play {
  return {
    id: r.id,
    market_id: r.market_id ?? null,
    action: r.action,
    owner: r.owner ?? null,
    due: r.due?.toISOString() ?? null,
    status: r.status,
    origin: r.origin as Play["origin"],
    doctrine_ref: r.doctrine_ref ?? null,
    monday_item_id: r.monday_item_id ?? null,
    created_at: r.created_at.toISOString(),
  };
}

function rowToMeeting(r: schema.MeetingRow): MeetingLog {
  return {
    id: r.id,
    org_id: r.org_id ?? null,
    person_ids: r.person_ids as string[],
    raw_note: r.raw_note,
    audio_ref: r.audio_ref ?? null,
    extracted_facts: r.extracted_facts as string[],
    play_id: r.play_id ?? null,
    ts: r.ts.toISOString(),
  };
}

function rowToBattleCard(r: schema.BattleCardRow): BattleCard {
  return {
    org_id: r.org_id,
    who_they_are: r.who_they_are,
    why_matters: r.why_matters,
    known_people: r.known_people as BattleCard["known_people"],
    relationship_status: r.relationship_status,
    suggested_questions: r.suggested_questions as string[],
    trap_to_avoid: r.trap_to_avoid,
    sources: r.sources as BattleCard["sources"],
    kind: r.kind,
    recon_what_to_observe: r.recon_what_to_observe as string[] | undefined,
    way_in: r.way_in ?? null,
    opening: r.opening ?? null,
    receipt: r.receipt ?? null,
    doctrine_version: r.doctrine_version,
    doctrine_updated_at: r.doctrine_updated_at.toISOString(),
    doctrine_updated_by: r.doctrine_updated_by,
  };
}

function rowToReviewQueueItem(r: schema.ReviewQueueRow): ReviewQueueItem {
  return {
    id: r.id,
    kind: r.kind,
    proposed: r.proposed as Record<string, unknown>,
    raw_snippet: r.raw_snippet,
    source_url: r.source_url,
    retrieved_at: r.retrieved_at.toISOString(),
    market_id: r.market_id ?? null,
    ts: r.ts.toISOString(),
  };
}

function rowToCorrection(r: schema.CorrectionRow): Correction {
  return {
    id: r.id,
    fact_id: r.fact_id,
    fact_kind: r.fact_kind,
    action: r.action,
    corrected_value: r.corrected_value ?? undefined,
    user: r.user,
    ts: r.ts.toISOString(),
    rejection_hash: r.rejection_hash ?? undefined,
  };
}

function rowToDoctrineRevision(r: schema.DoctrineRevisionRow): DoctrineRevision {
  return {
    content_kind: r.content_kind,
    content_id: r.content_id,
    version: r.version,
    diff: r.diff,
    author: r.author,
    ts: r.ts.toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Markets
// -----------------------------------------------------------------------------

export async function upsertMarket(m: Market): Promise<Market> {
  await db
    .insert(schema.markets)
    .values({
      id: m.id,
      country_iso: m.country_iso,
      country_name: m.country_name,
      tier: m.tier,
      posture: m.posture,
      verdict: m.verdict,
      five_questions: m.five_questions,
      window_opens: m.window_opens ? new Date(m.window_opens) : null,
      window_closes: m.window_closes ? new Date(m.window_closes) : null,
      depth: m.depth,
      yard_count: m.yard_count,
      yard_count_source_url: m.yard_count_source_url,
      closed_at: m.closed_at ? new Date(m.closed_at) : null,
      sources: m.sources,
      posture_history: m.posture_history,
    })
    .onConflictDoUpdate({
      target: schema.markets.id,
      set: {
        country_iso: m.country_iso,
        country_name: m.country_name,
        tier: m.tier,
        posture: m.posture,
        verdict: m.verdict,
        five_questions: m.five_questions,
        window_opens: m.window_opens ? new Date(m.window_opens) : null,
        window_closes: m.window_closes ? new Date(m.window_closes) : null,
        depth: m.depth,
        yard_count: m.yard_count,
        yard_count_source_url: m.yard_count_source_url,
        closed_at: m.closed_at ? new Date(m.closed_at) : null,
        sources: m.sources,
        posture_history: m.posture_history,
        updated_at: new Date(),
      },
    });
  return m;
}

export async function getMarket(id: string): Promise<Market | undefined> {
  const rows = await db.select().from(schema.markets).where(eq(schema.markets.id, id)).limit(1);
  return rows[0] ? rowToMarket(rows[0]) : undefined;
}

export async function listMarkets(): Promise<Market[]> {
  const rows = await db.select().from(schema.markets).orderBy(schema.markets.country_name);
  return rows.map(rowToMarket);
}

// -----------------------------------------------------------------------------
// Yards
// -----------------------------------------------------------------------------

export async function upsertYard(y: Yard): Promise<Yard> {
  await db
    .insert(schema.yards)
    .values({
      id: y.id,
      market_id: y.market_id,
      name: y.name,
      geo: y.geo,
      operator_org_id: y.operator_org_id,
      status: y.status,
      brake_tech: y.brake_tech,
      last_modernized: y.last_modernized,
      sources: y.sources,
    })
    .onConflictDoUpdate({
      target: schema.yards.id,
      set: {
        name: y.name,
        geo: y.geo,
        operator_org_id: y.operator_org_id,
        status: y.status,
        brake_tech: y.brake_tech,
        last_modernized: y.last_modernized,
        sources: y.sources,
        updated_at: new Date(),
      },
    });
  return y;
}

export async function getYard(id: string): Promise<Yard | undefined> {
  const rows = await db.select().from(schema.yards).where(eq(schema.yards.id, id)).limit(1);
  return rows[0] ? rowToYard(rows[0]) : undefined;
}

export async function listYardsByMarket(marketId: string): Promise<Yard[]> {
  const rows = await db
    .select()
    .from(schema.yards)
    .where(eq(schema.yards.market_id, marketId));
  return rows.map(rowToYard);
}

// -----------------------------------------------------------------------------
// Orgs
// -----------------------------------------------------------------------------

export async function upsertOrg(o: Org): Promise<Org> {
  await db
    .insert(schema.orgs)
    .values({
      id: o.id,
      name: o.name,
      match_key: o.match_key.toLowerCase(),
      type: o.type,
      market_ids: o.market_ids,
      monday_item_id: o.monday_item_id,
      innotrans_target: o.innotrans_target,
      customer_category: o.customer_category,
      k1_door: o.k1_door,
      risk_facts: o.risk_facts,
      sources: o.sources,
    })
    .onConflictDoUpdate({
      target: schema.orgs.id,
      set: {
        name: o.name,
        match_key: o.match_key.toLowerCase(),
        type: o.type,
        market_ids: o.market_ids,
        monday_item_id: o.monday_item_id,
        innotrans_target: o.innotrans_target,
        customer_category: o.customer_category,
        k1_door: o.k1_door,
        risk_facts: o.risk_facts,
        sources: o.sources,
        updated_at: new Date(),
      },
    });
  return o;
}

export async function getOrg(id: string): Promise<Org | undefined> {
  const rows = await db.select().from(schema.orgs).where(eq(schema.orgs.id, id)).limit(1);
  return rows[0] ? rowToOrg(rows[0]) : undefined;
}

export async function listOrgs(): Promise<Org[]> {
  const rows = await db.select().from(schema.orgs).orderBy(schema.orgs.name);
  return rows.map(rowToOrg);
}

export async function findOrgByMatchKey(matchKey: string): Promise<Org | undefined> {
  const rows = await db
    .select()
    .from(schema.orgs)
    .where(eq(schema.orgs.match_key, matchKey.toLowerCase()))
    .limit(1);
  return rows[0] ? rowToOrg(rows[0]) : undefined;
}

// -----------------------------------------------------------------------------
// Persons
// -----------------------------------------------------------------------------

export async function upsertPerson(p: Person): Promise<Person> {
  await db
    .insert(schema.persons)
    .values({
      id: p.id,
      name: p.name,
      org_id: p.org_id,
      role: p.role,
      role_history: p.role_history,
      linkedin_url: p.linkedin_url,
      manual_linkedin_url: p.manual_linkedin_url,
      interests: p.interests,
      relationship_owner: p.relationship_owner,
      relationship_status: p.relationship_status,
      import_meta: p.import_meta,
      last_engagement_at: p.last_engagement_at
        ? new Date(p.last_engagement_at)
        : null,
      monday_item_id: p.monday_item_id,
      sources: p.sources,
    })
    .onConflictDoUpdate({
      target: schema.persons.id,
      set: {
        name: p.name,
        org_id: p.org_id,
        role: p.role,
        role_history: p.role_history,
        linkedin_url: p.linkedin_url,
        manual_linkedin_url: p.manual_linkedin_url,
        interests: p.interests,
        relationship_owner: p.relationship_owner,
        relationship_status: p.relationship_status,
        import_meta: p.import_meta,
        last_engagement_at: p.last_engagement_at
          ? new Date(p.last_engagement_at)
          : null,
        monday_item_id: p.monday_item_id,
        sources: p.sources,
        updated_at: new Date(),
      },
    });
  return p;
}

export async function getPerson(id: string): Promise<Person | undefined> {
  const rows = await db.select().from(schema.persons).where(eq(schema.persons.id, id)).limit(1);
  return rows[0] ? rowToPerson(rows[0]) : undefined;
}

export async function listPersonsByOrg(orgId: string): Promise<Person[]> {
  const rows = await db.select().from(schema.persons).where(eq(schema.persons.org_id, orgId));
  return rows.map(rowToPerson);
}

/**
 * §12.5.3 retention: persons with no engagement in 24 months are flagged
 * for purge. We don't hard-delete here — that requires the operator's
 * confirmation (and the matching monday.com delete). This function just
 * surfaces the candidates. Returns IDs of stale persons.
 */
export async function flagStalePersonsForPurge(): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  const rows = await db
    .select({ id: schema.persons.id })
    .from(schema.persons)
    .where(lte(schema.persons.last_engagement_at, cutoff));
  return rows.map((r) => r.id);
}

/**
 * §12.5.3: bump last_engagement_at for a person. Called when a Play is
 * created for them, a meeting is logged with them, or monday reports
 * activity. Keeps the retention timer accurate.
 */
export async function touchPersonEngagement(personId: string): Promise<void> {
  await db
    .update(schema.persons)
    .set({ last_engagement_at: new Date(), updated_at: new Date() })
    .where(eq(schema.persons.id, personId));
}

// -----------------------------------------------------------------------------
// Plays
// -----------------------------------------------------------------------------

export async function createPlay(p: Omit<Play, "id" | "created_at">): Promise<Play> {
  const id = `play_${randomUUID()}`;
  const created = new Date();
  await db.insert(schema.plays).values({
    id,
    market_id: p.market_id,
    action: p.action,
    owner: p.owner,
    due: p.due ? new Date(p.due) : null,
    status: p.status,
    origin: p.origin,
    doctrine_ref: p.doctrine_ref,
    monday_item_id: p.monday_item_id,
    created_at: created,
  });
  return { ...p, id, created_at: created.toISOString() };
}

export async function listPlaysByMarket(marketId: string): Promise<Play[]> {
  const rows = await db
    .select()
    .from(schema.plays)
    .where(eq(schema.plays.market_id, marketId));
  return rows.map(rowToPlay);
}

// -----------------------------------------------------------------------------
// Corrections (apprentice log, §1.3)
// -----------------------------------------------------------------------------

export async function logCorrection(
  c: Omit<Correction, "id" | "ts"> & { ts?: string },
): Promise<Correction> {
  const id = `c_${randomUUID()}`;
  const ts = c.ts ? new Date(c.ts) : new Date();
  await db.insert(schema.corrections).values({
    id,
    fact_id: c.fact_id,
    fact_kind: c.fact_kind,
    action: c.action,
    corrected_value: c.corrected_value ?? null,
    user: c.user,
    ts,
    rejection_hash: c.rejection_hash ?? null,
  });
  return { ...c, id, ts: ts.toISOString() };
}

export async function listCorrections(factId?: string): Promise<Correction[]> {
  const q = factId
    ? db.select().from(schema.corrections).where(eq(schema.corrections.fact_id, factId))
    : db.select().from(schema.corrections);
  const rows = await q.orderBy(desc(schema.corrections.ts));
  return rows.map(rowToCorrection);
}

// Rejection dedupe (US-1.3). Hashes are checked against the corrections table
// so they survive across server restarts (in-memory cache would not).
export async function isRejectedContent(hash: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.corrections.id })
    .from(schema.corrections)
    .where(and(eq(schema.corrections.rejection_hash, hash), eq(schema.corrections.action, "reject")))
    .limit(1);
  return rows.length > 0;
}

export async function recordRejection(hash: string): Promise<void> {
  // No-op: the rejection is recorded by logCorrection() with action="reject"
  // and rejection_hash set. This function exists for symmetry with the v0
  // in-memory API; it is now a no-op.
  void hash;
}

// -----------------------------------------------------------------------------
// Review queue
// -----------------------------------------------------------------------------

export const REVIEW_QUEUE_AUTO_ARCHIVE_DAYS = 14;

export async function addToReviewQueue(
  item: Omit<ReviewQueueItem, "id" | "ts">,
): Promise<ReviewQueueItem> {
  const id = `q_${randomUUID()}`;
  const ts = new Date();
  await db.insert(schema.reviewQueue).values({
    id,
    kind: item.kind,
    proposed: item.proposed,
    raw_snippet: item.raw_snippet,
    source_url: item.source_url,
    retrieved_at: new Date(item.retrieved_at),
    market_id: item.market_id,
    ts,
    archived: false,
  });
  return { ...item, id, ts: ts.toISOString() };
}

export async function listReviewQueue(opts?: {
  marketId?: string;
  includeArchived?: boolean;
}): Promise<ReviewQueueItem[]> {
  const conds = [];
  if (opts?.marketId) conds.push(eq(schema.reviewQueue.market_id, opts.marketId));
  if (!opts?.includeArchived) {
    conds.push(eq(schema.reviewQueue.archived, false));
  }
  const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
  const q = where
    ? db.select().from(schema.reviewQueue).where(where)
    : db.select().from(schema.reviewQueue);
  const rows = await q.orderBy(desc(schema.reviewQueue.ts));
  return rows.map(rowToReviewQueueItem);
}

export async function getReviewQueueItem(id: string): Promise<ReviewQueueItem | undefined> {
  const rows = await db
    .select()
    .from(schema.reviewQueue)
    .where(eq(schema.reviewQueue.id, id))
    .limit(1);
  return rows[0] ? rowToReviewQueueItem(rows[0]) : undefined;
}

export async function removeFromReviewQueue(id: string): Promise<boolean> {
  // We soft-archive so the data is recoverable (§11.7)
  const result = await db
    .update(schema.reviewQueue)
    .set({ archived: true, archived_at: new Date() })
    .where(eq(schema.reviewQueue.id, id))
    .returning({ id: schema.reviewQueue.id });
  return result.length > 0;
}

// Auto-archive items older than REVIEW_QUEUE_AUTO_ARCHIVE_DAYS unreviewed.
// Returns the count archived.
export async function autoArchiveStaleQueueItems(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REVIEW_QUEUE_AUTO_ARCHIVE_DAYS);
  const result = await db
    .update(schema.reviewQueue)
    .set({ archived: true, archived_at: new Date() })
    .where(and(eq(schema.reviewQueue.archived, false), lte(schema.reviewQueue.ts, cutoff)))
    .returning({ id: schema.reviewQueue.id });
  return result.length;
}

// -----------------------------------------------------------------------------
// Meetings
// -----------------------------------------------------------------------------

export async function logMeeting(m: Omit<MeetingLog, "id">): Promise<MeetingLog> {
  const id = `m_${randomUUID()}`;
  await db.insert(schema.meetings).values({
    id,
    org_id: m.org_id,
    person_ids: m.person_ids,
    raw_note: m.raw_note,
    audio_ref: m.audio_ref,
    extracted_facts: m.extracted_facts,
    play_id: m.play_id,
    ts: new Date(m.ts),
  });
  return { ...m, id };
}

export async function listMeetingsByOrg(orgId: string): Promise<MeetingLog[]> {
  const rows = await db
    .select()
    .from(schema.meetings)
    .where(eq(schema.meetings.org_id, orgId))
    .orderBy(desc(schema.meetings.ts));
  return rows.map(rowToMeeting);
}

// -----------------------------------------------------------------------------
// Battle cards
// -----------------------------------------------------------------------------

export async function upsertBattleCard(card: BattleCard): Promise<BattleCard> {
  const now = new Date();
  await db
    .insert(schema.battleCards)
    .values({
      org_id: card.org_id,
      who_they_are: card.who_they_are,
      why_matters: card.why_matters,
      known_people: card.known_people,
      relationship_status: card.relationship_status,
      suggested_questions: card.suggested_questions,
      trap_to_avoid: card.trap_to_avoid,
      sources: card.sources,
      kind: card.kind,
      recon_what_to_observe: card.recon_what_to_observe ?? null,
      way_in: card.way_in,
      opening: card.opening,
      receipt: card.receipt,
      doctrine_version: card.doctrine_version,
      doctrine_updated_at: new Date(card.doctrine_updated_at),
      doctrine_updated_by: card.doctrine_updated_by,
    })
    .onConflictDoUpdate({
      target: schema.battleCards.org_id,
      set: {
        who_they_are: card.who_they_are,
        why_matters: card.why_matters,
        known_people: card.known_people,
        relationship_status: card.relationship_status,
        suggested_questions: card.suggested_questions,
        trap_to_avoid: card.trap_to_avoid,
        sources: card.sources,
        kind: card.kind,
        recon_what_to_observe: card.recon_what_to_observe ?? null,
        way_in: card.way_in,
        opening: card.opening,
        receipt: card.receipt,
        doctrine_version: card.doctrine_version,
        doctrine_updated_at: now,
        doctrine_updated_by: card.doctrine_updated_by,
      },
    });
  return card;
}

export async function getBattleCard(orgId: string): Promise<BattleCard | undefined> {
  const rows = await db
    .select()
    .from(schema.battleCards)
    .where(eq(schema.battleCards.org_id, orgId))
    .limit(1);
  return rows[0] ? rowToBattleCard(rows[0]) : undefined;
}

export async function listBattleCards(): Promise<BattleCard[]> {
  const rows = await db.select().from(schema.battleCards);
  return rows.map(rowToBattleCard);
}

// Doctrine version history (§11.11)
export async function recordDoctrineRevision(
  rev: Omit<DoctrineRevision, "ts">,
): Promise<DoctrineRevision> {
  const id = `rev_${randomUUID()}`;
  const ts = new Date();
  await db.insert(schema.doctrineRevisions).values({
    id,
    content_kind: rev.content_kind,
    content_id: rev.content_id,
    version: rev.version,
    diff: rev.diff,
    author: rev.author,
    ts,
  });
  return { ...rev, ts: ts.toISOString() };
}

export async function listDoctrineRevisions(
  contentKind: DoctrineRevision["content_kind"],
  contentId: string,
): Promise<DoctrineRevision[]> {
  const rows = await db
    .select()
    .from(schema.doctrineRevisions)
    .where(
      and(
        eq(schema.doctrineRevisions.content_kind, contentKind),
        eq(schema.doctrineRevisions.content_id, contentId),
      ),
    )
    .orderBy(desc(schema.doctrineRevisions.ts));
  return rows.map(rowToDoctrineRevision);
}

// -----------------------------------------------------------------------------
// Dev-only: nuke everything (gated by NODE_ENV !== "production")
// -----------------------------------------------------------------------------

export async function resetAllStores(): Promise<void> {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("resetAllStores() is dev-only");
  }
  await db.delete(schema.doctrineRevisions);
  await db.delete(schema.meetings);
  await db.delete(schema.corrections);
  await db.delete(schema.reviewQueue);
  await db.delete(schema.battleCards);
  await db.delete(schema.plays);
  await db.delete(schema.yards);
  await db.delete(schema.persons);
  await db.delete(schema.orgs);
  await db.delete(schema.markets);
}
