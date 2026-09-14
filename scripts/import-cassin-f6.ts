// =============================================================================
// Import Cassin's F6 battle cards — one-off (Sep 12, 2026, deadline 11 Sep).
//
// Cassin's markdown format is different from the generic
// `import-curated-cards.ts`:
//
//   ### N. <name> — <hall/stand>
//   **Doktrin:** ...
//   **Frågor:** "q1" "q2" "q3"          (English, in quotes)
//       or
//   **Observera:** 1. item  2. item  3. item   (for [REKON] cards)
//   **Fälla:** ...
//
// Rules per Cassin (2026-09-01 utkast v1):
//   - Card #2 (TCDD) → archived (skip from import; watchlist+ re-eval Oct 1)
//   - "FÖRESLAGNA TILLÄGG" section → skip entirely (change request per §1.5)
//   - All 29 imported cards → doctrine_updated_by = "ai-draft" + sources
//     marked live=false until Cassin reviews (becomes "human" per the
//     status note on the file).
//   - Swedish text (Doktrin + Fälla) kept as-is (not translated).
//   - English questions kept as-is (verbatim, in quotes).
//
// Idempotent: re-running on the same file updates the existing cards
// (matched by org_id slug derived from the name).
//
// USAGE:
//
//   pnpm tsx scripts/import-cassin-f6.ts
//
// Reads: golden-set/battle-cards-cassin-f6.md
// Writes: Orgs + BattleCards in the live Postgres.
// =============================================================================

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  upsertOrg,
  upsertBattleCard,
  listOrgs,
  listBattleCards,
  isDemoMode,
} from "../artifacts/api-server/src/lib/store-factory";
import type { Org, BattleCard, V1SourceLink } from "@workspace/api-zod";

// ---------------------------------------------------------------------------
// Parse Cassin's markdown
// ---------------------------------------------------------------------------

interface ParsedCard {
  number: number;
  name: string;
  hall: string;
  kind: "relationship" | "recon" | "watchlist_plus";
  isRecon: boolean;
  doktrin: string;
  frågor: string[];
  observera: string[];
  fälla: string;
  /** Set when this card is in the FÖRESLAGNA TILLÄGG section → skip */
  inProposedAdditions: boolean;
}

const INPUT_PATH = resolve(process.cwd(), "golden-set/battle-cards-cassin-f6.md");

function parseCassinF6(md: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  // Cards start with "### N. <name>" (or "### N. [REKON] <name>"). Split on
  // those boundaries.
  const chunks = md.split(/(?=^###\s+\d+\.)/m);
  let inProposedAdditions = false;

  for (const chunk of chunks) {
    if (chunk.includes("FÖRESLAGNA TILLÄGG")) {
      inProposedAdditions = true;
      continue;
    }
    if (!/^###\s+\d+\./m.test(chunk)) continue;

    // Title line: "### N. [REKON] Name — Hall" or "### N. Name — Hall"
    const titleLine = chunk.split("\n")[0];
    const titleMatch = titleLine.match(/^###\s+(\d+)\.\s+(.+)$/);
    if (!titleMatch) continue;
    const number = Number(titleMatch[1]);
    const rest = titleMatch[2].trim();
    const isRecon = /^\[REKON\]/.test(rest);
    const namePart = rest.replace(/^\[REKON\]\s*/, "");
    // Split name — hall on the LAST em-dash (some cards have "Co. — Hall")
    const parts = namePart.split(/\s+[—–]\s+/);
    const name = parts[0].trim();
    const hall = parts.slice(1).join(" — ").trim();

    // Doktrin
    const doktrinMatch = chunk.match(
      /\*\*Doktrin:\*\*\s+([\s\S]+?)(?=\n\s*\*\*(?:Frågor|Observera|Fälla):\*\*|$)/,
    );
    const doktrin = doktrinMatch ? doktrinMatch[1].trim() : "";

    // Frågor (English, in quotes) — present for non-REKON cards
    const frågor: string[] = [];
    const frågorMatch = chunk.match(/\*\*Frågor:\*\*\s+([\s\S]+?)(?=\n\s*\*\*Fälla:\*\*|$)/);
    if (frågorMatch) {
      const re = /"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(frågorMatch[1])) !== null) frågor.push(m[1]);
    }

    // Observera (numbered list) — present for [REKON] cards
    const observera: string[] = [];
    const observeraMatch = chunk.match(
      /\*\*Observera:\*\*\s+([\s\S]+?)(?=\n\s*\*\*Fälla:\*\*|$)/,
    );
    if (observeraMatch) {
      const re = /^\d+\.\s+(.+?)$/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(observeraMatch[1])) !== null) observera.push(m[1].trim());
    }

    // Fälla
    const fallaMatch = chunk.match(/\*\*Fälla:\*\*\s+([\s\S]+?)(?=\n---|---$|$)/);
    const fälla = fallaMatch ? fallaMatch[1].trim() : "";

    cards.push({
      number,
      name,
      hall,
      kind: isRecon ? "recon" : "relationship",
      isRecon,
      doktrin,
      frågor,
      observera,
      fälla,
      inProposedAdditions,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Map ParsedCard → BattleCard + Org + SourcedFact-shaped sources
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[éèê]/g, "e")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Guess market_ids from org name. Conservative — defaults to [] if unsure. */
function guessMarketIds(name: string): string[] {
  const n = name.toLowerCase();
  const ids: string[] = [];
  if (/(pkp|plk|polen|polska|polish|poland|izo|kolster|asco|koltech|track tec|combid|combud|kombud|cpk|lhs)/.test(n)) ids.push("pl");
  if (/(tcdd|türkiye|turkiet|turkey)/.test(n)) ids.push("tr");
  if (/(db infrago|deutsche bahn|germany|tyskland|deutschland|sweco.*de|voestalpine|pintsch|wabtec.*europe|atkins|mott|arup|vdb)/.test(n)) ids.push("de");
  if (/(systra|egis|france|frankrike|sncf|hexafret|idom|spain|spanien)/.test(n)) ids.push("at"); // most span + france are watchlist+
  if (/(axtone|dako|azd|czech|tjeckien|česko|cesko)/.test(n)) ids.push("cz");
  if (/(kombud)/.test(n)) ids.push("pl");
  if (/(uty|uzbek|zbekistan|ktz|kazak|railways systems kz)/.test(n)) ids.push("middle-corridor");
  if (/(öbb|infrabel|gysev|vdb)/.test(n)) ids.push("at");
  if (/(sweco|knorr|wabtec|siemens|dellner|voith|de.*consortium)/.test(n) && ids.length === 0) ids.push("de");
  return Array.from(new Set(ids));
}

interface Skip {
  name: string;
  reason: string;
}

async function main(): Promise<void> {
  if (isDemoMode()) {
    console.error("FATAL: store-factory is in demo mode. Set DATABASE_URL.");
    process.exit(1);
  }

  console.log(`F6 (Cassin) import — reading ${INPUT_PATH}`);
  const raw = await readFile(INPUT_PATH, "utf8");
  const parsed = parseCassinF6(raw);
  console.log(`  parsed ${parsed.length} card section(s) from file`);

  // Cassin's rules
  const skips: Skip[] = [];
  const toImport = parsed.filter((c) => {
    // Rule 1: Card #2 (TCDD) → archived = skip
    if (c.name.startsWith("TCDD")) {
      skips.push({ name: c.name, reason: "Cassin's rule: TCDD #2 → archived (watchlist+ until Oct 1)" });
      return false;
    }
    // Rule 2: FÖRESLAGNA TILLÄGG section → skip entirely
    if (c.inProposedAdditions) {
      skips.push({ name: c.name, reason: "Cassin's rule: FÖRESLAGNA TILLÄGG section skipped (§1.5 change request)" });
      return false;
    }
    return true;
  });
  console.log(`  ${toImport.length} card(s) to import, ${skips.length} skipped`);
  for (const s of skips) console.log(`    SKIP: ${s.name} — ${s.reason}`);

  const existingOrgs = await listOrgs();
  const existingOrgById = new Map(existingOrgs.map((o) => [o.id, o]));
  const existingOrgByMatchKey = new Map(existingOrgs.map((o) => [o.match_key.toLowerCase(), o]));
  const existingCards = await listBattleCards();
  const existingCardByOrgId = new Map(existingCards.map((c) => [c.org_id, c]));

  let createdOrgs = 0;
  let updatedOrgs = 0;
  let createdCards = 0;
  let updatedCards = 0;
  const errors: string[] = [];

  for (const c of toImport) {
    try {
      const orgId = `org_${slugify(c.name)}`;
      const matchKey = slugify(c.name);
      const marketIds = guessMarketIds(c.name);

      // 1. Upsert the org
      let org = existingOrgById.get(orgId) ?? existingOrgByMatchKey.get(matchKey);
      const source: V1SourceLink[] = []; // empty — these are AI-researched, not from primary URLs
      if (!org) {
        const type: Org["type"] = c.isRecon
          ? "competitor"
          : /^(PKP|DB InfraGO|SYSTRA|Sweco|Egis|Atkins|Mott|Arup|Track Tec|voestalpine|Pintsch|Wabtec|Knorr|Siemens|SŽ|Infrabel|ÖBB|GYSEV|CPK|IZBA|TRAKO|Business Sweden)$/i.test(c.name)
            ? "consultant"
            : "authority";
        const newOrg: Org = {
          id: orgId,
          name: c.name,
          match_key: matchKey,
          type,
          market_ids: marketIds,
          monday_item_id: null,
          innotrans_target: true,
          customer_category: null,
          k1_door: null,
          risk_facts: [],
          sources: source,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await upsertOrg(newOrg);
        org = newOrg;
        createdOrgs++;
        existingOrgById.set(orgId, newOrg);
      } else if (marketIds.length > 0) {
        const updated: Org = {
          ...org,
          market_ids: Array.from(new Set([...org.market_ids, ...marketIds])),
          innotrans_target: true,
          updated_at: new Date().toISOString(),
        };
        await upsertOrg(updated);
        org = updated;
        updatedOrgs++;
      }

      // 2. Build the battle card. Doctrine is the "why this matters" body
      //    (the strategic reasoning). The first sentence of Doktrin can
      //    also seed the way_in field. Swedish text kept as-is (Rule 4).
      const existingCard = existingCardByOrgId.get(orgId);
      const now = new Date().toISOString();
      const hallNote = c.hall ? ` [InnoTrans: ${c.hall}]` : "";
      const whoTheyAre = `${c.name}${hallNote}`;
      const whyMatters = c.doktrin;
      const trapToAvoid = c.fälla;
      // Take the "Målet är ..." sentence out of Fälla as the receipt — it's
      // the operator-defined success criterion.
      const receiptMatch = c.fälla.match(/Målet är\s+(.+?)(?:[.]\s*$|[.]?\s*$)/);
      const receipt = receiptMatch ? `Målet är ${receiptMatch[1].trim()}.` : null;
      // way_in = first sentence of Doktrin
      const firstSentenceMatch = c.doktrin.match(/^([^.]+\.)/);
      const wayIn = firstSentenceMatch ? `Doktrin: ${firstSentenceMatch[1].trim()}` : null;

      const card: BattleCard = {
        org_id: orgId,
        who_they_are: whoTheyAre,
        why_matters: whyMatters,
        known_people: [],
        relationship_status: existingCard?.relationship_status ?? "identified",
        suggested_questions: c.frågor.slice(0, 3),
        trap_to_avoid: trapToAvoid,
        sources: source,
        kind: c.kind,
        recon_what_to_observe: c.isRecon ? c.observera.slice(0, 5) : undefined,
        way_in: wayIn,
        opening: null,
        receipt: receipt,
        doctrine_version: (existingCard?.doctrine_version ?? 0) + 1,
        doctrine_updated_at: now,
        doctrine_updated_by: "ai-draft", // Rule 3: AI-researched, awaiting Cassin review
      };
      await upsertBattleCard(card);
      if (existingCard) updatedCards++;
      else createdCards++;
      console.log(
        `    ${existingCard ? "UPDATE" : "CREATE"}  ${orgId}  (kind=${c.kind}, q=${c.frågor.length}, obs=${c.observera.length})  ${c.name}`,
      );
    } catch (err) {
      errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  skipped (Cassin's rules): ${skips.length}`);
  console.log(`  orgs created:              ${createdOrgs}`);
  console.log(`  orgs updated:              ${updatedOrgs}`);
  console.log(`  cards created:             ${createdCards}`);
  console.log(`  cards updated:             ${updatedCards}`);
  console.log(`  cards w/ doctrine_updated_by = "ai-draft"  (all)`);
  if (errors.length > 0) {
    console.log(`\n  errors:`);
    for (const e of errors) console.log(`    - ${e}`);
    process.exit(1);
  }
  console.log("\nCassin's F6 import done.");
}

main().catch((err) => {
  console.error("Cassin's F6 import failed:", err);
  process.exit(2);
});
