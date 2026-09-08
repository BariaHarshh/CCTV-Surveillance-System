"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { StaffShell } from "@/components/staff/StaffShell";
import { SeverityBadge } from "@/components/monitoring/shared";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";

interface Incident {
  id: string;
  incidentId: string;
  title: string;
  severity: string;
  riskScore: number;
  status: string;
  location: { label?: string; building?: string; camera?: string };
  eventIds: string[];
  createdAt: string;
}

export function IncidentsClient({ user, portal = "admin" }: { user: SafeUser; portal?: "admin" | "staff" }) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState({ open: 0, critical: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/incidents", { credentials: "include" });
    const data = await res.json();
    if (res.ok) {
      setIncidents(data.incidents ?? []);
      setStats(data.stats ?? { open: 0, critical: 0 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useMonitoringSocket({ onIncidentUpdated: () => load() });

  const Shell = portal === "admin" ? AdminShell : StaffShell;

  return (
    <Shell user={user}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Incident Center</h1>
          <p className="mt-1 text-muted">Correlated security incidents across your campus.</p>
        </div>
        <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Open", value: stats.open },
          { label: "Critical", value: stats.critical },
          { label: "Total", value: incidents.length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface/50 p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-glass text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Incident</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Events</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
            ) : incidents.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No incidents yet.</td></tr>
            ) : incidents.map((inc) => (
              <tr key={inc.id} className="border-b border-white/[0.04] hover:bg-glass">
                <td className="px-4 py-3">
                  <Link href={`${base}/incidents/${inc.id}`} className="font-medium hover:text-accent">{inc.title}</Link>
                  <p className="font-mono text-[10px] text-muted">{inc.incidentId}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{inc.location.label ?? inc.location.building ?? "—"}</td>
                <td className="px-4 py-3">{inc.eventIds.length}</td>
                <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                <td className="px-4 py-3">{inc.riskScore}/100</td>
                <td className="px-4 py-3">{inc.status}</td>
                <td className="px-4 py-3 text-xs text-muted">{new Date(inc.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
