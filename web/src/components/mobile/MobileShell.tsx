"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListTodo, Bell, Map, User, AlertTriangle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV = [
  { href: "/mobile", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/mobile/map", label: "Map", icon: Map },
  { href: "/mobile/profile", label: "Profile", icon: User },
];

export function MobileShell({
  user,
  children,
  emergencyActive = false,
  title,
}: {
  user: SafeUser;
  children: React.ReactNode;
  emergencyActive?: boolean;
  title?: string;
}) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    const run = async () => {
      setSyncing(true);
      try {
        await fetch("/api/mobile/sync", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "process" }),
        });
        setLastSynced(new Date().toLocaleTimeString());
      } catch {
        /* keep draft data */
      } finally {
        setSyncing(false);
      }
    };
    run();
  }, [online]);

  const connection = !online ? "OFFLINE" : syncing ? "SYNCING" : "ONLINE";

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent/80">AI Campus Guardian</p>
            <h1 className="truncate text-base font-semibold">{title || "Field Ops"}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle size="sm" />
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium",
                connection === "OFFLINE" && "bg-amber-500/20 text-amber-700 dark:text-amber-200",
                connection === "SYNCING" && "bg-sky-500/20 text-sky-700 dark:text-sky-200",
                connection === "ONLINE" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
              )}
              aria-live="polite"
            >
              {connection === "OFFLINE" ? (
                <WifiOff className="h-3 w-3" aria-hidden />
              ) : connection === "SYNCING" ? (
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Wifi className="h-3 w-3" aria-hidden />
              )}
              {connection}
            </div>
          </div>
        </div>
        {connection === "OFFLINE" && (
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-200/90">
            Offline · Last synced: {lastSynced || "—"} · Drafts pending sync
          </p>
        )}
        {emergencyActive && (
          <Link
            href="/mobile/emergency"
            className="mt-3 flex items-center gap-2 rounded-xl bg-red-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40"
          >
            <AlertTriangle className="h-5 w-5" aria-hidden />
            EMERGENCY MODE — Open
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-lg justify-around px-1 py-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/mobile" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] transition-colors",
                  active ? "text-accent" : "text-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
          {emergencyActive && (
            <Link
              href="/mobile/emergency"
              className="flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg bg-red-600/90 px-2 text-[10px] font-semibold text-white"
            >
              <AlertTriangle className="h-5 w-5" aria-hidden />
              Emergency
            </Link>
          )}
        </div>
      </nav>
      <p className="sr-only">Signed in as {user.name}</p>
    </div>
  );
}
