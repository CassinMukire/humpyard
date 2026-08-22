// =============================================================================
// Auth module — public API
//
// v1 = single user (Cassin). Multi-user in October.
// =============================================================================

export { hashPassword, verifyPassword, isHash } from "./passwords";
export {
  generateToken,
  hashToken,
  createSession,
  getSession,
  touchSession,
  destroySession,
  purgeExpiredSessions,
  listActiveSessions,
  SESSION_TTL_MS,
  type Session,
} from "./tokens";
export { logAuthEvent, listAuthEvents, type AuthEvent, type AuthAuditEntry } from "./audit";
