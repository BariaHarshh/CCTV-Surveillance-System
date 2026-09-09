"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Camera, Maximize2, RefreshCw } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";
import { useCriticalAlertSound, useSoundNotificationsEnabled } from "@/hooks/useCriticalAlertSound";
import { CriticalAlertBanner } from "./CriticalAlertBanner";
import { MonitoringPortal } from "./MonitoringPortal";
import { CameraStatusDot, RealtimeIndicator, formatTime } from "./shared";
import { CameraStreamView } from "./CameraStreamView";
import { cn } from "@/lib/utils";

interface Overview {
  cameras: { total: number; online: number; offline: number };
  events: { active: number };
  alerts: { critical: number; unresolved: number };
}

interface MonitoringCamera {
  id: string;
  cameraId: string;
  name: string;
  status: string;
  location: { building?: string; room?: string; areaLabel?: string };
  lastSeen: string | null;
  hasActiveEvents?: boolean;
}

export function MonitoringClient({ user, portal }: { user: SafeUser; portal: "admin" | "staff" }) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [cameras, setCameras] = useState<MonitoringCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [criticalBanner, setCriticalBanner] = useState<Record<string, unknown> | null>(null);
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundNotificationsEnabled();
  const { play: playCriticalSound } = useCriticalAlertSound(soundEnabled);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, camRes] = await Promise.all([
        fetch("/api/monitoring/overview", { credentials: "include" }),
        fetch("/api/monitoring/cameras", { credentials: "include" }),
      ]);
      const ov = await ovRes.json();
      const cam = await camRes.json();
      if (ovRes.ok && ov.overview) {
        const o = ov.overview;
        setOverview({
          cameras: o.cameras,
          events: o.events,
          alerts: o.alerts,
        });
      }
      if (camRes.ok) {
        const sorted = [...(cam.cameras ?? [])].sort((a, b) => (a.cameraId || "").localeCompare(b.cameraId || ""));
        setCameras(sorted);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (process.env.NODE_ENV === "development") {
      fetch("/api/monitoring/test", { method: "OPTIONS" }).catch(() => {});
    }
  }, [load]);

  const { status: realtimeStatus } = useMonitoringSocket({
    onCameraStatus: (p) => {
      const cameraId = p.cameraId as string;
      setCameras((prev) =>
        prev.map((c) =>
          c.cameraId === cameraId || c.id === cameraId
            ? { ...c, status: p.status as string, lastSeen: (p.lastSeen as string) ?? c.lastSeen }
            : c
        )
      );
    },
    onAlertCreated: (p) => {
      load();
      if (p.severity === "CRITICAL" || p.severity === "HIGH") {
        setCriticalBanner(p);
        if (p.severity === "CRITICAL") playCriticalSound();
      }
    },
    onEventCreated: () => load(),
    onDetectionCreated: () => load(),
  });

  async function runTest(action: string) {
    const res = await fetch("/api/monitoring/test", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, cameraId: cameras[0]?.id }),
    });
    if (res.ok) load();
  }

  return (
    <MonitoringPortal portal={portal} user={user}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Live Campus Monitoring</h1>
          <p className="mt-1 text-muted">Real-time visibility across your organization&apos;s camera network.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`${base}/monitoring/live`}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live AI Feed
          </Link>
          <RealtimeIndicator status={realtimeStatus} />
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium text-muted hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => toggleSound(!soundEnabled)}
            className={`rounded-full border px-4 py-2 text-xs font-medium ${soundEnabled ? "border-accent/30 text-accent" : "border-border text-muted"}`}
          >
            Sound {soundEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : overview ? (
          <>
            <StatCard label="Total Cameras" value={overview.cameras.total} icon={Camera} delay={0} />
            <StatCard label="Online Cameras" value={overview.cameras.online} icon={Camera} delay={0.05} />
            <StatCard label="Offline Cameras" value={overview.cameras.offline} icon={Camera} delay={0.1} />
            <StatCard label="Active Events" value={overview.events.active} icon={AlertTriangle} delay={0.15} />
            <StatCard label="Critical Alerts" value={overview.alerts.critical} icon={AlertTriangle} delay={0.2} />
            <StatCard label="Unresolved Alerts" value={overview.alerts.unresolved} icon={AlertTriangle} delay={0.25} />
          </>
        ) : null}
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <button type="button" onClick={() => setTestMode(!testMode)} className="text-xs font-semibold text-amber-400">
            Monitoring Test Mode {testMode ? "▲" : "▼"}
          </button>
          {testMode && (
            <div className="mt-3 flex flex-wrap gap-2">
              {["test_event", "test_critical_alert", "camera_online", "camera_offline", "test_person", "test_occupancy", "test_restricted_entry", "test_after_hours", "test_abandoned_object", "test_fire", "test_smoke", "test_ppe", "test_tamper", "test_full_chain", "test_emergency", "test_escalation", "test_team_assignment", "test_task", "test_websocket_emergency", "test_emergency_resolve"].map((a) => (
                <button key={a} type="button" onClick={() => runTest(a)} className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300 hover:bg-amber-500/20">
                  {a.replace(/_/g, " ")}
                </button>
              ))}
              <p className="w-full text-[10px] text-muted">Requires MONITORING_TEST_MODE=true. All items marked source: TEST.</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Camera Grid</h2>
        <p className="mt-1 text-sm text-muted">Streams load on demand — only visible cameras consume bandwidth.</p>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-glass" />
            ))}
          </div>
        ) : cameras.length === 0 ? (
          <p className="mt-6 rounded-xl border border-border bg-glass p-8 text-center text-sm text-muted">No cameras configured. Add cameras in Campus Management.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cameras.map((cam, i) => (
              <motion.div
                key={cam.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="overflow-hidden rounded-2xl border border-border bg-surface/50"
              >
                <div className="border-b border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] text-muted">{cam.cameraId}</p>
                      <h3 className="font-semibold">{cam.name}</h3>
                    </div>
                    <CameraStatusDot status={cam.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {[cam.location.building, cam.location.room, cam.location.areaLabel].filter(Boolean).join(" · ") || "No location"}
                  </p>
                  {cam.lastSeen && <p className="mt-1 text-[10px] text-muted">Last seen: {formatTime(cam.lastSeen)}</p>}
                </div>
                <div className="p-3">
                  <CameraStreamView cameraDbId={cam.id} status={cam.status} />
                </div>
                <div className="flex border-t border-border">
                  <Link href={`${base}/monitoring/cameras/${cam.id}`} className="flex flex-1 items-center justify-center gap-1 py-3 text-xs text-muted hover:text-accent">
                    <Maximize2 className="h-3.5 w-3.5" /> Details
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {criticalBanner && (
        <CriticalAlertBanner
          alert={criticalBanner as { id?: string; title?: string; severity?: string; location?: Record<string, string | undefined> }}
          basePath={base}
          onDismiss={() => setCriticalBanner(null)}
        />
      )}
    </MonitoringPortal>
  );
}
