"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopNav } from "./AdminTopNav";
import { AdminProvider } from "./AdminProvider";
import { EmergencyBanner } from "./EmergencyBanner";
import { CommandPalette } from "@/components/platform/CommandPalette";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";
import {
  AdminChromeProvider,
  ShellNestProvider,
  useAdminChrome,
  useAdminChromeSetter,
  useIsInsideShell,
} from "@/components/shell/ShellChrome";
import { readPersistedBool, writePersistedBool } from "@/hooks/usePersistScroll";

interface AdminShellProps {
  user: SafeUser;
  children: React.ReactNode;
  organizationName?: string;
  organizationStatus?: string;
  notifications?: { id: string; description: string; time: string }[];
}

function AdminShellFrame({
  user,
  children,
  organizationName,
  organizationStatus,
  notifications,
}: AdminShellProps) {
  const chromeCtx = useAdminChrome();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readPersistedBool("admin-sidebar-collapsed", false));
  }, []);

  const chrome = chromeCtx?.chrome ?? {};
  const orgName = organizationName ?? chrome.organizationName;
  const orgStatus = organizationStatus ?? chrome.organizationStatus;
  const notifs = notifications ?? chrome.notifications;

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      writePersistedBool("admin-sidebar-collapsed", next);
      return next;
    });
  };

  return (
    <AdminProvider user={user}>
      <div className="min-h-screen bg-background">
        <AdminSidebar
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
          <EmergencyBanner />
          <AdminTopNav
            onMenuClick={() => setSidebarOpen(true)}
            organizationName={orgName}
            organizationStatus={orgStatus}
            notifications={notifs}
          />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </AdminProvider>
  );
}

export function AdminShell(props: AdminShellProps) {
  const nested = useIsInsideShell();

  if (nested) {
    return <AdminShellNestedForward {...props} />;
  }

  return (
    <ShellNestProvider>
      <AdminChromeProvider>
        <AdminShellFrame {...props} />
      </AdminChromeProvider>
    </ShellNestProvider>
  );
}

function AdminShellNestedForward({
  children,
  organizationName,
  organizationStatus,
  notifications,
}: AdminShellProps) {
  const setChrome = useAdminChromeSetter();

  useEffect(() => {
    const patch: Parameters<typeof setChrome>[0] = {};
    if (organizationName !== undefined) patch.organizationName = organizationName;
    if (organizationStatus !== undefined) patch.organizationStatus = organizationStatus;
    if (notifications !== undefined) patch.notifications = notifications;
    if (Object.keys(patch).length) setChrome(patch);
  }, [setChrome, organizationName, organizationStatus, notifications]);

  return <>{children}</>;
}
