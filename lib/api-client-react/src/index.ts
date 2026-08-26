export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter, customFetch } from "./custom-fetch";
export { ApiError, ResponseParseError } from "./custom-fetch";
export type { CustomFetchOptions, ErrorType, BodyType, AuthTokenGetter } from "./custom-fetch";

// Re-export the v1 manual entity types (SourcedFact, Market, Yard, Org,
// Person, PersonInterest, Play, etc.) so the UI can use them as props
// without an extra import. The generated types above are for the legacy
// scanner endpoints; the v1 types are the future.
export type {
  Confidence,
  VerifiedBy,
  SourcedFact,
  V1SourceLink as SourceLink,
  Tier,
  Posture,
  PostureHistoryEntry,
  FiveQuestions,
  Market,
  YardStatus,
  Geo,
  Yard,
  OrgType,
  Org,
  RelationshipStatus,
  RoleHistoryEntry,
  Person,
  PersonInterest,
  PlayStatus,
  Play,
  CorrectionAction,
  Correction,
  ReviewQueueItem,
  BattleCard,
  DoctrineRevision,
} from "@workspace/api-zod";
