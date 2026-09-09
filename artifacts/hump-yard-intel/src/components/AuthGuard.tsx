// =============================================================================
// AuthGuard — client-side auth check for protected routes.
//
// v1.1.3: do NOT aggressively clear the localStorage Bearer on a single 401.
// The HttpOnly cookie is the real authority — the server's requireAuth
// middleware now tries Bearer first, then cookie, and accepts either
// (see api-server/src/middlewares/auth.ts). A stale localStorage token
// (e.g. another tab logged out, or a server-side session cleanup) used
// to mask a still-valid cookie, leading to the "login every time" loop.
// We now:
//   1. If there's no localStorage token at all, redirect to /login (the
//      user is clearly not authed).
//   2. If there IS a localStorage token, call me() in the background.
//      On 200 → render. On 401 → render anyway (the cookie may still be
//      valid for the next real API call; clearing localStorage would
//      force a needless re-login). On network error → render anyway.
//   3. Individual API calls surface the real 401 with their own error
//      toasts if the session is truly gone.
//
// NOTE: this is a UX layer, not a security boundary. The server's
// requireAuth middleware is the actual gate. The point of this guard is
// to (a) stop showing the dashboard chrome to a first-time visitor who
// has never logged in, and (b) make logout actually feel like logout
// (when the user clicks the Logout button, both Bearer and cookie are
// destroyed and the next refresh correctly redirects).
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { me } from "@/lib/v1-api";

const TOKEN_KEY = "decel_session_token";

function getLocalToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<"checking" | "ok" | "redirecting">("checking");

  useEffect(() => {
    let cancelled = false;

    // No localStorage token → no possible auth, redirect immediately.
    // Don't even call me() — it'll 401, and we want to avoid a network
    // round-trip for the cold-start case.
    const localToken = getLocalToken();
    if (!localToken) {
      setState("redirecting");
      setLocation("/login");
      return;
    }

    // We have a localStorage token. Validate it via me(). We DO NOT clear
    // the token on 401 — the server now also tries the HttpOnly cookie,
    // so a stale Bearer doesn't mean the session is gone.
    me()
      .then(() => {
        if (!cancelled) setState("ok");
      })
      .catch(() => {
        if (cancelled) return;
        // Don't clear localStorage. Don't redirect. The next real API
        // call will surface the true auth state — if the session is
        // gone, the operator will see a 401 in the UI and can re-login.
        setState("ok");
      });

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  if (state !== "ok") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {state === "redirecting" ? "Redirecting to sign in…" : "Checking session…"}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
