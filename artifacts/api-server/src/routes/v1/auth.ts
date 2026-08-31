// =============================================================================
// v1 auth — login / logout / me / sessions
//
// v1 = single user (Cassin). The login endpoint takes a username + password
// and returns a session token. Subsequent requests use
// `Authorization: Bearer <token>` (or the `decel_session` cookie).
//
// The password is verified against AUTH_PASS (legacy plaintext) or
// AUTH_PASS_HASH (preferred — scrypt hash). Run `pnpm --filter @workspace/api-server
// run hash-password "your-plain-password"` to generate a hash.
//
// Mounted at /api/v1/auth/* in v1/index.ts. Login is public; logout, /me,
// /sessions are gated by the requireAuth middleware applied internally below.
// =============================================================================

import { Router, type Request } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  verifyPassword,
  isHash,
  createSession,
  getSession,
  touchSession,
  destroySession,
  listActiveSessions,
  logAuthEvent,
} from "../../lib/auth";
import { validateBody } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

// Login payload — small + strict. Reject anything weird.
const LoginBody = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(1024),
});

// 5 attempts per 15 min per IP. Login is the only public-ish auth endpoint.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Use a custom key generator that handles X-Forwarded-For in prod (Caddy)
  keyGenerator: (req) => {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0]!.trim();
    return req.ip ?? "unknown";
  },
  handler: (req, res) => {
    void logAuthEvent({
      event: "login_rate_limited",
      user: "anonymous",
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
    res.status(429).json({
      error: "Too many login attempts. Try again in 15 minutes.",
    });
  },
});

function expectedUser(): string | null {
  return process.env["AUTH_USER"] || null;
}

function expectedPasswordHash(): string | null {
  const h = process.env["AUTH_PASS_HASH"];
  if (h && isHash(h)) return h;
  // Legacy: plaintext fallback. Only used in dev. Log a warning.
  const plain = process.env["AUTH_PASS"];
  if (plain && process.env["NODE_ENV"] !== "production") return `plaintext:${plain}`;
  return null;
}

function checkCredentials(username: string, password: string): boolean {
  const expectedU = expectedUser();
  if (!expectedU || expectedU !== username) return false;
  const stored = expectedPasswordHash();
  if (!stored) return false;
  if (stored.startsWith("plaintext:")) {
    return stored.slice("plaintext:".length) === password;
  }
  return verifyPassword(password, stored);
}

function clientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0]!.trim();
  return req.ip ?? null;
}

// POST /api/v1/auth/login — exchange username + password for a session token
router.post(
  "/login",
  loginLimiter,
  validateBody(LoginBody),
  async (req, res, next) => {
    try {
      if (!expectedUser() || !expectedPasswordHash()) {
        await logAuthEvent({
          event: "auth_not_configured",
          user: req.body.username,
          ip: clientIp(req),
          userAgent: req.headers["user-agent"] ?? null,
        });
        res.status(503).json({
          error: "Auth not configured. Set AUTH_USER + AUTH_PASS_HASH (or AUTH_PASS) in env.",
        });
        return;
      }

      const { username, password } = (req as unknown as { validatedBody: z.infer<typeof LoginBody> })
        .validatedBody;
      const ip = clientIp(req);
      const ua = req.headers["user-agent"] ?? null;

      if (!checkCredentials(username, password)) {
        await logAuthEvent({
          event: "login_failure",
          user: username,
          ip,
          userAgent: ua,
        });
        // Constant response time — don't reveal whether the user exists
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Always create a real DB session. The auth middleware validates
      // tokens against the sessions table — there is no in-memory token
      // path. If the store can't persist a session, the login fails
      // loudly with a 500 rather than silently issuing a fake token.
      const created = await createSession({
        userId: username,
        ip,
        userAgent: ua,
      });
      const token = created.token;
      const expiresAt = created.expiresAt;

      await logAuthEvent({
        event: "login_success",
        user: username,
        ip,
        userAgent: ua,
        details: { expiresAt: expiresAt.toISOString() },
      });

      // Also set an HttpOnly cookie for browser-based flows. The token is
      // the same; clients may use either.
      res.cookie("decel_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env["NODE_ENV"] === "production",
        expires: expiresAt,
        path: "/",
      });

      res.json({
        token,
        expires_at: expiresAt.toISOString(),
        user: username,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/auth/logout — destroy the current session (gated)
router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      await destroySession(token);
      await logAuthEvent({
        event: "logout",
        user: (req as unknown as { authUser?: string }).authUser ?? "unknown",
        ip: clientIp(req),
        userAgent: req.headers["user-agent"] ?? null,
      });
    }
    res.clearCookie("decel_session", { path: "/" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me — whoami + session metadata (gated)
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = (req as unknown as { authUser?: string }).authUser ?? null;
    const expiresAt = (req as unknown as { authExpiresAt?: Date }).authExpiresAt ?? null;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json({ user, expires_at: expiresAt?.toISOString() ?? null });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/sessions — list active sessions (admin endpoint, gated)
router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const user = (req as unknown as { authUser?: string }).authUser;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const sessions = await listActiveSessions(user);
    res.json({
      sessions: sessions.map((s) => ({
        created_at: s.createdAt.toISOString(),
        last_seen_at: s.lastSeenAt.toISOString(),
        expires_at: s.expiresAt.toISOString(),
        ip: s.ip,
        user_agent: s.userAgent,
      })),
    });
  } catch (err) {
    next(err);
  }
});

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  // Cookie
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith("decel_session=")) return c.slice("decel_session=".length);
    }
  }
  return null;
}

export { extractToken };
export default router;
