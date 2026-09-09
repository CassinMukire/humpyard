// =============================================================================
// LogoutButton — Cassin-only logout (v1 single-user).
//
// Hitank 2026-09-09: "in scanner and on navbar logout section add".
// Originally added in da21530, accidentally reverted by peer c02ada6
// (misread of the same message — the 'remove' was about the Scanner nav
// link, not logout). Re-added in this commit.
//
// Used in two places: the navbar (BriefingLayout) and the home ("Scanner")
// page footer. Both call POST /api/v1/auth/logout to destroy the session,
// then clear the localStorage token + redirect to /login.
//
// Reuses `setAuthToken(null)` from pages/login.tsx via localStorage directly
// so we don't import across page→component (the helper is tiny enough to
// repeat).
// =============================================================================

import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { LogOut, Loader2 } from "lucide-react";
import { logout } from "@/lib/v1-api";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "decel_session_token";

interface LogoutButtonProps {
  /** "navbar" = compact pill next to the status indicator. "page" = full-width block at the bottom of the Scanner (home) page. */
  variant?: "navbar" | "page";
}

export function LogoutButton({ variant = "navbar" }: LogoutButtonProps) {
  const [, setLocation] = useLocation();
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* localStorage may be disabled */ }
      setLocation("/login");
    },
    onError: (e) => {
      setErr(e instanceof Error ? e.message : String(e));
      // Even on network/server error, clear the local token so the operator
      // doesn't get stuck with a stale Bearer header.
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
    },
  });

  const handleClick = () => {
    setErr(null);
    mutation.mutate();
  };

  if (variant === "page") {
    return (
      <div className="border border-border bg-card/50 p-4 space-y-2" data-testid="logout-section-page">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Session
        </p>
        <p className="text-xs text-foreground/80 font-mono">
          Logged in as <span className="text-primary">cassin</span> (single-user v1). Logout
          invalidates the session token and the localStorage Bearer.
        </p>
        <button
          onClick={handleClick}
          disabled={mutation.isPending}
          data-testid="logout-button-page"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-3 py-1.5 border transition-colors",
            "border-red-600/50 text-red-400 hover:bg-red-600/10",
            "disabled:opacity-50",
          )}
        >
          {mutation.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Logging out…</>
          ) : (
            <><LogOut className="w-3.5 h-3.5" /> Logout</>
          )}
        </button>
        {err && <p className="text-[10px] text-amber-500 font-mono">logout error: {err}</p>}
      </div>
    );
  }

  // variant === "navbar"
  return (
    <button
      onClick={handleClick}
      disabled={mutation.isPending}
      data-testid="logout-button-navbar"
      title="Logout — invalidate the session token"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2.5 py-1 border transition-colors shrink-0",
        "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
        "disabled:opacity-50",
      )}
    >
      {mutation.isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <LogOut className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}
