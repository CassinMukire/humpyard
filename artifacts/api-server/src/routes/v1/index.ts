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

const router = Router();

// Login is public (returns the session token). All other auth sub-routes
// (/logout, /me, /sessions) require the token.
router.use("/auth", authRouter);

// Everything else is gated.
router.use(requireAuth);

router.use(dossiersRouter);
router.use(reviewQueueRouter);
router.use(battleCardsRouter);
router.use(mondaySyncRouter);
router.use(linkedinRouter);

export default router;
