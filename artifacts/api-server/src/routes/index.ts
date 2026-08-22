import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";

const router: IRouter = Router();

// NOTE: the outreach route (POST /api/search/outreach) was removed on
// 2026-08-22 per Cassin's correction. The tool no longer generates
// personalised messages. Instead, /api/v1/people/:id/enrich surfaces
// each contact's topics of interest (role changes, projects, statements,
// conferences) so the operator can write their own message.

router.use(healthRouter);
router.use(searchRouter);

export default router;
