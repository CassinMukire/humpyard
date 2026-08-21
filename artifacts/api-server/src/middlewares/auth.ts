// =============================================================================
// Single-user basic auth (v1, Cassin only)
//
// Spec reference: §11.8, §12.1 (single-user in v1; multi-user in October)
//
// v1 = single user. AUTH_USER + AUTH_PASS env vars.
// In dev, set DISABLE_AUTH=true to skip the gate entirely.
// In prod, both AUTH_USER and AUTH_PASS MUST be set; otherwise 503.
//
// Every non-public endpoint is gated. The login UI is just the browser's
// built-in basic-auth dialog (good enough for a single-user tool).
// =============================================================================

import type { RequestHandler } from "express";

let warned = false;

function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn(`[auth] ${message}`);
}

export const requireAuth: RequestHandler = (req, res, next) => {
  // Dev escape hatch
  if (process.env["DISABLE_AUTH"] === "true") {
    warnOnce("DISABLE_AUTH=true — auth gate is OFF. Do not use in production.");
    return next();
  }

  const user = process.env["AUTH_USER"];
  const pass = process.env["AUTH_PASS"];

  if (!user || !pass) {
    return res.status(503).json({
      error:
        "Auth not configured. Set AUTH_USER and AUTH_PASS, or DISABLE_AUTH=true for dev.",
    });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set(
      "WWW-Authenticate",
      'Basic realm="DECEL Intel", charset="UTF-8"',
    );
    return res.status(401).json({ error: "Auth required" });
  }

  let decoded: string;
  try {
    decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  } catch {
    return res.status(401).json({ error: "Invalid Authorization header" });
  }

  const colon = decoded.indexOf(":");
  const u = colon >= 0 ? decoded.slice(0, colon) : decoded;
  const p = colon >= 0 ? decoded.slice(colon + 1) : "";

  // Constant-time comparison
  const userOk = safeEqual(u, user);
  const passOk = safeEqual(p, pass);

  if (!userOk || !passOk) {
    res.set(
      "WWW-Authenticate",
      'Basic realm="DECEL Intel", charset="UTF-8"',
    );
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Attach the authenticated user for downstream handlers (logging, monday push)
  (req as unknown as { authUser: string }).authUser = u;
  next();
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
