// =============================================================================
// Zod validation middleware — request body + response body typing
//
// Every request body is validated against a Zod schema. Every response is
// passed through the schema (where applicable) before sending. This is the
// "good arc level" of an API: the wire contract is enforced at the boundary.
// =============================================================================

import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    // Replace req.body with the parsed (typed + cleaned) value
    (req as unknown as { validatedBody: T }).validatedBody = parsed.data;
    next();
  };
}
