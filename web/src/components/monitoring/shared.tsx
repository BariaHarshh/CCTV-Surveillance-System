"use client";

import { cn } from "@/lib/utils";
import type { RealtimeStatus } from "@/hooks/useMonitoringSocket";

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
    HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase", colors[severity] ?? "bg-white/10 text-muted border-border", className)}>
      {severity}
    </span>
  );
}

export function CameraStatusDot({ status }: { status: string }) {
  const online = status === "ONLINE";
  const colors: Record<string, string> = {
    ONLINE: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    OFFLINE: "bg-slate-500",
    CONNECTING: "bg-amber-400 animate-pulse",
    ERROR: "bg-red-500",
    MAINTENANCE: "bg-violet-400",
    DISABLED: "bg-slate-600",
  };
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className={cn("h-2 w-2 rounded-full", colors[status] ?? "bg-slate-500", online && "animate-pulse")} />
      {status}
    </span>
  );
}

export function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  const label = status === "connected" ? "REAL-TIME CONNECTED" : status === "reconnecting" ? "RECONNECTING..." : "DISCONNECTED";
  const color = status === "connected" ? "text-emerald-400" : status === "reconnecting" ? "text-amber-400" : "text-slate-500";
  return (
    <span className={cn("inline-flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase", color)}>
      <span className={cn("h-2 w-2 rounded-full", status === "connected" ? "bg-emerald-400" : status === "reconnecting" ? "bg-amber-400 animate-pulse" : "bg-slate-500")} />
      {label}
    </span>
  );
}

export function formatConfidence(confidence: number | null | undefined): string {
  if (confidence == null || Number.isNaN(confidence)) return "Confidence unavailable";
  return `Confidence: ${Math.round(confidence * 100)}%`;
}

export function formatEventType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
