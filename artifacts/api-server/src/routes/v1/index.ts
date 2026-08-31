// =============================================================================
// v1 routes
//
// Spec reference: §11.8, §12.1 (Cassin only in v1, multi-user in October).
// Mounted at /api/v1/* in app.ts.
//
// Auth flow: /api/v1/auth/login is public (it issues the session token).
// Every other v1 route is gated by requireAuth.
// =============================================================================

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import authRouter from "./auth";
import dossiersRouter from "./dossiers";
import reviewQueueRouter from "./review-queue";
import battleCardsRouter from "./battle-cards";
import mondaySyncRouter from "./monday-sync";
import linkedinRouter from "./linkedin";
import countryScanRouter from "./country-scan";
import { isDemoMode } from "../../lib/store-factory";
import { logger } from "../../lib/logger";

const router = Router();

// Login is public (returns the session token). All other auth sub-routes
// (/logout, /me, /sessions) require the token.
router.use("/auth", authRouter);

// Everything else is gated.
router.use(requireAuth);

// GET /api/v1/system/info — runtime config (gated, safe to expose to the
// operator). Tells the UI which store backend is live. `in_memory_store`
// is exposed so the UI can show a clear warning badge when running on the
// dev-only in-memory backend. In production, this field is always false.
router.get("/system/info", (_req, res) => {
  const inMemory = isDemoMode();
  const authDisabled = process.env["DISABLE_AUTH"] === "true";
  const nodeEnv = process.env["NODE_ENV"] ?? "development";
  // Surface a startup-time error in the logs so an operator sees a
  // misconfiguration immediately, not silently.
  if (nodeEnv === "production" && (inMemory || authDisabled)) {
    logger.error(
      { inMemory, authDisabled },
      "system/info: production is running with dev-only flags set — investigate",
    );
  }
  res.json({
    in_memory_store: inMemory,
    auth_disabled: authDisabled,
    monday_configured: !!process.env["MONDAY_API_TOKEN"],
    monday_board_people_id: process.env["MONDAY_BOARD_PEOPLE_ID"] || null,
    proxycurl_configured: !!process.env["PROXYCURL_API_KEY"],
    exa_configured: !!process.env["EXA_API_KEY"],
    openai_configured: !!process.env["OPENAI_API_KEY"],
    node_env: nodeEnv,
    build_sha: process.env["BUILD_SHA"] ?? null,
    started_at: process.env["STARTED_AT"] ?? new Date().toISOString(),
  });
});

router.use(dossiersRouter);
router.use(reviewQueueRouter);
router.use(battleCardsRouter);
router.use(mondaySyncRouter);
router.use(linkedinRouter);
router.use(countryScanRouter);

export default router;
