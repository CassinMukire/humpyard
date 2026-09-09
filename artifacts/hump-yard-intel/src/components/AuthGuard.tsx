// =============================================================================
// AuthGuard — client-side auth check for protected routes.
//
// Calls /api/v1/auth/me on mount. If the response is 401, redirects to
// /login. While the check is in flight, renders a small placeholder so the
// dashboard chrome (which used to render even when unauthenticated) does
// not flash "Logged in as cassin" before the redirect happens.
//
// NOTE: this is a UX layer, not a security boundary. The server's
// requireAuth middleware is the actual gate. The point of this guard is
// to (a) stop showing the dashboard chrome to a logged-out operator,
// and (b) make logout actually feel like logout.
//
// The /login route is excluded from the guard.
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { me } from "@/lib/v1-api";
import { ApiError } from "@workspace/api-client-react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<"checking" | "ok" | "redirecting">("checking");

  useEffect(() => {
    let cancelled = false;

    me()
      .then(() => {
        if (!cancelled) setState("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        // Only redirect on a real 401. Network errors, 5xx, etc. should
        // not bounce the operator off the page — show the dashboard and
        // let the server-side gate handle the actual request.
        if (err instanceof ApiError && err.status === 401) {
          setState("redirecting");
          // Wipe the stale localStorage token so the next login starts
          // clean. The HttpOnly cookie is server-side only.
          try { localStorage.removeItem("decel_session_token"); } catch { /* noop */ }
          setLocation("/login");
        } else {
          // Server reachable but not authoritative — let the user proceed;
          // individual API calls will surface 401s if the session is gone.
          setState("ok");
        }
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
