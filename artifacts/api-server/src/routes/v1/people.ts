// =============================================================================
// v1 people route — PATCH /api/v1/people/:id
//
// Per Cassin's v1.6 brief F3: no enrichment API. The operator pastes the
// LinkedIn URL back into the person record after looking them up via a
// search link. This route accepts the paste and stores it as
// `person.manual_linkedin_url` (distinct from `person.linkedin_url`,
// which an enrichment API would have populated — and which v1 no longer
// uses).
//
// PATCH semantics: partial update. Only the fields present in the body
// are changed. The corrections middleware (lib/corrections/writer) logs
// the diff to the corrections table for F8 workstyle evidence.
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { getPerson, upsertPerson } from "../../lib/store-factory";
import { validateBody } from "../../middlewares/validate";
import { logCorrection } from "../../lib/store-factory";

const router = Router();

const PatchBody = z
  .object({
    // F3: operator-pasted URL. null = clear the value.
    manual_linkedin_url: z.string().url().nullable().optional(),
    // Future-proof: also let the operator update relationship_status
    // (e.g. "identified" -> "contacted" after a first outreach).
    relationship_status: z
      .enum(["none", "identified", "contacted", "active", "strong"])
      .optional(),
  })
  .strict();

// PATCH /api/v1/people/:id
router.patch("/people/:id", validateBody(PatchBody), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const person = await getPerson(id);
    if (!person) {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    const patch = (req as unknown as { validatedBody: z.infer<typeof PatchBody> })
      .validatedBody;
    const now = new Date().toISOString();
    const user =
      (req as unknown as { authUser?: string }).authUser ?? "unknown";

    // Log each changed field to the corrections table for F8 (§1.3). The
    // corrections table stores {fact_id, action, corrected_value, user, ts};
    // we log "edit" with the OLD value in corrected_value so the operator
    // can audit what changed.
    if (
      patch.manual_linkedin_url !== undefined &&
      patch.manual_linkedin_url !== person.manual_linkedin_url
    ) {
      await logCorrection({
        fact_id: `person:${person.id}.manual_linkedin_url`,
        fact_kind: "person",
        action: "edit",
        corrected_value: person.manual_linkedin_url as never,
        user,
      });
    }
    if (
      patch.relationship_status !== undefined &&
      patch.relationship_status !== person.relationship_status
    ) {
      await logCorrection({
        fact_id: `person:${person.id}.relationship_status`,
        fact_kind: "person",
        action: "edit",
        corrected_value: person.relationship_status as never,
        user,
      });
    }

    const updated = {
      ...person,
      manual_linkedin_url:
        patch.manual_linkedin_url !== undefined
          ? patch.manual_linkedin_url
          : person.manual_linkedin_url,
      relationship_status:
        patch.relationship_status ?? person.relationship_status,
      updated_at: now,
      // Touch engagement so the §12.5.3 retention timer resets.
      last_engagement_at: now,
    };
    const saved = await upsertPerson(updated);
    res.json({ person: saved });
  } catch (err) {
    next(err);
  }
});

export default router;
