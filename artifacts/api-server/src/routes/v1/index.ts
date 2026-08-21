// =============================================================================
// v1 routes — all gated by requireAuth (single-user basic auth in v1)
//
// Spec reference: §11.8, §12.1 (Cassin only in v1, multi-user in October).
// Mounted at /api/v1/* in app.ts.
// =============================================================================

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import dossiersRouter from "./dossiers";
import reviewQueueRouter from "./review-queue";
import battleCardsRouter from "./battle-cards";
import mondaySyncRouter from "./monday-sync";

const router = Router();

// All v1 routes require auth
router.use(requireAuth);

router.use(dossiersRouter);
router.use(reviewQueueRouter);
router.use(battleCardsRouter);
router.use(mondaySyncRouter);

export default router;
