"use client";

import { useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";

export function EmergencyOverviewClient({ user }: { user: SafeUser }) {
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/emergency-overview", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOverview(d.overview));
  }, []);

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Emergency Overview</h1>
      <p className="mt-1 text-muted">Platform-level emergency statistics. Does not expose organization incident details.</p>

      {!overview ? (
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-glass" />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Organizations", value: overview.organizationsTotal },
            { label: "Orgs in Emergency Mode", value: overview.organizationsInEmergencyMode },
            { label: "Active Emergencies", value: overview.activeEmergencies },
            { label: "Critical Incidents", value: overview.criticalIncidents },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface/50 p-4">
              <p className="text-xs text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-bold">{String(s.value)}</p>
            </div>
          ))}
          <div className="rounded-xl border border-border bg-surface/50 p-4 sm:col-span-2">
            <p className="text-xs text-muted">System Health</p>
            <p className="mt-1 text-lg font-bold">{String((overview.systemHealth as { overall?: string })?.overall ?? "—")}</p>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}
