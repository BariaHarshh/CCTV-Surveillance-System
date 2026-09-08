"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";

/** Persistent emergency banner — only dismissible by resolving the emergency (authorized users). */
export function EmergencyBanner() {
  const [emergency, setEmergency] = useState<{
    id: string;
    type: string;
    reason: string;
    location?: { label?: string; building?: string };
    activatedAt: string;
    mode: string;
  } | null>(null);

  const load = () => {
    fetch("/api/command-center/overview", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.overview?.activeEmergencies ?? [];
        const first = list.find((e: { source?: string }) => e.source !== "TEST") ?? list[0] ?? null;
        setEmergency(first);
      })
      .catch(() => setEmergency(null));
  };

  useEffect(() => { load(); }, []);
  useMonitoringSocket({
    onEmergencyCreated: () => load(),
    onEmergencyUpdated: () => load(),
    onEmergencyResolved: () => load(),
  });

  if (!emergency) return null;

  const location = emergency.location?.label || emergency.location?.building || "Campus";
  const started = new Date(emergency.activatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="sticky top-0 z-50 border-b border-red-500/40 bg-red-950/95 px-4 py-2.5 text-red-100 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold tracking-wide">⚠ EMERGENCY ACTIVE</span>
          <span className="hidden sm:inline text-red-200/80">|</span>
          <span>{emergency.type.replace(/_/g, " ")}</span>
          <span className="text-red-200/80">{location}</span>
          <span className="text-red-200/70">Started {started}</span>
          <span className="rounded border border-red-400/30 px-2 py-0.5 text-[10px] uppercase">{emergency.mode}</span>
        </div>
        <Link href={`/admin/emergencies/${emergency.id}`} className="text-xs font-semibold text-red-200 underline hover:text-foreground">
          Open Command View
        </Link>
      </div>
    </div>
  );
}
