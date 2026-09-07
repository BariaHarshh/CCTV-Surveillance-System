"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { MonitoringPortal } from "./MonitoringPortal";
import { SeverityBadge, formatDateTime } from "./shared";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";
import { RealtimeIndicator } from "./shared";

interface AlertRow {
  id: string;
  alertId: string;
  title: string;
  severity: string;
  status: string;
  location: { campus?: string; building?: string; room?: string; camera?: string };
  assignedToName: string | null;
  createdAt: string;
  source: string;
}

interface AlertStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function AlertsClient({ user, portal }: { user: SafeUser; portal: "admin" | "staff" }) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("ALL");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (q) params.set("q", q);
      if (severity !== "ALL") params.set("severity", severity);
      const [alertRes, ovRes] = await Promise.all([
        fetch(`/api/alerts?${params}`, { credentials: "include" }),
        fetch("/api/monitoring/overview", { credentials: "include" }),
      ]);
      const alertData = await alertRes.json();
      const ov = await ovRes.json();
      if (alertRes.ok) setAlerts(alertData.alerts ?? []);
      if (ovRes.ok && ov.overview) {
        const a = ov.overview.alerts;
        setStats({
          critical: a?.critical ?? 0,
          high: a?.high ?? 0,
          medium: a?.medium ?? 0,
          low: a?.low ?? 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [page, q, severity]);

  useEffect(() => {
    load();
  }, [load]);

  const { status: realtimeStatus } = useMonitoringSocket({
    onAlertCreated: () => load(),
    onAlertUpdated: () => load(),
  });

  return (
    <MonitoringPortal portal={portal} user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Alert Center</h1>
          <p className="mt-1 text-muted">Security alerts across your campus network.</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator status={realtimeStatus} />
          <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !stats ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <StatCard label="Critical" value={stats.critical} icon={AlertTriangle} delay={0} />
            <StatCard label="High" value={stats.high} icon={AlertTriangle} delay={0.05} />
            <StatCard label="Medium" value={stats.medium} icon={AlertTriangle} delay={0.1} />
            <StatCard label="Low" value={stats.low} icon={AlertTriangle} delay={0.15} />
          </>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search alerts..."
            className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent/50"
          />
        </div>
        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
          className="rounded-xl border border-border bg-glass px-4 py-2.5 text-sm"
        >
          <option value="ALL">All severities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-glass text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Alert</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-8 animate-pulse rounded bg-glass" /></td></tr>
              ))
            ) : alerts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">No alerts found.</td></tr>
            ) : (
              alerts.map((a) => (
                <tr key={a.id} className="border-b border-white/[0.04] hover:bg-glass">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.title}</p>
                    <p className="font-mono text-[10px] text-muted">{a.alertId}{a.source === "TEST" ? " · SIMULATED" : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {[a.location.building, a.location.room, a.location.camera].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={a.severity} /></td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">{a.status}</td>
                  <td className="px-4 py-3 text-xs text-muted">{a.assignedToName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/alerts/${a.id}`} className="text-xs font-medium text-accent hover:underline">View</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
        <button type="button" onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Next</button>
      </div>
    </MonitoringPortal>
  );
}
