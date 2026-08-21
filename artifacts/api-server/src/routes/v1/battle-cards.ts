// =============================================================================
// v1 battle cards — pre-rendered offline target briefings
//
// Spec reference: US-4.1, US-4.2, §11.4 (NO runtime LLM in battle mode)
//
// All cards are pre-rendered at ingestion / curation time, served as static
// JSON, and cached client-side as a PWA. The <5s mobile requirement dies the
// day a card waits on an LLM. LLM work happens at ingestion and curation
// time only. This also caps messe-week API costs at ~zero.
// =============================================================================

import { Router } from "express";
import {
  listBattleCards,
  getBattleCard,
  upsertBattleCard,
} from "../../lib/queue-store";
import { BattleCardSchema } from "@workspace/api-zod";
import type { BattleCard } from "@workspace/api-zod";

const router = Router();

// GET /api/v1/battle-cards — list all (used by the offline bundle generator)
router.get("/battle-cards", (_req, res) => {
  res.json({ cards: listBattleCards() });
});

// GET /api/v1/battle-cards/:orgId — one card (used by mobile in <5s)
router.get("/battle-cards/:orgId", (req, res) => {
  const card = getBattleCard(req.params.orgId);
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json({ card });
});

// PUT /api/v1/battle-cards/:orgId — upsert a card. Cassin-authored doctrine
// (per §11.10). Validated by Zod. Records a DoctrineRevision (§11.11).
router.put("/battle-cards/:orgId", (req, res) => {
  const orgId = req.params.orgId;
  const parsed = BattleCardSchema.safeParse({ ...req.body, org_id: orgId });
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid battle card",
      issues: parsed.error.issues,
    });
    return;
  }
  const card: BattleCard = parsed.data;
  const saved = upsertBattleCard(card);
  res.json({ card: saved });
});

export default router;
