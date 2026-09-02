// =============================================================================
// v1 battle cards — pre-rendered offline target briefings
// Spec reference: US-4.1, US-4.2, §11.4 (NO runtime LLM in battle mode)
// =============================================================================

import { Router } from "express";
import {
  listBattleCards,
  getBattleCard,
  upsertBattleCard,
  recordDoctrineRevision,
  listDoctrineRevisions,
} from "../../lib/store-factory";
import { validateBody } from "../../middlewares/validate";
import { BattleCardSchema, type BattleCard } from "@workspace/api-zod";

const router = Router();

// GET /api/v1/battle-cards — list all (used by the offline bundle generator)
router.get("/battle-cards", async (_req, res, next) => {
  try {
    res.json({ cards: await listBattleCards() });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/battle-cards/:orgId — one card (used by mobile in <5s)
router.get("/battle-cards/:orgId", async (req, res, next) => {
  try {
    const card = await getBattleCard(req.params.orgId);
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    res.json({ card });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/battle-cards/:orgId — upsert a card. Cassin-authored doctrine
// (per §11.10). Validated by Zod. Records a DoctrineRevision (§11.11).
router.put(
  "/battle-cards/:orgId",
  validateBody(BattleCardSchema.partial({ org_id: true })),
  async (req, res, next) => {
    try {
      const orgId = String(req.params.orgId);
      const validated = (req as unknown as { validatedBody: Partial<BattleCard> })
        .validatedBody;
      const existing = await getBattleCard(orgId);
      const nextVersion = (existing?.doctrine_version ?? 0) + 1;
      const card: BattleCard = {
        org_id: orgId,
        who_they_are: validated.who_they_are ?? existing?.who_they_are ?? "",
        why_matters: validated.why_matters ?? existing?.why_matters ?? "",
        known_people: validated.known_people ?? existing?.known_people ?? [],
        relationship_status:
          validated.relationship_status ?? existing?.relationship_status ?? "none",
        suggested_questions: validated.suggested_questions ?? existing?.suggested_questions ?? [],
        trap_to_avoid: validated.trap_to_avoid ?? existing?.trap_to_avoid ?? "",
        sources: validated.sources ?? existing?.sources ?? [],
        kind: validated.kind ?? existing?.kind ?? "relationship",
        recon_what_to_observe:
          validated.recon_what_to_observe ?? existing?.recon_what_to_observe,
        way_in: validated.way_in ?? existing?.way_in ?? null,
        opening: validated.opening ?? existing?.opening ?? null,
        receipt: validated.receipt ?? existing?.receipt ?? null,
        doctrine_version: nextVersion,
        doctrine_updated_at: new Date().toISOString(),
        doctrine_updated_by: validated.doctrine_updated_by ?? "unknown",
      };
      const saved = await upsertBattleCard(card);
      await recordDoctrineRevision({
        content_kind: "battle_card",
        content_id: orgId,
        version: nextVersion,
        diff: JSON.stringify({ from: existing ?? null, to: saved }, null, 2),
        author: card.doctrine_updated_by,
      });
      // F8: log a corrections row for each changed field. The diff is
      // also captured in doctrine_revisions, but the corrections table
      // is the per-field workstyle evidence (operator + old value + ts).
      // Only fields with a real change are logged.
      const user = card.doctrine_updated_by;
      if (existing) {
        const fields: (keyof BattleCard)[] = [
          "who_they_are",
          "why_matters",
          "trap_to_avoid",
          "relationship_status",
          "kind",
          "way_in",
          "opening",
          "receipt",
        ];
        for (const f of fields) {
          const before = existing[f];
          const after = saved[f];
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            const { logCorrection } = await import("../../lib/store-factory");
            await logCorrection({
              fact_id: `battle_card:${orgId}.${f}`,
              fact_kind: "battle_card",
              action: "edit",
              corrected_value: before as never,
              user,
            });
          }
        }
      }
      res.json({ card: saved });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/battle-cards/:orgId/revisions — doctrine edit history
router.get("/battle-cards/:orgId/revisions", async (req, res, next) => {
  try {
    const revisions = await listDoctrineRevisions(
      "battle_card",
      req.params.orgId,
    );
    res.json({ revisions });
  } catch (err) {
    next(err);
  }
});

export default router;
