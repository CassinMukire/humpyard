// =============================================================================
// v1.1.7 — Cassin's battle-card content corrections (2026-09-15 review).
//
// 1. Move Wabtec from relationship → recon (Cassin)
//
// 2. Delete duplicate Axtone card:
//    - Old: org_axtone          (cassin-authored, 2026-09-02) — DELETE
//    - New: org_axtone_s_a       (ai-draft from F6 import, 2026-09-14) — KEEP
//
// 3. Add PKP LHS card (Card #30 from F6 — should already be imported but was
//    not). PKP LHS = PKP Linia Hutnicza Szerokotorowa (Polens 1520mm-linje).
//    The importer's slugify turned "PKP LHS (bredspårslinjen)" into
//    org_pkp_lhs_bredsparrslinjen — but that doesn't match Cassin's id
//    expectation. Create org_pkp_lhs with the F6 #30 content (Swedish text
//    verbatim, English questions verbatim, doctrine_updated_by = "ai-draft").
//
// 4. Remove Bautan Kutlu / Business Sweden (Turkey closed 2 Sep):
//    - DELETE org_bautan_kutlu_business_sweden
//    - DELETE battle_card WHERE org_id = org_bautan_kutlu_business_sweden
//
// Idempotent: re-running on already-applied state is a no-op (logged).
// =============================================================================

import { eq } from "drizzle-orm";
import { isDemoMode, upsertOrg, upsertBattleCard, listOrgs, listBattleCards } from "../artifacts/api-server/src/lib/store-factory";
import { db } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import type { Org, BattleCard } from "@workspace/api-zod";

async function main(): Promise<void> {
  if (isDemoMode()) {
    console.error("FATAL: store-factory is in demo mode. Set DATABASE_URL.");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const existingOrgs = await listOrgs();
  const orgById = new Map(existingOrgs.map((o) => [o.id, o]));
  const existingCards = await listBattleCards();
  const cardByOrgId = new Map(existingCards.map((c) => [c.org_id, c]));

  console.log("=== v1.1.7 Cassin's battle-card corrections ===\n");

  // -------------------------------------------------------------------
  // 1. Wabtec: relationship → recon
  // -------------------------------------------------------------------
  {
    const orgId = "org_wabtec";
    const card = cardByOrgId.get(orgId);
    if (!card) {
      console.log(`1. Wabtec — no battle card found (org=${orgId}), skipping`);
    } else if (card.kind === "recon") {
      console.log(`1. Wabtec — already kind=recon, no-op`);
    } else {
      const updated: BattleCard = {
        ...card,
        kind: "recon",
        doctrine_updated_at: now,
        doctrine_version: card.doctrine_version + 1,
        // Note: we keep doctrine_updated_by="ai-draft" since this is a
        // routine reclassification of an F6-imported card. Cassin's sign-off
        // happens in Phase 1 #4 review pass.
      };
      await upsertBattleCard(updated);
      console.log(`1. Wabtec — kind updated: ${card.kind} → recon  (v${card.doctrine_version} → v${card.doctrine_version + 1})`);
    }
  }

  // -------------------------------------------------------------------
  // 2. Axtone: delete duplicate (old org_axtone), keep new org_axtone_s_a
  // -------------------------------------------------------------------
  {
    const oldId = "org_axtone";
    const newId = "org_axtone_s_a";
    const oldOrg = orgById.get(oldId);
    const newCard = cardByOrgId.get(newId);
    const oldCard = cardByOrgId.get(oldId);
    if (!oldOrg && !oldCard) {
      console.log(`2. Axtone — duplicate (${oldId}) not present, already removed`);
    } else {
      if (newCard) {
        console.log(`2. Axtone — keeping ${newId} (kind=${newCard.kind}, doctrine_updated_by=${newCard.doctrine_updated_by})`);
        console.log(`            deleting duplicate ${oldId}${oldCard ? ` (doctrine_updated_by=${oldCard.doctrine_updated_by})` : ""} + its org`);
      } else {
        console.log(`2. Axtone — ERROR: keep-org ${newId} has no card; aborting delete to avoid orphaning data`);
        process.exit(1);
      }
      // Hard delete via Drizzle. The store-factory has no deleteOrg API
      // (no admin path needed in v1), so we go directly to the schema.
      await db.delete(schema.battleCards).where(eq(schema.battleCards.org_id, oldId));
      await db.delete(schema.orgs).where(eq(schema.orgs.id, oldId));
      console.log(`            DELETEd org + battle_card for ${oldId}`);
    }
  }

  // -------------------------------------------------------------------
  // 3. PKP LHS: create org + battle card (F6 #30 content)
  // -------------------------------------------------------------------
  {
    const orgId = "org_pkp_lhs";
    if (orgById.get(orgId)) {
      console.log(`3. PKP LHS — org ${orgId} already exists, no-op`);
    } else {
      const org: Org = {
        id: orgId,
        name: "PKP LHS (Linia Hutnicza Szerokotorowa)",
        match_key: "pkp_lhs",
        type: "authority",
        market_ids: ["pl"],
        monday_item_id: null,
        innotrans_target: true,
        customer_category: null,
        k1_door: null,
        risk_facts: [],
        sources: [],
        created_at: now,
        updated_at: now,
      };
      await upsertOrg(org);

      const card: BattleCard = {
        org_id: orgId,
        who_they_are: "PKP LHS (Linia Hutnicza Szerokotorowa) [InnoTrans: CityCube B/430]",
        why_matters:
          "Driver Polens 1520mm-linje till Ukraina med omlastningsnavet Sławków — tung rangering är deras vardag, och Ukraina-korridoren växer (UZ +25 % 2024).",
        known_people: [],
        relationship_status: "identified",
        suggested_questions: [
          "How is Sławków's transshipment capacity developing with Ukraine traffic growth?",
          "What yard equipment investments are planned on the LHS line?",
          "How do you finance infrastructure — own balance sheet or EU instruments?",
        ],
        trap_to_avoid:
          "Eget bolag med egen budget — behandla dem INTE som \"en del av PKP\"; det irriterar och missar deras beslutsmakt.",
        sources: [],
        kind: "recon",
        recon_what_to_observe: undefined,
        way_in: "Doktrin: Driver Polens 1520mm-linje till Ukraina med omlastningsnavet Sławków.",
        opening: null,
        receipt: null,
        doctrine_version: 1,
        doctrine_updated_at: now,
        doctrine_updated_by: "ai-draft",
      };
      await upsertBattleCard(card);
      console.log(`3. PKP LHS — created org + battle card (kind=recon, ai-draft v1)`);
    }
  }

  // -------------------------------------------------------------------
  // 4. Bautan Kutlu / Business Sweden: delete (Turkey closed 2 Sep)
  // -------------------------------------------------------------------
  {
    const orgId = "org_bautan_kutlu_business_sweden";
    const org = orgById.get(orgId);
    const card = cardByOrgId.get(orgId);
    if (!org && !card) {
      console.log(`4. Bautan Kutlu — already gone, no-op`);
    } else {
      await db.delete(schema.battleCards).where(eq(schema.battleCards.org_id, orgId));
      await db.delete(schema.orgs).where(eq(schema.orgs.id, orgId));
      console.log(`4. Bautan Kutlu — DELETEd org + battle_card (Turkey closed 2 Sep)`);
    }
  }

  console.log("\n=== v1.1.7 battle-card edits done ===");
}

main().catch((err) => {
  console.error("v1.1.7 card edits failed:", err);
  process.exit(1);
});
