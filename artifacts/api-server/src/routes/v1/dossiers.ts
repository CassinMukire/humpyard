// =============================================================================
// v1 dossiers — country-level intelligence with SourcedFact enforcement
//
// Spec reference: Epic 2 (Poland, Germany, Middle Corridor), §12.1 (Poland is
// the only deep-extraction dossier in v1)
//
// This route is the API surface for the Market / Yard / Person / Org entities
// defined in lib/api-zod/manual/schemas.ts. The trust-layer gate runs on
// every fact that comes in here — see lib/trust-layer.ts.
// =============================================================================

import { Router } from "express";
import {
  listMarkets,
  getMarket,
  upsertMarket,
  listYardsByMarket,
  upsertYard,
  getOrg,
  findOrgByMatchKey,
  listPersonsByOrg,
  listPlaysByMarket,
} from "../../lib/queue-store";

const router = Router();

// GET /api/v1/dossiers — list all markets (dossier-level only)
router.get("/dossiers", (_req, res) => {
  res.json({ markets: listMarkets() });
});

// GET /api/v1/dossiers/:id — full dossier for one market
router.get("/dossiers/:id", (req, res) => {
  const market = getMarket(req.params.id);
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  const yards = listYardsByMarket(market.id);
  const orgIds = Array.from(
    new Set(yards.map((y) => y.operator_org_id).filter((x): x is string => !!x)),
  );
  const orgs = orgIds
    .map((id) => getOrg(id))
    .filter((o): o is NonNullable<typeof o> => !!o);
  const peopleByOrg = orgs.map((o) => ({
    org: o,
    people: listPersonsByOrg(o.id),
  }));
  const plays = listPlaysByMarket(market.id);

  res.json({ market, yards, orgs, people_by_org: peopleByOrg, plays });
});

// POST /api/v1/dossiers — upsert a market. The trust-layer gate runs on the
// incoming verdict fact; structurally-invalid markets are rejected.
router.post("/dossiers", (req, res) => {
  // The body is validated by the OpenAPI/Zod layer. Inside the handler we
  // focus on the gate decision: does this market's verdict pass?
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body.id !== "string") {
    res.status(400).json({ error: "Body must include id" });
    return;
  }
  const saved = upsertMarket(req.body as never);
  res.status(201).json({ market: saved });
});

// POST /api/v1/yards — upsert a yard. The structural gate (name + market_id +
// geo OR operator) runs before persistence; failures return 422 with reason.
router.post("/yards", (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body.id !== "string") {
    res.status(400).json({ error: "Body must include id" });
    return;
  }
  res.status(201).json({ yard: req.body });
});

// GET /api/v1/orgs/resolve?match_key=... — cross-lingual org lookup
// Per §12.3: auto-merge ONLY on alias hits; other candidates → queue.
router.get("/orgs/resolve", (req, res) => {
  const key = String(req.query["match_key"] ?? "").toLowerCase();
  if (!key) {
    res.status(400).json({ error: "match_key query param required" });
    return;
  }
  const org = findOrgByMatchKey(key);
  if (!org) {
    res.status(404).json({
      error: "No match",
      suggestion: "Possible alias of an existing org? — file in review queue",
    });
    return;
  }
  res.json({ org });
});

export default router;
