// =============================================================================
// Auth middleware — v1.1
//
// v1 = single user (Cassin). Three auth modes, in priority order:
//   1. Bearer token (from /api/v1/auth/login) — preferred
//   2. HttpOnly cookie `decel_session` — set on login
//   3. HTTP Basic (AUTH_USER + AUTH_PASS_HASH or AUTH_PASS) — backward compat
//
// DISABLE_AUTH=true short-circuits everything (dev only).
// In production, missing AUTH_USER / AUTH_PASS_HASH returns 503.
// =============================================================================

import type { RequestHandler } from "express";
import {
  verifyPassword,
  isHash,
  getSession,
  touchSession,
  logAuthEvent,
} from "../lib/auth";
import { isDemoMode } from "../lib/store-factory";

let warnedDevBypass = false;
let warnedNotConfigured = false;

function warnOnce(label: string, message: string): void {
  if (label === "dev_bypass" && warnedDevBypass) return;
  if (label === "not_configured" && warnedNotConfigured) return;
  if (label === "dev_bypass") warnedDevBypass = true;
  if (label === "not_configured") warnedNotConfigured = true;
  // eslint-disable-next-line no-console
  console.warn(`[auth] ${message}`);
}

function setAuthOnReq(req: unknown, user: string, expiresAt?: Date): void {
  (req as Record<string, unknown>)["authUser"] = user;
  if (expiresAt) (req as Record<string, unknown>)["authExpiresAt"] = expiresAt;
}

function extractBasicAuth(authHeader: string | undefined): { user: string; pass: string } | null {
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon < 0) return null;
    return { user: decoded.slice(0, colon), pass: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function extractBearerOrCookieToken(req: { headers: { authorization?: string; cookie?: string } }): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith("decel_session=")) return c.slice("decel_session=".length);
    }
  }
  return null;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  // 1. Dev escape hatch
  if (process.env["DISABLE_AUTH"] === "true") {
    warnOnce(
      "dev_bypass",
      "DISABLE_AUTH=true — auth gate is OFF. Do not use in production.",
    );
    setAuthOnReq(req, "dev-bypass", new Date(Date.now() + 24 * 60 * 60 * 1000));
    next();
    return;
  }

  // 2. Check for bearer/cookie token
  const token = extractBearerOrCookieToken(req);
  if (token) {
    // Demo-mode bypass: tokens issued by the demo auth flow (prefix "demo-")
    // are accepted without a DB lookup. This keeps the login UX real (the
    // password is still checked) without requiring Postgres.
    if (isDemoMode() && token.startsWith("demo-")) {
      const userId = token.split("-")[1] ?? "dev-bypass";
      setAuthOnReq(req, userId, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      next();
      return;
    }
    const session = await getSession(token);
    if (session) {
      // Sliding window — touch the session
      await touchSession(token);
      setAuthOnReq(req, session.userId, session.expiresAt);
      next();
      return;
    }
    // Token invalid or expired. Fall through to basic auth below.
    await logAuthEvent({
      event: "token_invalid",
      user: "anonymous",
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
  }

  // 3. HTTP Basic (backward compat / curl-friendly)
  const basic = extractBasicAuth(req.headers.authorization);
  if (basic) {
    const expectedUser = process.env["AUTH_USER"] ?? null;
    const expectedHash = process.env["AUTH_PASS_HASH"] ?? null;
    const expectedPlain = process.env["AUTH_PASS"] ?? null;
    if (!expectedUser || (!expectedHash && !expectedPlain)) {
      warnOnce(
        "not_configured",
        "Auth not configured. Set AUTH_USER + AUTH_PASS_HASH (preferred) or AUTH_PASS (dev only).",
      );
      res.status(503).json({ error: "Auth not configured" });
      return;
    }
    if (!safeEqual(basic.user, expectedUser)) {
      res.set("WWW-Authenticate", 'Basic realm="DECEL Intel", charset="UTF-8"');
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    let passOk = false;
    if (expectedHash && isHash(expectedHash)) {
      passOk = verifyPassword(basic.pass, expectedHash);
    } else if (expectedPlain && process.env["NODE_ENV"] !== "production") {
      warnOnce(
        "dev_bypass",
        "AUTH_PASS is plaintext. Switch to AUTH_PASS_HASH in production.",
      );
      passOk = safeEqual(basic.pass, expectedPlain);
    } else {
      passOk = false;
    }
    if (!passOk) {
      res.set("WWW-Authenticate", 'Basic realm="DECEL Intel", charset="UTF-8"');
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    setAuthOnReq(req, expectedUser, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    next();
    return;
  }

  // 4. No credentials at all
  res.set("WWW-Authenticate", 'Basic realm="DECEL Intel", charset="UTF-8"');
  res.status(401).json({ error: "Auth required" });
};
