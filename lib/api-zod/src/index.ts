// =============================================================================
// api-zod barrel
//
// v1 entity shapes (SourcedFact, Market, Yard, Org, Person, Play, Correction,
// MeetingLog, ReviewQueueItem, BattleCard, DoctrineRevision) live in
// `manual/schemas.ts` — they are the source of truth and not regenerated.
//
// Generated schemas from the OpenAPI spec (existing search/outreach endpoints
// plus the new dossier/review-queue/monday-sync/battle-card endpoints) are
// re-exported from `generated/`. After modifying `openapi.yaml`, run:
//   pnpm --filter @workspace/api-spec run codegen
// =============================================================================

export * from "./generated/api";
export * from "./generated/types";

// Manual v1 entity schemas
export * from "./manual/schemas";
