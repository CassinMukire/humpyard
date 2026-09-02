// =============================================================================
// Trust Layer — the gate that decides what renders vs what goes to review queue
//
// Spec reference: US-1.1, US-1.2, US-1.3, §11.3, §11.7, §12.3
//
// Hard rules:
// - A fact with no resolvable source CANNOT render in a dossier.
// - [V] = primary source OR ≥2 independent non-primary sources OR human confirm
// - [O] = single secondary source → review queue (or render if corroborated)
// - [I] = model inference → always review queue, never auto-[V]
// - Watchlist countries' extraction results do NOT feed the entity queue in v1
// - Review queue auto-archives after 14 days unreviewed (§11.7)
// =============================================================================

import type { SourcedFact, Confidence, VerifiedBy } from "@workspace/api-zod";

// -----------------------------------------------------------------------------
// Primary domain whitelist
//
// W34 deliverable: builder seeds this file. Cassin approves. Edit here, not in
// scattered regex/conditionals, so the trust rule is auditable in one place.
// "Independent sources" (§12.3) = distinct root domains AND non-identical text.
// -----------------------------------------------------------------------------

export const PRIMARY_DOMAIN_WHITELIST: ReadonlySet<string> = new Set<string>([
  // Poland (dossier market)
  "plk-sa.pl",
  "gov.pl",
  "paih.gov.pl",
  "cpk.pl",
  "utk.gov.pl",
  // EU procurement (primary for tenders)
  "ted.europa.eu",
  // Germany (watchlist+)
  "db-infra.go",
  "bahn.de",
  // Middle Corridor (watchlist+)
  "railways.kz",
  "temirzholy.kz",
  "uzrailway.uz",
  // Multilateral funders (primary when grant references appear)
  "worldbank.org",
  "ebrd.com",
  "adb.org",
  "eib.org",
  // DECEL's own assets (when used as primary source for what we shipped)
  "decel.com",
]);

// A fact is "primary" if its source_url host matches this whitelist
// (exact match or one-level subdomain).
export function isPrimaryDomain(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return false;
  }
  if (PRIMARY_DOMAIN_WHITELIST.has(host)) return true;
  // Allow one-level subdomain: foo.plk-sa.pl → plk-sa.pl
  const parts = host.split(".");
  if (parts.length >= 3) {
    const parent = parts.slice(-2).join(".");
    if (PRIMARY_DOMAIN_WHITELIST.has(parent)) return true;
  }
  return false;
}

// =============================================================================
// F2 source rule (Cassin v1.6 brief)
//
// "Every claim links to the page evidencing that claim + cached snapshot.
//  Homepage/Wikipedia ≠ [V]."
//
// A "homepage" is a URL with an empty or root-only path (`/`, ``, `?query`).
// The org's homepage is NOT evidence for any specific claim — the operator
// can read the homepage, but the homepage doesn't say "we have 28 hump
// yards" or "we do X capex in Q3 2026". The specific page that proves
// the claim is required.
//
// Wikipedia is explicitly excluded by Cassin: the site is a tertiary
// source (good for orientation, bad as evidence).
// =============================================================================

const HOMEPAGE_PATH_RE = /^(\/?|\?[^#]*|#.*)$/;
const WIKIPEDIA_HOST_RE = /(?:^|\.)wikipedia\.org$/i;

export interface SourceRuleDecision {
  /** True if the URL passes the F2 source rule (page evidences the claim). */
  ok: boolean;
  /** If not ok, why. UI surfaces this in the badge tooltip. */
  reason: string;
}

/**
 * Apply the F2 source rule to a URL. Returns whether the URL is acceptable
 * as evidence for a claim that has been labeled [V].
 *
 * Rejection reasons:
 *   - "homepage" — URL has no path or just "/" / "?query"; it's the org root
 *   - "wikipedia" — Wikipedia is excluded by spec
 *   - "invalid" — URL doesn't parse
 */
export function checkSourceRule(url: string): SourceRuleDecision {
  if (!url || url.trim() === "") {
    return { ok: false, reason: "empty source URL" };
  }
  if (url.startsWith("internal://")) {
    return { ok: true, reason: "internal (doctrine)" };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (WIKIPEDIA_HOST_RE.test(parsed.hostname)) {
    return { ok: false, reason: "wikipedia.org excluded by spec" };
  }
  if (HOMEPAGE_PATH_RE.test(parsed.pathname + parsed.search)) {
    return { ok: false, reason: "homepage link is not evidence for a specific claim" };
  }
  return { ok: true, reason: "page evidences claim" };
}

// -----------------------------------------------------------------------------
// Gate result
// -----------------------------------------------------------------------------

export type GateResult = "render" | "queue" | "discard";

export interface GateDecision {
  result: GateResult;
  reason: string;
}

// US-1.2 structural gate: text fragments CANNOT become Yard entities. A
// "fragment" = no name, or no market_id, or name is clearly not a yard
// (single common word, section heading pattern, etc.). Real-looking yard
// names that lack geo/operator go to queue for human review — NOT discarded.
// A Yard is only "render-eligible" when it has name + market_id + (geo OR operator).
export function gateYardStructural(input: {
  name?: string;
  market_id?: string;
  geo?: { lat: number | null; lon: number | null } | null;
  operator_org_id?: string | null;
}): GateDecision {
  if (!input.name || input.name.trim().length < 3) {
    return { result: "discard", reason: "Yard requires a name" };
  }
  if (!input.market_id) {
    return { result: "discard", reason: "Yard requires a market_id" };
  }
  const hasGeo =
    input.geo !== null &&
    input.geo !== undefined &&
    input.geo.lat !== null &&
    input.geo.lon !== null;
  const hasOperator =
    input.operator_org_id !== null &&
    input.operator_org_id !== undefined &&
    input.operator_org_id !== "";
  if (hasGeo || hasOperator) {
    return { result: "queue", reason: "Structural gate passed (geo or operator present); awaiting source/confidence check" };
  }
  // No geo, no operator → still queue (not discard), so a human can promote
  // after adding the missing field. Only fragments should be discarded, and
  // the lack of geo/operator alone is not evidence of fragment-ness.
  return {
    result: "queue",
    reason: "Real-looking yard name without geo/operator — needs human review",
  };
}

// SourcedFact gate: does this fact pass the confidence + verification bar?
export function gateSourcedFact(fact: SourcedFact): GateDecision {
  // Hard rule: no resolvable source → discard
  if (!fact.source_url || fact.source_url.trim() === "") {
    return { result: "discard", reason: "No resolvable source_url" };
  }

  // F2 source rule (Cassin v1.6): homepage / Wikipedia URLs cannot be
  // primary evidence for any specific claim. We don't change the
  // caller-supplied confidence here — we only annotate why a [V] is
  // not actually rendering-eligible. The dossier route handler is
  // expected to display the source-rule reason in the badge tooltip.
  const sourceRule = checkSourceRule(fact.source_url);

  // [V] = primary source + rule verification → render
  if (fact.confidence === "V") {
    if (fact.verified_by === "human" || fact.verified_by === "human-import") {
      return { result: "render", reason: "[V] human verification" };
    }
    if (isPrimaryDomain(fact.source_url) && fact.verified_by === "rule") {
      if (!sourceRule.ok) {
        // F2: even on a primary domain, a homepage link is not evidence.
        return {
          result: "queue",
          reason: `[V] rejected by F2 source rule: ${sourceRule.reason}`,
        };
      }
      return { result: "render", reason: "[V] primary domain + rule verification" };
    }
    // [V] without primary domain or human → downgrade to queue (needs human review)
    return {
      result: "queue",
      reason: "[V] claim on non-primary domain — needs human confirmation",
    };
  }

  // [O] = single secondary source → queue (needs corroboration to render)
  if (fact.confidence === "O") {
    return {
      result: "queue",
      reason: "[O] single secondary source — needs corroboration or human confirm",
    };
  }

  // [I] = model inference → queue (never auto-[V])
  if (fact.confidence === "I") {
    return {
      result: "queue",
      reason: "[I] inferred — must be human-promoted to render",
    };
  }

  return { result: "discard", reason: "Unknown confidence value" };
}

// Combined gate: structural + sourced fact
export function gateEntity(input: {
  structural: GateDecision;
  fact?: SourcedFact;
}): GateDecision {
  if (input.structural.result === "discard") return input.structural;
  if (!input.fact) {
    return { result: "queue", reason: "Structural pass; no SourcedFact attached" };
  }
  const factDecision = gateSourcedFact(input.fact);
  // If structural says "queue" but fact says "render", trust the fact.
  // If structural says "queue" and fact says "queue", result is queue.
  // If structural says "queue" and fact says "discard", result is discard.
  if (input.structural.result === "render" || factDecision.result === "render") {
    return factDecision.result === "render" ? factDecision : input.structural;
  }
  if (factDecision.result === "discard") return factDecision;
  return input.structural;
}

// -----------------------------------------------------------------------------
// Review queue housekeeping
// -----------------------------------------------------------------------------

export const REVIEW_QUEUE_AUTO_ARCHIVE_DAYS = 14;

export function isQueueItemStale(ts: string, now: Date = new Date()): boolean {
  const then = new Date(ts);
  const ageMs = now.getTime() - then.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > REVIEW_QUEUE_AUTO_ARCHIVE_DAYS;
}

// -----------------------------------------------------------------------------
// Confidence assignment (mechanical, §11.3)
// -----------------------------------------------------------------------------

export interface ConfidenceAssignment {
  confidence: Confidence;
  verified_by: VerifiedBy;
  reason: string;
}

export function assignConfidence(input: {
  sourceUrl: string;
  sourceCount: number;
  // For [I]: the inputs the model was inferred from
  inferredFrom?: string[];
  humanConfirmed?: boolean;
  docImported?: boolean;
  humanImported?: boolean;
}): ConfidenceAssignment {
  if (input.humanConfirmed || input.humanImported) {
    return {
      confidence: "V",
      verified_by: input.humanImported ? "human-import" : "human",
      reason: "Human confirmed",
    };
  }
  if (input.docImported) {
    // machine-parsed from a trusted doc → still [V] but provenance is doc-import
    return {
      confidence: "V",
      verified_by: "doc-import",
      reason: "Machine-parsed from trusted document",
    };
  }
  if (isPrimaryDomain(input.sourceUrl)) {
    return {
      confidence: "V",
      verified_by: "rule",
      reason: "Primary source domain",
    };
  }
  if (input.sourceCount >= 2) {
    return {
      confidence: "V",
      verified_by: "rule",
      reason: "≥2 independent non-primary sources",
    };
  }
  if (input.inferredFrom && input.inferredFrom.length > 0) {
    return {
      confidence: "I",
      verified_by: null,
      reason: "Model inference from inputs",
    };
  }
  return {
    confidence: "O",
    verified_by: null,
    reason: "Single secondary source",
  };
}
