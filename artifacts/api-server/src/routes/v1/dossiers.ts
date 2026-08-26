// =============================================================================
// v1 dossiers — country-level intelligence with SourcedFact enforcement
// Spec reference: Epic 2 (Poland, Germany, Middle Corridor), §12.1
// All async — backed by Drizzle/Postgres.
// =============================================================================

import { Router } from "express";
import {
  listMarkets,
  getMarket,
  upsertMarket,
  listYardsByMarket,
  getOrg,
  findOrgByMatchKey,
  listPersonsByOrg,
  listPlaysByMarket,
} from "../../lib/store-factory";
import { validateBody } from "../../middlewares/validate";
import { MarketSchema, type Market } from "@workspace/api-zod";

const router = Router();

// GET /api/v1/dossiers — list all markets
router.get("/dossiers", async (_req, res, next) => {
  try {
    res.json({ markets: await listMarkets() });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dossiers/:id — full dossier for one market
router.get("/dossiers/:id", async (req, res, next) => {
  try {
    const market = await getMarket(req.params.id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }
    const yards = await listYardsByMarket(market.id);
    const orgIds = Array.from(
      new Set(yards.map((y) => y.operator_org_id).filter((x): x is string => !!x)),
    );
    const orgs = (
      await Promise.all(orgIds.map((id) => getOrg(id)))
    ).filter((o): o is NonNullable<typeof o> => !!o);
    const peopleByOrg = await Promise.all(
      orgs.map(async (o) => ({ org: o, people: await listPersonsByOrg(o.id) })),
    );
    const plays = await listPlaysByMarket(market.id);
    res.json({ market, yards, orgs, people_by_org: peopleByOrg, plays });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/dossiers — upsert a market (Cassin/admin)
router.post(
  "/dossiers",
  validateBody(MarketSchema),
  async (req, res, next) => {
    try {
      const market = (req as unknown as { validatedBody: Market }).validatedBody;
      const saved = await upsertMarket(market);
      res.status(201).json({ market: saved });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/orgs/resolve?match_key=... — cross-lingual org lookup
// Per §12.3: auto-merge ONLY on alias hits; other candidates → queue.
router.get("/orgs/resolve", async (req, res, next) => {
  try {
    const key = String(req.query["match_key"] ?? "").toLowerCase();
    if (!key) {
      res.status(400).json({ error: "match_key query param required" });
      return;
    }
    const org = await findOrgByMatchKey(key);
    if (!org) {
      res.status(404).json({
        error: "No match",
        suggestion: "Possible alias of an existing org? — file in review queue",
      });
      return;
    }
    res.json({ org });
  } catch (err) {
    next(err);
  }
});

export default router;
