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
