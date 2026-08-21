// =============================================================================
// Drizzle schema — enums (Postgres native enums for trust-critical fields)
// =============================================================================

import { pgEnum } from "drizzle-orm/pg-core";

// Confidence is a one-character field; pgEnum enforces it at the DB level
// so an out-of-band write of "X" or "v" is rejected by Postgres itself.
export const confidenceEnum = pgEnum("confidence", ["V", "O", "I"]);

// Verified-by provenance: who/what classified this fact
export const verifiedByEnum = pgEnum("verified_by", [
  "rule",
  "human",
  "human-import",
  "doc-import",
]);

// Tier (per spec §3, post-spec v1.4 — ANTI replaces legacy "D" naming in DB)
export const tierEnum = pgEnum("tier", ["A", "B", "C", "ANTI"]);

// Posture (human-set, guarded by the ≥2-source/1-confirmation change rule)
export const postureEnum = pgEnum("posture", [
  "IGNORE",
  "WATCH",
  "WARMUP",
  "ENGAGE",
  "WAR",
]);

// Yard status
export const yardStatusEnum = pgEnum("yard_status", [
  "active",
  "dormant",
  "modernizing",
  "planned",
  "unknown",
]);

// Org type
export const orgTypeEnum = pgEnum("org_type", [
  "authority",
  "operator",
  "epc",
  "consultant",
  "financier",
  "competitor",
  "agent",
]);

// Relationship status (Person)
export const relationshipStatusEnum = pgEnum("relationship_status", [
  "none",
  "identified",
  "contacted",
  "active",
  "strong",
]);

// Play status
export const playStatusEnum = pgEnum("play_status", [
  "open",
  "in_progress",
  "done",
  "abandoned",
]);

// Correction action
export const correctionActionEnum = pgEnum("correction_action", [
  "confirm",
  "reject",
  "edit",
]);

// Fact kind (which entity a Correction refers to)
export const factKindEnum = pgEnum("fact_kind", [
  "yard",
  "org",
  "person",
  "market",
  "tender",
  "five_questions",
  "battle_card",
  "source_link",
]);

// Review queue item kind
export const reviewKindEnum = pgEnum("review_kind", [
  "yard",
  "org",
  "person",
  "tender",
  "five_questions",
  "source_link",
]);

// Battle card kind (relationship vs competitor recon)
export const battleCardKindEnum = pgEnum("battle_card_kind", [
  "relationship",
  "recon",
]);

// Doctrine content kind (for revision history)
export const doctrineContentKindEnum = pgEnum("doctrine_content_kind", [
  "five_questions",
  "battle_card",
  "play",
]);
