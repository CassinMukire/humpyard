// =============================================================================
// v1 monday.com sync — one-way Engine → Monday push
//
// Target board (per Hitank's monday.com, 2026-08-29): "DECEL — Relationer &
// Dialoger" (id 18426688283). It has these columns we care about:
//   - Name                (id: "name")              — the item's name
//   - Organisation        (id: "text_mm68tqgj")     — org name (free text)
//   - Roll                (id: "text_mm686q5p")     — role / title (free text)
//   - E-post              (id: "email_mm68d54h")    — email
//   - Telefon             (id: "text_mm68y7jy")     — phone
//   - Prio                (id: "color_mm68rq6f")    — status: P1/P2/P3
//   - Dialogläge          (id: "color_mm68q8ys")    — status: 0..8 stages
//   - Kanaltyp            (id: "color_mm68qsm6")    — status: Business Sweden, etc.
//   - Marknad             (id: "color_mm68ay8")     — status: country
//   - Första kontakt      (id: "date_mm68qbk")      — date
//   - Senaste kontakt     (id: "date_mm686v4j")     — date
//   - Deadline / nästa    (id: "date_mm68yeqh")     — date
//   - Varför jag pratar  (id: "long_text_mm68ht6q")— long text
//   - Var vi är i dialogen (id: "long_text_mm68ekzg")— long text
//   - Nästa steg          (id: "text_mm68p80x")     — text
//   - Källa (dokument)    (id: "text_mm68c05h")     — text (source URL)
//
// We map a Person + their org + the parent market to these columns.
// =============================================================================

import { Router } from "express";
import { getPerson, getOrg, getMarket, listPersonsByOrg } from "../../lib/store-factory";
import type { Person, Org, Market, RelationshipStatus, OrgType } from "@workspace/api-zod";

const router = Router();

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_BOARD_PEOPLE_ID = process.env["MONDAY_BOARD_PEOPLE_ID"] ?? "PENDING_BOARD_ID";

// -----------------------------------------------------------------------------
// Column IDs for the "DECEL — Relationer & Dialoger" board (id 18426688283).
// All overridable via env so the wiring survives any future board rename /
// recreation. Set `MONDAY_BOARD_PEOPLE_COL_<KEY>` to override one column;
// see `.env.production.example` for the full list.
// -----------------------------------------------------------------------------
const COL = {
  name: process.env["MONDAY_BOARD_PEOPLE_COL_NAME"] ?? "name",
  organisation: process.env["MONDAY_BOARD_PEOPLE_COL_ORGANISATION"] ?? "text_mm68tqgj",
  roll: process.env["MONDAY_BOARD_PEOPLE_COL_ROLL"] ?? "text_mm686q5p",
  email: process.env["MONDAY_BOARD_PEOPLE_COL_EMAIL"] ?? "email_mm68d54h",
  telefon: process.env["MONDAY_BOARD_PEOPLE_COL_TELEFON"] ?? "text_mm68y7jy",
  prio: process.env["MONDAY_BOARD_PEOPLE_COL_PRIO"] ?? "color_mm68rq6f",
  dialoglage: process.env["MONDAY_BOARD_PEOPLE_COL_DIALOGLAGE"] ?? "color_mm68q8ys",
  kanaltyp: process.env["MONDAY_BOARD_PEOPLE_COL_KANALTYP"] ?? "color_mm68qsm6",
  marknad: process.env["MONDAY_BOARD_PEOPLE_COL_MARKNAD"] ?? "color_mm68ay8",
  forstaKontakt: process.env["MONDAY_BOARD_PEOPLE_COL_FORSTA_KONTAKT"] ?? "date_mm68qbk",
  senasteKontakt: process.env["MONDAY_BOARD_PEOPLE_COL_SENASTE_KONTAKT"] ?? "date_mm686v4j",
  deadline: process.env["MONDAY_BOARD_PEOPLE_COL_DEADLINE"] ?? "date_mm68yeqh",
  varforPratar: process.env["MONDAY_BOARD_PEOPLE_COL_VARFOR_PRATAR"] ?? "long_text_mm68ht6q",
  varIgen: process.env["MONDAY_BOARD_PEOPLE_COL_VAR_IGEN"] ?? "long_text_mm68ekzg",
  nastaSteg: process.env["MONDAY_BOARD_PEOPLE_COL_NASTA_STEG"] ?? "text_mm68p80x",
  kalla: process.env["MONDAY_BOARD_PEOPLE_COL_KALLA"] ?? "text_mm68c05h",
} as const;

// -----------------------------------------------------------------------------
// Status mappings — Person.relationship_status → Dialogläge status label id
// -----------------------------------------------------------------------------
const DIALOGLAGE_BY_STATUS: Record<RelationshipStatus, string> = {
  none: "1",        // "0. Ej kontaktad ännu"
  identified: "17", // "1. Utskick skickat"
  contacted: "0",   // "2. Svar mottaget"
  active: "7",      // "3. Möte bokat" (or 4 = "Möte genomfört" — could refine)
  strong: "4",      // "4. Möte genomfört"
};

// -----------------------------------------------------------------------------
// Prio by Market.tier (A → P1, B → P2, C → P3)
// -----------------------------------------------------------------------------
const PRIO_BY_TIER: Record<Market["tier"], string> = {
  A: "2",   // P1 – Hög
  B: "0",   // P2 – Medel
  C: "17",  // P3 – Låg
  ANTI: "17",
};

// -----------------------------------------------------------------------------
// Marknad by country_iso (best-effort mapping; unknown → 18 "EU / flera")
// -----------------------------------------------------------------------------
const MARKNAD_BY_ISO: Record<string, string> = {
  PL: "2",  // Polen
  SE: "1",  // Sverige
  DE: "10", // Tyskland
  IT: "0",  // Italien
  CZ: "3",  // Tjeckien
  HU: "6",  // Ungern
  LV: "7",  // Lettland
  RO: "8",  // Rumänien
  TR: "9",  // Turkiet
  SK: "11", // Slovakien
  CH: "12", // Schweiz
  GR: "13", // Grekland
  BG: "14", // Bulgarien
  AL: "17", // Albanien
  // Centralasien (KZ/UZ etc.) → fall through to 18
};

// -----------------------------------------------------------------------------
// Kanaltyp by OrgType
// -----------------------------------------------------------------------------
const KANALTYP_BY_ORG_TYPE: Record<OrgType, string> = {
  authority: "2",     // Operatör / Infra
  operator: "2",      // Operatör / Infra
  competitor: "2",    // Operatör / Infra
  consultant: "2",    // Operatör / Infra
  epc: "2",           // Operatör / Infra
  financier: "4",     // EEN-nod (closest match)
  agent: "16",        // Internt Decel
};

interface PushResult {
  person_id: string;
  monday_item_id: string | null;
  status: "created" | "updated" | "human_edited" | "skipped_no_token" | "skipped_no_board" | "error";
  reason?: string;
}

async function mondayGraphQL(
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const token = process.env["MONDAY_API_TOKEN"];
  if (!token) {
    throw new Error("MONDAY_API_TOKEN not configured");
  }
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`monday.com API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function isoToMondayDate(iso: string | null | undefined): { date: string } | null {
  if (!iso) return null;
  // monday.com date column values are { date: "YYYY-MM-DD" } or null
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { date: d.toISOString().slice(0, 10) };
}

async function buildColumnValues(person: Person, org: Org | null | undefined, market: Market | null | undefined): Promise<Record<string, unknown>> {
  const vars: Record<string, unknown> = {};
  if (org) vars[COL.organisation] = org.name;
  if (person.role) vars[COL.roll] = person.role;
  vars[COL.dialoglage] = { index: Number(DIALOGLAGE_BY_STATUS[person.relationship_status] ?? "1") };
  if (market) {
    vars[COL.prio] = { index: Number(PRIO_BY_TIER[market.tier] ?? "0") };
    if (market.country_iso && MARKNAD_BY_ISO[market.country_iso]) {
      vars[COL.marknad] = { index: Number(MARKNAD_BY_ISO[market.country_iso]) };
    } else {
      vars[COL.marknad] = { index: 18 };
    }
  }
  if (org) {
    vars[COL.kanaltyp] = { index: Number(KANALTYP_BY_ORG_TYPE[org.type] ?? "16") };
  }
  const forsta = isoToMondayDate(person.last_engagement_at);
  if (forsta) vars[COL.forstaKontakt] = forsta;
  if (forsta) vars[COL.senasteKontakt] = forsta;

  // Long text fields — summarise the person's interests into "Varför jag
  // pratar med dem" so the operator has context for the next meeting.
  if (person.interests.length > 0) {
    const bullets = person.interests
      .slice(0, 6)
      .map((i) => `• ${i.summary}`)
      .join("\n");
    vars[COL.varforPratar] = `${bullets}\n\nKälla: DECEL Intelligence Platform.`;
  }
  if (person.sources[0]?.url) {
    vars[COL.kalla] = person.sources[0].url;
  }
  return vars;
}

// POST /api/v1/monday/push/person/:id — push one person to Monday People board
router.post("/monday/push/person/:id", async (req, res, next) => {
  try {
    const person = await getPerson(req.params.id);
    if (!person) {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    const result = await pushPersonToMonday(person);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/monday/push/all — push every person in the DB (idempotent)
router.post("/monday/push/all", async (_req, res, next) => {
  try {
    if (!process.env["MONDAY_API_TOKEN"]) {
      res.json({ ok: false, reason: "MONDAY_API_TOKEN not set" });
      return;
    }
    if (MONDAY_BOARD_PEOPLE_ID === "PENDING_BOARD_ID") {
      res.json({ ok: false, reason: "MONDAY_BOARD_PEOPLE_ID not set" });
      return;
    }
    // Iterate orgs and push their people. For v1 this is fine; W36+ we
    // add a dedicated list query.
    const orgs = await import("../../lib/store-factory").then((m) => m.listOrgs());
    const allResults: PushResult[] = [];
    for (const org of orgs) {
      const people = await listPersonsByOrg(org.id);
      for (const person of people) {
        const result = await pushPersonToMonday(person);
        allResults.push(result);
        // Throttle: 200ms between calls to be polite to monday
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    const summary = {
      ok: true,
      total: allResults.length,
      created: allResults.filter((r) => r.status === "created").length,
      updated: allResults.filter((r) => r.status === "updated").length,
      errors: allResults.filter((r) => r.status === "error").length,
      results: allResults,
    };
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

async function pushPersonToMonday(person: Person): Promise<PushResult> {
  if (!process.env["MONDAY_API_TOKEN"]) {
    return {
      person_id: person.id,
      monday_item_id: person.monday_item_id,
      status: "skipped_no_token",
      reason: "MONDAY_API_TOKEN not set; configure to enable sync",
    };
  }
  if (MONDAY_BOARD_PEOPLE_ID === "PENDING_BOARD_ID") {
    return {
      person_id: person.id,
      monday_item_id: person.monday_item_id,
      status: "skipped_no_board",
      reason: "MONDAY_BOARD_PEOPLE_ID not set",
    };
  }

  // Load org + market for the column values
  const org = person.org_id ? await getOrg(person.org_id) : null;
  const market = org && org.market_ids[0] ? await getMarket(org.market_ids[0]) : null;
  const columnValues = await buildColumnValues(person, org, market);

  try {
    let itemId = person.monday_item_id;
    if (itemId) {
      await mondayGraphQL(
        `mutation($itemId: ID!, $boardId: ID!, $columnValues: JSON!) {
          change_multiple_column_values(item_id: $itemId, board_id: $boardId, column_values: $columnValues) { id }
        }`,
        { itemId: Number(itemId), boardId: Number(MONDAY_BOARD_PEOPLE_ID), columnValues: JSON.stringify(columnValues) },
      );
    } else {
      const raw = await mondayGraphQL(
        `mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
        }`,
        { boardId: Number(MONDAY_BOARD_PEOPLE_ID), itemName: person.name, columnValues: JSON.stringify(columnValues) },
      );
      const data = raw as { data?: { create_item?: { id?: string | number } }; errors?: Array<{ message: string }> };
      if (data.errors && data.errors.length > 0) {
        return {
          person_id: person.id,
          monday_item_id: null,
          status: "error",
          reason: `monday.com: ${data.errors.map((e) => e.message).join("; ")}`,
        };
      }
      itemId = data.data?.create_item?.id != null ? String(data.data.create_item.id) : null;
    }
    if (itemId && itemId !== person.monday_item_id) {
      // Update the person's monday_item_id in the local store so re-push
      // updates instead of creating duplicates.
      const { upsertPerson } = await import("../../lib/store-factory");
      await upsertPerson({ ...person, monday_item_id: itemId });
    }
    return {
      person_id: person.id,
      monday_item_id: itemId,
      status: person.monday_item_id ? "updated" : "created",
    };
  } catch (err) {
    return {
      person_id: person.id,
      monday_item_id: person.monday_item_id,
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// GET /api/v1/monday/health — token + board + item count
router.get("/monday/health", async (_req, res) => {
  const orgs = await import("../../lib/store-factory").then((m) => m.listOrgs());
  let peopleInDb = 0;
  for (const org of orgs) {
    peopleInDb += (await listPersonsByOrg(org.id)).length;
  }
  res.json({
    token_configured: !!process.env["MONDAY_API_TOKEN"],
    board_people_id: MONDAY_BOARD_PEOPLE_ID,
    board_configured: MONDAY_BOARD_PEOPLE_ID !== "PENDING_BOARD_ID",
    people_in_db: peopleInDb,
  });
});

export default router;
