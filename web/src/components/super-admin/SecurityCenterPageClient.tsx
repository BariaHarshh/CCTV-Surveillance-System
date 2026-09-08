"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function SecurityCenterPageClient({ user }: { user: SafeUser }) {
  const [security, setSecurity] = useState<Record<string, number> | null>(null);
  const [activity, setActivity] = useState<{ id: string; description: string; createdAt: string; severity: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/super-admin/security", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/super-admin/activity", { credentials: "include" }).then((r) => r.json()),
    ]).then(([sec, act]) => {
      setSecurity(sec.security);
      setActivity(act.activity.filter((a: { severity: string }) => a.severity !== "info").slice(0, 20));
    });
  }, []);

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Security Center</h1>
      {!security ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Failed Logins Today", value: security.failedLoginsToday },
              { label: "Locked Accounts", value: security.lockedAccounts },
              { label: "Active Sessions", value: security.activeSessions },
              { label: "Security Events Today", value: security.securityEventsToday },
            ].map((item) => (
              <div key={item.label} className="gradient-border rounded-2xl bg-surface/60 p-5">
                <p className="text-xs text-muted">{item.label}</p>
                <p className="mt-2 font-mono text-3xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-10 text-lg font-semibold">Security Activity</h2>
          <div className="mt-4 space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm">
                {a.description}
                <span className="ml-2 text-xs text-muted">
                  {formatRelativeTime(new Date(a.createdAt))}
                </span>
              </div>
            ))}
          </div>
          <Link href="/super-admin/sessions" className="mt-6 inline-block text-sm text-accent">
            Manage Sessions →
          </Link>
        </>
      )}
    </SuperAdminShell>
  );
}
