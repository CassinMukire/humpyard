// =============================================================================
// Drizzle schema barrel
//
// All v1 entities live here. The wire-format Zod schemas (in
// lib/api-zod/src/manual/schemas.ts) are the source of truth for shape and
// validation; these tables are the source of truth for storage. They are
// kept in sync — a drift between the two is a bug.
//
// Indexes are intentionally minimal in v1; we add more in October when we
// know which queries are slow.
// =============================================================================

export * from "./enums";
export * from "./markets";
export * from "./yards";
export * from "./orgs";
export * from "./persons";
export * from "./plays";
export * from "./signals";
export * from "./corrections";
export * from "./review-queue";
export * from "./battle-cards";
export * from "./doctrine-revisions";
export * from "./meetings";
export * from "./sessions";
export * from "./audit-log";
