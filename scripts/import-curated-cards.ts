// =============================================================================
// Import Cassin's curated battle cards (F6 — Cassin v1.6 brief)
//
// Per Cassin's brief: "Import path for Cassin's ~30 curated cards
// (markdown delivered Sep 1; JSON available on request). Top-10 live
// in battle mode" by Fri Sep 4 demo.
//
// This script accepts either markdown or JSON input and inserts the
// Orgs, Persons, BattleCards into the live Postgres. Existing rows are
// updated in place (idempotent on the org_id / person_id primary keys).
//
// USAGE:
//
//   1. Markdown (Cassin's `battle-cards-utkast-v1.md`):
//      pnpm tsx scripts/import-curated-cards.ts path/to/battle-cards-utkast-v1.md
//
//   2. JSON (structured):
//      pnpm tsx scripts/import-curated-cards.ts path/to/cards.json
//
// FORMAT (markdown, informal):
//
//      ## Card N: <org_name> — <one-line description>
//
//      **Org ID:** org_xxx
//      **Kind:** relationship | recon | watchlist_plus
//      **Who they are:** <text>
//      **Why this matters:** <text>
//      **Trap to avoid:** <text>
//      **D2 / Way in:** <text>
//      **D2 / Opening:** <text>
//      **D2 / Receipt:** <text>
//      **Suggested questions:**
//      1. <question>
//      2. <question>
//      3. <question>
//      **Sources:**
//      - <url> — <title>
//      - <url> — <title>
//      **Known people:**
//      - <person_id> — <role> — <relationship_status>
//      **Notes:** <free text>
//
// FORMAT (JSON):
//
//      {
//        "cards": [
//          {
//            "org_id": "org_xxx",
//            "name": "Org Name",
//            "kind": "relationship",
//            "who_they_are": "...",
//            "why_matters": "...",
//            "trap_to_avoid": "...",
//            "way_in": "...",
//            "opening": "...",
//            "receipt": "...",
//            "suggested_questions": ["q1", "q2", "q3"],
//            "sources": [{"url": "...", "title": "..."}],
//            "known_people": [
//              {"person_id": "person_yyy", "role": "...", "relationship_status": "contacted"}
//            ]
//          }
//        ]
//      }
//
// All SourcedFacts in the imported cards default to [I] (inference) with
// the source URL. Cassin can promote them to [O] or [V] via the
// battle-card PUT endpoint once the primary source is verified.
//
// The script refuses to run if any required field is missing (org_id,
// name, kind, who_they_are, why_matters, trap_to_avoid). It does NOT
// refuse on missing D2 fields — those are nullable per v1.6 D2.
// =============================================================================

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  upsertOrg,
  upsertPerson,
  upsertBattleCard,
  listOrgs,
  listBattleCards,
  isDemoMode,
} from "../artifacts/api-server/src/lib/store-factory";
import type { Org, BattleCard, Person, PersonInterest, RoleHistoryEntry, V1SourceLink } from "@workspace/api-zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardInput {
  org_id: string;
  name: string;
  kind: "relationship" | "recon" | "watchlist_plus";
  who_they_are: string;
  why_matters: string;
  trap_to_avoid: string;
  way_in?: string;
  opening?: string;
  receipt?: string;
  suggested_questions?: string[];
  sources?: V1SourceLink[];
  known_people?: { person_id: string; role: string; relationship_status: string }[];
  market_ids?: string[];
  innotrans_target?: boolean;
  // optional person data (if a card references a person not yet in DB)
  persons?: Array<{
    id: string;
    name: string;
    role: string;
    org_id: string;
    interests?: Array<{ kind: string; summary: string; source_url: string }>;
  }>;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Markdown parser
// ---------------------------------------------------------------------------

function parseMarkdownCards(md: string): CardInput[] {
  const cards: CardInput[] = [];
  // Split on "## Card N:" headers
  const sections = md.split(/^##\s+Card\s+\d+:/m);
  for (const section of sections.slice(1)) {
    const lines = section.split("\n");
    const titleLine = lines[0]?.trim() ?? ""; // "Org Name — description"
    const name = titleLine.split("—")[0]?.trim() ?? titleLine;
    if (!name) continue;

    const card: CardInput = {
      org_id: "",
      name,
      kind: "relationship",
      who_they_are: "",
      why_matters: "",
      trap_to_avoid: "",
    };

    let currentList: "questions" | "sources" | "people" | null = null;
    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("**Org ID:**")) {
        card.org_id = line.replace("**Org ID:**", "").trim();
        currentList = null;
      } else if (line.startsWith("**Kind:**")) {
        const k = line.replace("**Kind:**", "").trim();
        if (k === "relationship" || k === "recon" || k === "watchlist_plus") {
          card.kind = k;
        }
        currentList = null;
      } else if (line.startsWith("**Who they are:**")) {
        card.who_they_are = line.replace("**Who they are:**", "").trim();
        currentList = null;
      } else if (line.startsWith("**Why this matters:**")) {
        card.why_matters = line.replace("**Why this matters:**", "").trim();
        currentList = null;
      } else if (line.startsWith("**Trap to avoid:**")) {
        card.trap_to_avoid = line.replace("**Trap to avoid:**", "").trim();
        currentList = null;
      } else if (line.startsWith("**D2 / Way in:**")) {
        card.way_in = line.replace("**D2 / Way in:**", "").trim();
        currentList = null;
      } else if (line.startsWith("**D2 / Opening:**")) {
        card.opening = line.replace("**D2 / Opening:**", "").trim();
        currentList = null;
      } else if (line.startsWith("**D2 / Receipt:**")) {
        card.receipt = line.replace("**D2 / Receipt:**", "").trim();
        currentList = null;
      } else if (line.startsWith("**Suggested questions:**")) {
        card.suggested_questions = [];
        currentList = "questions";
      } else if (line.startsWith("**Sources:**")) {
        card.sources = [];
        currentList = "sources";
      } else if (line.startsWith("**Known people:**")) {
        card.known_people = [];
        currentList = "people";
      } else if (line.startsWith("**Notes:**")) {
        card.notes = line.replace("**Notes:**", "").trim();
        currentList = null;
      } else if (currentList === "questions" && /^\d+\./.test(line)) {
        card.suggested_questions!.push(line.replace(/^\d+\.\s*/, ""));
      } else if (currentList === "sources" && line.startsWith("- ")) {
        const m = line.match(/^-\s*(\S+)\s*[—\-]\s*(.+)$/);
        if (m) {
          card.sources!.push({ url: m[1], title: m[2].trim(), live: true });
        } else {
          // Just a URL
          const url = line.replace(/^-\s*/, "").trim();
          if (/^https?:\/\//.test(url)) {
            card.sources!.push({ url, title: url, live: true });
          }
        }
      } else if (currentList === "people" && line.startsWith("- ")) {
        const m = line.match(/^-\s*(\S+)\s*[—\-]\s*(.+?)\s*[—\-]\s*(\w+)\s*$/);
        if (m) {
          card.known_people!.push({
            person_id: m[1],
            role: m[2].trim(),
            relationship_status: m[3].trim(),
          });
        }
      }
    }

    if (card.org_id && card.who_they_are && card.why_matters && card.trap_to_avoid) {
      cards.push(card);
    } else {
      console.warn(`  [warn] skipped card "${name}" (missing required fields)`);
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm tsx scripts/import-curated-cards.ts <path-to-markdown-or-json>");
    process.exit(1);
  }
  if (isDemoMode()) {
    console.error("FATAL: store-factory is in demo mode. Set DATABASE_URL or unset ALLOW_DEMO_STORE.");
    process.exit(1);
  }

  console.log(`F6 import — reading ${filePath}`);
  const raw = await readFile(filePath, "utf8");
  let cards: CardInput[];
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(raw) as { cards: CardInput[] } | CardInput[];
    cards = Array.isArray(parsed) ? parsed : parsed.cards;
  } else {
    cards = parseMarkdownCards(raw);
  }
  console.log(`  parsed ${cards.length} card(s) from input`);

  // Existing orgs (for match_key dedupe)
  const existingOrgs = await listOrgs();
  const existingOrgById = new Map(existingOrgs.map((o) => [o.id, o]));
  const existingOrgByMatchKey = new Map(existingOrgs.map((o) => [o.match_key, o]));

  // Existing cards
  const existingCards = await listBattleCards();
  const existingCardByOrgId = new Map(existingCards.map((c) => [c.org_id, c]));

  let createdOrgs = 0;
  let updatedOrgs = 0;
  let createdPersons = 0;
  let createdCards = 0;
  let updatedCards = 0;
  const errors: string[] = [];

  for (const input of cards) {
    try {
      // 1. Upsert the org
      const matchKey = input.name.toLowerCase().trim();
      let org = existingOrgById.get(input.org_id) ?? existingOrgByMatchKey.get(matchKey);
      if (!org) {
        const newOrg: Org = {
          id: input.org_id,
          name: input.name,
          match_key: matchKey,
          type: input.kind === "competitor" || input.kind === "recon" ? "competitor" : "authority",
          market_ids: input.market_ids ?? [],
          monday_item_id: null,
          innotrans_target: input.innotrans_target ?? true,
          customer_category: null,
          k1_door: null,
          risk_facts: [],
          sources: input.sources ?? [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await upsertOrg(newOrg);
        createdOrgs++;
        existingOrgById.set(newOrg.id, newOrg);
      } else {
        // Update market_ids / sources if the input has them
        if (input.market_ids || input.sources) {
          const updated: Org = {
            ...org,
            market_ids: input.market_ids ?? org.market_ids,
            sources: input.sources ?? org.sources,
            innotrans_target: input.innotrans_target ?? org.innotrans_target,
            updated_at: new Date().toISOString(),
          };
          await upsertOrg(updated);
          updatedOrgs++;
        }
      }

      // 2. Insert referenced persons (if any)
      if (input.persons) {
        for (const p of input.persons) {
          const person: Person = {
            id: p.id,
            name: p.name,
            org_id: p.org_id,
            role: p.role,
            role_history: [] as RoleHistoryEntry[],
            linkedin_url: null,
            manual_linkedin_url: null,
            interests: (p.interests ?? []).map((i) => ({
              kind: (i.kind as PersonInterest["kind"]) ?? "other",
              summary: i.summary,
              fact: {
                value: i.summary,
                source_url: i.source_url,
                retrieved_at: new Date().toISOString(),
                confidence: "O" as const,
                verified_by: "human-import" as const,
              },
            })),
            relationship_owner: "cassin",
            relationship_status: "identified",
            import_meta: {
              method: "doc-import" as const,
              source_ref: `F6 import — ${filePath}`,
              imported_by: "cassin",
              imported_at: new Date().toISOString(),
            },
            last_engagement_at: new Date().toISOString(),
            monday_item_id: null,
            sources: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await upsertPerson(person);
          createdPersons++;
        }
      }

      // 3. Upsert the battle card
      const existingCard = existingCardByOrgId.get(input.org_id);
      const now = new Date().toISOString();
      const card: BattleCard = {
        org_id: input.org_id,
        who_they_are: input.who_they_are,
        why_matters: input.why_matters,
        known_people: (input.known_people ?? []).map((kp) => ({
          person_id: kp.person_id,
          role: kp.role,
          relationship_status: kp.relationship_status as
            | "none"
            | "identified"
            | "contacted"
            | "active"
            | "strong",
        })),
        relationship_status: "identified",
        suggested_questions: (input.suggested_questions ?? []).slice(0, 3),
        trap_to_avoid: input.trap_to_avoid,
        sources: input.sources ?? [],
        kind: input.kind,
        recon_what_to_observe:
          input.kind === "recon" ? (input.suggested_questions ?? []).slice(0, 3) : undefined,
        way_in: input.way_in ?? null,
        opening: input.opening ?? null,
        receipt: input.receipt ?? null,
        doctrine_version: (existingCard?.doctrine_version ?? 0) + 1,
        doctrine_updated_at: now,
        doctrine_updated_by: "cassin",
      };
      await upsertBattleCard(card);
      if (existingCard) updatedCards++;
      else createdCards++;
    } catch (err) {
      errors.push(`${input.org_id ?? input.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  orgs created:    ${createdOrgs}`);
  console.log(`  orgs updated:    ${updatedOrgs}`);
  console.log(`  persons created: ${createdPersons}`);
  console.log(`  cards created:   ${createdCards}`);
  console.log(`  cards updated:   ${updatedCards}`);
  if (errors.length > 0) {
    console.log(`\n  errors:`);
    for (const e of errors) console.log(`    - ${e}`);
    process.exit(1);
  }
  console.log("\nF6 import done.");
}

main().catch((err) => {
  console.error("F6 import failed:", err);
  process.exit(2);
});
