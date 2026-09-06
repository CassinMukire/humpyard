// =============================================================================
// v1 API client — thin fetch wrapper for the /api/v1/* endpoints.
//
// The v1 endpoints aren't auto-generated (they're manual Zod schemas, not
// openapi). Use this module instead of importing customFetch directly so
// the base URL handling stays consistent.
// =============================================================================

import { customFetch } from "@workspace/api-client-react";
import type {
  Market,
  Yard,
  Org,
  Person,
  Play,
  BattleCard,
  ReviewQueueItem,
} from "@workspace/api-client-react";

// -----------------------------------------------------------------------------
// Dossier endpoints
// -----------------------------------------------------------------------------

export interface DossierResponse {
  market: Market;
  yards: Yard[];
  orgs: Org[];
  people_by_org: { org: Org; people: Person[] }[];
  plays: Play[];
}

export async function listDossiers(): Promise<{ markets: Market[] }> {
  return customFetch<{ markets: Market[] }>("/api/v1/dossiers");
}

export async function getDossier(id: string): Promise<DossierResponse> {
  return customFetch<DossierResponse>(`/api/v1/dossiers/${encodeURIComponent(id)}`);
}

// -----------------------------------------------------------------------------
// Review queue
// -----------------------------------------------------------------------------

export async function listReviewQueue(opts?: {
  marketId?: string;
  includeArchived?: boolean;
}): Promise<{ items: ReviewQueueItem[] }> {
  const params = new URLSearchParams();
  if (opts?.marketId) params.set("market_id", opts.marketId);
  if (opts?.includeArchived) params.set("include_archived", "true");
  const qs = params.toString();
  return customFetch<{ items: ReviewQueueItem[] }>(
    `/api/v1/review-queue${qs ? `?${qs}` : ""}`,
  );
}

export async function promoteReviewQueueItem(
  id: string,
  options: { kind: string; proposed: Record<string, unknown> },
): Promise<{ ok: true }> {
  return customFetch<{ ok: true }>(`/api/v1/review-queue/${encodeURIComponent(id)}/promote`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function discardReviewQueueItem(
  id: string,
  reason?: string,
): Promise<{ ok: true }> {
  return customFetch<{ ok: true }>(`/api/v1/review-queue/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ reason: reason ?? "" }),
  });
}

// -----------------------------------------------------------------------------
// Battle cards
// -----------------------------------------------------------------------------

export async function listBattleCards(): Promise<{ cards: BattleCard[] }> {
  return customFetch<{ cards: BattleCard[] }>("/api/v1/battle-cards");
}

export async function getBattleCard(orgId: string): Promise<{ card: BattleCard }> {
  return customFetch<{ card: BattleCard }>(`/api/v1/battle-cards/${encodeURIComponent(orgId)}`);
}

// -----------------------------------------------------------------------------
// System info
// -----------------------------------------------------------------------------

export interface SystemInfo {
  demo_mode: boolean;
  auth_disabled: boolean;
  monday_configured: boolean;
  monday_board_people_id: string | null;
  proxycurl_configured: boolean;
  exa_configured: boolean;
  openai_configured: boolean;
  node_env: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return customFetch<SystemInfo>("/api/v1/system/info");
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return customFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<void> {
  await customFetch("/api/v1/auth/logout", { method: "POST" });
}

export async function me(): Promise<{ user: string; expires_at: string | null }> {
  return customFetch<{ user: string; expires_at: string | null }>("/api/v1/auth/me");
}

// -----------------------------------------------------------------------------
// People — F3 manual_linkedin_url paste flow
// -----------------------------------------------------------------------------

export interface PersonPatch {
  manual_linkedin_url?: string | null;
  relationship_status?: "none" | "identified" | "contacted" | "active" | "strong";
}

export async function patchPerson(
  id: string,
  patch: PersonPatch,
): Promise<{ person: Person }> {
  return customFetch<{ person: Person }>(
    `/api/v1/people/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

/**
 * Build the LinkedIn people-search URL the operator clicks to find a
 * person manually. Per F3: no API enrichment. The UI opens this in a
 * new tab, the operator pastes back the URL they found.
 */
export function linkedInSearchUrl(name: string, org: string | null): string {
  const keywords = [name, org].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

// -----------------------------------------------------------------------------
// Signals — Phase 7 radar
// -----------------------------------------------------------------------------

export type SignalSource =
  | "ted_eu"
  | "cupt_feniks"
  | "eradis"
  | "utk"
  | "zakazky_sz"
  | "vaylavirasto"
  | "exa"
  | "manual";

export type SignalStatus = "new" | "promoted" | "dismissed" | "acted";

export interface Signal {
  id: string;
  source: SignalSource;
  external_id: string;
  url: string;
  title: string;
  summary: {
    value: string;
    source_url: string;
    retrieved_at: string;
    confidence: "V" | "O" | "I";
    verified_by: string | null;
  };
  market_id: string | null;
  posted_at: string | null;
  fetched_at: string;
  status: SignalStatus;
  promoted_to_play_id: string | null;
  dismissed_reason: string | null;
  notes: string | null;
}

export async function listSignals(opts?: {
  status?: SignalStatus;
  marketId?: string;
  limit?: number;
}): Promise<{ items: Signal[]; count: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.marketId) params.set("market_id", opts.marketId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return customFetch<{ items: Signal[]; count: number }>(
    `/api/v1/signals${qs ? `?${qs}` : ""}`,
  );
}

export async function promoteSignal(
  id: string,
  body: { action: string; owner?: string; due?: string; doctrine_ref?: string },
): Promise<{ signal: Signal; play: { id: string; action: string } }> {
  return customFetch(`/api/v1/signals/${encodeURIComponent(id)}/promote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function dismissSignal(id: string, reason: string): Promise<Signal> {
  return customFetch<Signal>(`/api/v1/signals/${encodeURIComponent(id)}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// -----------------------------------------------------------------------------
// Snapshots — F2b source caching (Cassin v1.7 story, Wednesday scene)
//
// The api-server caches each unique source URL to data/snapshots/<sha256>.html
// + an index. The dossier page loads the index once and looks up the
// snapshot URL per fact. The "📸 cached" badge next to a fact links to
// /snapshots/<sha>.html — works offline because the SPA was loaded once
// OR the file is in the static offline bundle.
// -----------------------------------------------------------------------------

export interface SnapshotEntry {
  url: string;
  sha256: string;
  fetched_at: string;
  size_bytes: number;
  snapshot_url: string; // /snapshots/<sha>.html
}

export async function listSnapshots(): Promise<{ entries: SnapshotEntry[]; count: number }> {
  return customFetch<{ entries: SnapshotEntry[]; count: number }>("/api/v1/snapshots");
}

/**
 * Build a quick lookup Map<url, SnapshotEntry> from the full list. Used by
 * the dossier page to render the "📸 cached" badge per fact.
 */
export function snapshotIndex(entries: SnapshotEntry[]): Map<string, SnapshotEntry> {
  return new Map(entries.map((e) => [e.url, e]));
}

// -----------------------------------------------------------------------------
// Review queue (FP2 / v1.7 fair contact note flow)
// -----------------------------------------------------------------------------
//
// Per Cassin's v1.7 story, Wednesday FP2 demo: "new contact noted → lands in
// review queue as [I], NOT directly in register as truth." The dossier page
// has an inline form per org that POSTs to /api/v1/review-queue with
// kind=person. Cassin promotes the item later (review-queue page) once they
// have a LinkedIn URL or a primary source.
// -----------------------------------------------------------------------------

export interface AddReviewQueueItem {
  kind: "person" | "yard" | "org" | "tender" | "source_link";
  proposed: Record<string, unknown>;
  market_id?: string;
  raw_snippet?: string;
  source_url?: string;
}

export async function addReviewQueueItem(item: AddReviewQueueItem): Promise<{ ok: true; id: string }> {
  return customFetch<{ ok: true; id: string }>("/api/v1/review-queue", {
    method: "POST",
    body: JSON.stringify(item),
  });
}
