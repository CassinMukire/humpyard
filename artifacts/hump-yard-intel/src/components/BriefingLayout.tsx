// =============================================================================
// BriefingLayout — shared top nav + system status for ALL v1 pages.
// This is the single source of truth for the platform's header. Every page
// (except /login) should wrap its content in this component so the nav
// stays consistent across the product. The home page used to have its own
// header; that's now gone (the Tabs live in the page body, the header is
// here). Hitank (2026-09-09): "navbar need same across the platfrom do".
// =============================================================================

import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getSystemInfo } from "@/lib/v1-api";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/utils";
import { FileText, Inbox, Swords, Radar, Sparkles } from "lucide-react";

interface NavLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
  icon: React.ReactNode;
}

function NavLink({ href, active, children, icon }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-3 py-1.5 border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function BriefingLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: info } = useQuery({
    queryKey: ["system-info"],
    queryFn: getSystemInfo,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const isActive = (prefix: string) =>
    location === prefix || location.startsWith(prefix + "/");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      {/* Header — single source of truth, used on every page */}
      <header className="border-b border-border bg-card z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo + app name (always links home) */}
          <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity shrink-0">
            <img src="/decel-logo.png" alt="DECEL" className="h-8 w-auto object-contain" />
            <div className="h-5 w-px bg-border" />
            <span
              className="text-sm uppercase tracking-[0.2em] text-muted-foreground hidden sm:inline"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}
            >
              Hump Yard <span className="text-primary">Intel</span>
            </span>
          </Link>

          {/* Nav — 4 links, same order everywhere. The home ("Scanner") is
              reachable via the DECEL logo on the left; "Radar" has the
              Target Scanner inside its tabs, so a separate "Scanner" nav
              item is redundant (Hitank 2026-09-09). */}
          <nav className="flex items-center gap-2">
            <NavLink href="/dossiers" active={isActive("/dossiers")} icon={<FileText className="w-3.5 h-3.5" />}>
              Dossiers
            </NavLink>
            <NavLink href="/review-queue" active={isActive("/review-queue")} icon={<Inbox className="w-3.5 h-3.5" />}>
              Review
            </NavLink>
            <NavLink href="/battle-cards" active={isActive("/battle-cards")} icon={<Swords className="w-3.5 h-3.5" />}>
              Battle Cards
            </NavLink>
            <NavLink href="/radar" active={isActive("/radar")} icon={<Radar className="w-3.5 h-3.5" />}>
              Radar
            </NavLink>
          </nav>

          {/* Status indicator + mode badge */}
          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            {info?.demo_mode && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 border border-amber-600/50 text-amber-500 bg-amber-600/10 uppercase tracking-wider text-[10px]"
                data-testid="navbar-demo-badge"
              >
                <Sparkles className="w-3 h-3" />
                Demo
              </span>
            )}
            {info?.auth_disabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-red-600/50 text-red-500 bg-red-600/10 uppercase tracking-wider text-[10px]">
                No Auth
              </span>
            )}
            <span className="text-muted-foreground uppercase flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="hidden md:inline">Online</span>
            </span>
            {/* Hitank 2026-09-09: "in scanner and on navbar logout section add".
                The pill is always visible on every page so the operator can
                end the session without hunting for a footer. */}
            <LogoutButton variant="navbar" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
