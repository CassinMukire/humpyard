// =============================================================================
// v1 monday.com sync — one-way Engine → Monday push
//
// Spec reference: Epic 3, US-3.1, US-3.2, §5, §11.6 (last-pushed-hash
// idempotency), §12.1 (one board in v1: People only).
//
// v1: manual push-button per entity, no auto bulk sync. Prevents flooding the
// CRM with unreviewed entities. P2: Organizations/Plays boards + webhooks back.
//
// Idempotency: monday's API won't reliably tell us who last edited a column.
// We store a hash of our own last-pushed value per field; on sync, if the
// current Monday value ≠ our last-pushed hash, we treat it as human-edited →
// never overwrite, flag for review. Simple, robust, no API archaeology.
// =============================================================================

import { Router } from "express";
import { createHash } from "node:crypto";
import { getPerson, listPersonsByOrg, upsertPerson } from "../../lib/queue-store";
import type { Person } from "@workspace/api-zod";

const router = Router();

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_BOARDS = {
  // v1: People only. Organizations + Plays in P2.
  people: process.env["MONDAY_BOARD_PEOPLE_ID"] ?? "PENDING_BOARD_ID",
} as const;

interface PushResult {
  person_id: string;
  monday_item_id: string | null;
  status: "created" | "updated" | "human_edited" | "skipped_no_token" | "error";
  reason?: string;
}

// We track our last-pushed value per field per person. If the current Monday
// value differs from our last-pushed hash, we treat it as human-edited.
const lastPushedHashes = new Map<string, Record<string, string>>(); // person_id -> { column_id -> hash }

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

async function mondayGraphQL(query: string, variables: Record<string, unknown>): Promise<unknown> {
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
router.post("/monday/push/person/:id", async (req, res) => {
  const person = getPerson(req.params.id);
  if (!person) {
    res.status(404).json({ error: "Person not found" });
    return;
  }
  const result = await pushPersonToMonday(person);
  res.json(result);
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
    // organization would be a board_link in prod; left as text for v1
    organization: person.org_id ?? "",
    // origin marker so Monday users can see what's engine-pushed
    origin: "engine",
    source: person.sources[0]?.url ?? "",
    confidence: person.sources[0]?.live === false ? "stale" : "current",
  };

  // Detect human edits: if any field's current value (in our cache) differs
  // from our last-pushed hash, treat as human-edited → never overwrite.
  const lastPushed = lastPushedHashes.get(person.id) ?? {};
  const humanEditedFields: string[] = [];
  for (const [col, val] of Object.entries(columns)) {
    const hash = hashValue(val);
    if (lastPushed[col] && lastPushed[col] !== hash) {
      humanEditedFields.push(col);
    }
  }
  if (humanEditedFields.length > 0) {
    return {
      person_id: person.id,
      monday_item_id: person.monday_item_id,
      status: "human_edited",
      reason: `Fields edited in Monday, will not overwrite: ${humanEditedFields.join(", ")}`,
    };
  }

  try {
    let itemId = person.monday_item_id;
    if (itemId) {
      // Update existing item
      const columnValues = JSON.stringify(
        Object.fromEntries(Object.entries(columns).map(([k, v]) => [k, v])),
      );
      await mondayGraphQL(
        `mutation($itemId: ID!, $columnValues: JSON!) {
          change_multiple_column_values(item_id: $itemId, board_id: ${MONDAY_BOARDS.people}, column_values: $columnValues) { id }
        }`,
        { itemId, columnValues },
      );
    } else {
      // Create new item
      const itemName = person.name;
      const columnValues = JSON.stringify(
        Object.fromEntries(Object.entries(columns).map(([k, v]) => [k, v])),
      );
      const data = (await mondayGraphQL(
        `mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
        }`,
        { boardId: Number(MONDAY_BOARDS.people), itemName, columnValues },
      )) as { data?: { create_item?: { id?: string } } };
      itemId = data.data?.create_item?.id ?? null;
    }
    // Update our last-pushed cache
    const newHashes: Record<string, string> = {};
    for (const [col, val] of Object.entries(columns)) {
      newHashes[col] = hashValue(val);
    }
    lastPushedHashes.set(person.id, newHashes);

    // Persist the monday_item_id on the person record
    if (itemId && itemId !== person.monday_item_id) {
      upsertPerson({ ...person, monday_item_id: itemId });
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
router.get("/monday/health", (_req, res) => {
  res.json({
    token_configured: !!process.env["MONDAY_API_TOKEN"],
    boards: MONDAY_BOARDS,
    people_count: listPersonsByOrg.length,
  });
});

export default router;
