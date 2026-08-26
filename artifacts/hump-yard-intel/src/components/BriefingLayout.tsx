// =============================================================================
// BriefingLayout — shared top nav + system status for all v1 pages.
// Mirrors the home page's header style so the v1 pages feel like part of
// the same product, not a bolted-on admin tool.
// =============================================================================

import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getSystemInfo } from "@/lib/v1-api";
import { cn } from "@/lib/utils";
import { Crosshair, FileText, Inbox, Swords, Sparkles } from "lucide-react";

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
      {/* Header */}
      <header className="border-b border-border bg-card z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo + app name */}
          <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <img src="/decel-logo.png" alt="DECEL" className="h-8 w-auto object-contain" />
            <div className="h-5 w-px bg-border" />
            <span
              className="text-sm uppercase tracking-[0.2em] text-muted-foreground"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}
            >
              Hump Yard <span className="text-primary">Intel</span>
            </span>
          </Link>

          {/* Nav */}
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
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Scanner
            </Link>
          </nav>

          {/* Status indicator + demo badge */}
          <div className="flex items-center gap-3 text-xs font-mono">
            {info?.demo_mode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-amber-600/50 text-amber-500 bg-amber-600/10 uppercase tracking-wider text-[10px]">
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
              Online
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
