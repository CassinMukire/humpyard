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
import { isDemoMode } from "../../lib/store-factory";

const router = Router();

// Login is public (returns the session token). All other auth sub-routes
// (/logout, /me, /sessions) require the token.
router.use("/auth", authRouter);

// Everything else is gated.
router.use(requireAuth);

// GET /api/v1/system/info — runtime config (gated, safe to expose to the
// operator). Tells the UI which store backend is live so the dashboard can
// show a clear "DEMO MODE" badge.
router.get("/system/info", (_req, res) => {
  res.json({
    demo_mode: isDemoMode(),
    auth_disabled: process.env["DISABLE_AUTH"] === "true",
    monday_configured: !!process.env["MONDAY_API_TOKEN"],
    monday_board_people_id: process.env["MONDAY_BOARD_PEOPLE_ID"] || null,
    proxycurl_configured: !!process.env["PROXYCURL_API_KEY"],
    exa_configured: !!process.env["EXA_API_KEY"],
    openai_configured: !!process.env["OPENAI_API_KEY"],
    node_env: process.env["NODE_ENV"] ?? "development",
  });
});

router.use(dossiersRouter);
router.use(reviewQueueRouter);
router.use(battleCardsRouter);
router.use(mondaySyncRouter);
router.use(linkedinRouter);

export default router;
