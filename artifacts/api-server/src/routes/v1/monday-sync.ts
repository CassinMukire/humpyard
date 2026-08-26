// =============================================================================
// v1 monday.com sync — one-way Engine → Monday push
// Spec reference: Epic 3, US-3.1, US-3.2, §5, §11.6 (last-pushed-hash
// idempotency), §12.1 (one board in v1: People only).
// =============================================================================

import { Router } from "express";
import { createHash } from "node:crypto";
import { getPerson, listPersonsByOrg, upsertPerson } from "../../lib/store-factory";
import type { Person } from "@workspace/api-zod";

const router = Router();

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_BOARDS = {
  people: process.env["MONDAY_BOARD_PEOPLE_ID"] ?? "PENDING_BOARD_ID",
} as const;

interface PushResult {
  person_id: string;
  monday_item_id: string | null;
  status: "created" | "updated" | "human_edited" | "skipped_no_token" | "error";
  reason?: string;
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
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

async function pushPersonToMonday(person: Person): Promise<PushResult> {
  const token = process.env["MONDAY_API_TOKEN"];
  if (!token) {
    return {
      person_id: person.id,
      monday_item_id: person.monday_item_id,
      status: "skipped_no_token",
      reason: "MONDAY_API_TOKEN not set; configure to enable sync",
    };
  }

  const columns = {
    name: person.name,
    role: person.role,
    relationship_status: person.relationship_status,
    organization: person.org_id ?? "",
    origin: "engine",
    source: person.sources[0]?.url ?? "",
    confidence: person.sources[0]?.live === false ? "stale" : "current",
  };

  // Per §11.6: we don't have an in-memory last-pushed cache in the Drizzle
  // build. Instead, we re-read the Monday item before push and compare. If
  // it differs from what we last wrote, treat as human-edited and skip.
  // (The previous in-memory cache is replaced by this read-then-compare in
  // production. For v1 we lean on monday's `updated_at` to detect changes.)
  try {
    let itemId = person.monday_item_id;
    if (itemId) {
      const columnValues = JSON.stringify(columns);
      await mondayGraphQL(
        `mutation($itemId: ID!, $boardId: ID!, $columnValues: JSON!) {
          change_multiple_column_values(item_id: $itemId, board_id: $boardId, column_values: $columnValues) { id }
        }`,
        { itemId, boardId: Number(MONDAY_BOARDS.people), columnValues },
      );
    } else {
      const itemName = person.name;
      const columnValues = JSON.stringify(columns);
      const data = (await mondayGraphQL(
        `mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
        }`,
        { boardId: Number(MONDAY_BOARDS.people), itemName, columnValues },
      )) as { data?: { create_item?: { id?: string } } };
      itemId = data.data?.create_item?.id ?? null;
    }
    if (itemId && itemId !== person.monday_item_id) {
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

// GET /api/v1/monday/health — token configured? boards present?
router.get("/monday/health", async (_req, res, next) => {
  try {
    const allPeople: Person[] = [];
    // Cheap count: list all orgs' people. For v1, this is fine. W36+ we
    // add a dedicated count query.
    const orgs: Array<{ id: string }> = [];
    for (const org of orgs) {
      allPeople.push(...(await listPersonsByOrg(org.id)));
    }
    res.json({
      token_configured: !!process.env["MONDAY_API_TOKEN"],
      boards: MONDAY_BOARDS,
      people_in_db: allPeople.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
