"use client";

import { useEffect, useState } from "react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { Loader2 } from "lucide-react";

export function SystemHealthPageClient({ user }: { user: SafeUser }) {
  const [health, setHealth] = useState<{
    overall?: string;
    database?: string;
    authentication?: string;
    api?: string;
    sessions?: string;
    checkedAt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/system-health", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setHealth(d.health))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SuperAdminShell user={user} systemStatus={health?.overall === "operational" ? "operational" : "degraded"}>
      <h1 className="text-2xl font-bold">System Health</h1>
      <p className="mt-1 text-muted">Live platform service status</p>
      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Database", value: health?.database },
            { label: "Authentication", value: health?.authentication },
            { label: "API", value: health?.api },
            { label: "Sessions", value: health?.sessions },
          ].map((item) => (
            <div key={item.label} className="gradient-border rounded-2xl bg-surface/60 p-6">
              <p className="text-sm text-muted">{item.label}</p>
              <div className="mt-3">
                <StatusBadge
                  status={
                    item.value === "connected" || item.value === "operational"
                      ? "operational"
                      : "degraded"
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {health?.checkedAt && (
        <p className="mt-6 text-xs text-muted">
          Last checked: {formatRelativeTime(new Date(health.checkedAt))}
        </p>
      )}
    </SuperAdminShell>
  );
}
