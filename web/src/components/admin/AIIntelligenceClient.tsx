"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Brain, RefreshCw, Settings, Shield, Activity } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { cn } from "@/lib/utils";

interface ModuleRow {
  type: string;
  label: string;
  status: string;
  enabled: boolean;
  cameras: number;
  confidenceThreshold: number;
  lastDetection: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  INACTIVE: "text-muted bg-white/5 border-border",
  CONFIGURATION_REQUIRED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  ERROR: "text-red-400 bg-red-500/10 border-red-500/20",
  MAINTENANCE: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

export function AIIntelligenceClient({ user }: { user: SafeUser }) {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCameras: 0, configuredCameras: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setModules(data.overview?.modules ?? []);
        setStats({
          totalCameras: data.overview?.totalCameras ?? 0,
          configuredCameras: data.overview?.configuredCameras ?? 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">AI Intelligence</h1>
          <p className="mt-1 text-muted">Configure intelligent safety detection across your campus.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/ai/health" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted hover:text-foreground">
            <Activity className="h-3.5 w-3.5" /> AI Health
          </Link>
          <Link href="/admin/settings/ai" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted hover:text-foreground">
            <Settings className="h-3.5 w-3.5" /> Org Settings
          </Link>
          <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface/50 p-4">
          <p className="text-xs text-muted">Total Cameras</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalCameras}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/50 p-4">
          <p className="text-xs text-muted">AI Configured</p>
          <p className="mt-1 text-2xl font-bold">{stats.configuredCameras}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/50 p-4">
          <p className="text-xs text-muted">Active Modules</p>
          <p className="mt-1 text-2xl font-bold">{modules.filter((m) => m.status === "ACTIVE").length}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-glass" />)
        ) : (
          modules.map((m) => (
            <div key={m.type} className="rounded-2xl border border-border bg-surface/50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-accent/10 p-2"><Brain className="h-5 w-5 text-accent" /></div>
                  <div>
                    <h3 className="font-semibold">{m.label}</h3>
                    <p className="text-xs text-muted">{m.cameras} camera(s) enabled</p>
                  </div>
                </div>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase", STATUS_COLORS[m.status] ?? STATUS_COLORS.INACTIVE)}>
                  {m.status.replace(/_/g, " ")}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted">Confidence</dt><dd>{Math.round(m.confidenceThreshold * 100)}%</dd></div>
                <div><dt className="text-muted">Last Detection</dt><dd>{m.lastDetection ? new Date(m.lastDetection).toLocaleString() : "None"}</dd></div>
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/ai/restricted-zones" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-glass">
          <Shield className="h-4 w-4 text-accent" /> Restricted Zones
        </Link>
        <Link href="/admin/ai/schedules" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-glass">
          <Settings className="h-4 w-4 text-accent" /> Schedules
        </Link>
        <Link href="/admin/incidents" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-glass">
          <Activity className="h-4 w-4 text-accent" /> Incident Center
        </Link>
      </div>
    </AdminShell>
  );
}
