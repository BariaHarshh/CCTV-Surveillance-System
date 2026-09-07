"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { cn } from "@/lib/utils";

export function AIHealthClient({ user }: { user: SafeUser }) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai/health", { credentials: "include" }).then((r) => r.json()).then((d) => setHealth(d.health));
  }, []);

  const services = (health?.services as { name: string; status: string; detail: string }[]) ?? [];
  const metrics = health?.metrics as Record<string, unknown> | undefined;

  return (
    <AdminShell user={user}>
      <Link href="/admin/ai" className="text-xs text-accent hover:underline">← AI Intelligence</Link>
      <h1 className="mt-2 text-2xl font-bold">AI Health Monitoring</h1>
      <p className="mt-1 text-muted">Real telemetry from detection services — no simulated metrics.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-surface/50 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{s.name}</p>
              <span className={cn("text-[10px] font-semibold uppercase", s.status === "HEALTHY" ? "text-emerald-400" : s.status === "DEGRADED" ? "text-amber-400" : "text-red-400")}>{s.status}</span>
            </div>
            <p className="mt-2 text-xs text-muted">{s.detail}</p>
          </div>
        ))}
      </div>

      {metrics && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Cameras Processing", value: metrics.camerasProcessing },
            { label: "Events / Minute", value: metrics.eventsPerMinute },
            { label: "Event Queue Depth", value: metrics.eventQueueDepth },
            { label: "Failed Detections", value: metrics.failedDetections },
            { label: "Avg Latency (ms)", value: metrics.averageDetectionLatencyMs ?? "N/A" },
            { label: "Last Processed", value: metrics.aiServiceUptime ? new Date(String(metrics.aiServiceUptime)).toLocaleString() : "—" },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted">{m.label}</p>
              <p className="mt-1 text-xl font-bold">{String(m.value)}</p>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
