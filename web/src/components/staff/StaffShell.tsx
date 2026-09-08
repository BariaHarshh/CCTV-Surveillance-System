"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { StaffSidebar } from "./StaffSidebar";
import { StaffProvider } from "./StaffProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";
import { ShellNestProvider, useIsInsideShell } from "@/components/shell/ShellChrome";
import { readPersistedBool, writePersistedBool } from "@/hooks/usePersistScroll";

function StaffShellFrame({ user, children }: { user: SafeUser; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    setCollapsed(readPersistedBool("staff-sidebar-collapsed", false));
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      writePersistedBool("staff-sidebar-collapsed", next);
      return next;
    });
  };

  return (
    <StaffProvider user={user}>
      <div className="min-h-screen bg-background">
        <StaffSidebar
          user={user}
          open={sidebarOpen}
          collapsed={collapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={toggleCollapse}
        />
        <div
          className={cn(
            "flex min-h-screen flex-col transition-all",
            collapsed ? "lg:pl-[72px]" : "lg:pl-64"
          )}
        >
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-muted hover:bg-glass-hover hover:text-foreground lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="min-w-0 flex-1 truncate text-sm text-muted">
              {user.name} · {user.userId}
            </p>
            <div className="flex items-center gap-2">
              <ThemeToggle size="sm" />
              <button
                type="button"
                onClick={() => logout()}
                className="text-sm font-medium text-accent hover:underline"
              >
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </StaffProvider>
  );
}

export function StaffShell({ user, children }: { user: SafeUser; children: React.ReactNode }) {
  const nested = useIsInsideShell();
  if (nested) return <>{children}</>;

  return (
    <ShellNestProvider>
      <StaffShellFrame user={user}>{children}</StaffShellFrame>
    </ShellNestProvider>
  );
}
