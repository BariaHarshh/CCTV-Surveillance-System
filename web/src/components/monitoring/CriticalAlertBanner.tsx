"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { SeverityBadge } from "./shared";

export function CriticalAlertBanner({
  alert,
  basePath,
  onDismiss,
}: {
  alert: { id?: string; alertId?: string; title?: string; severity?: string; location?: Record<string, string | undefined> };
  basePath: string;
  onDismiss: () => void;
}) {
  const id = alert.id as string | undefined;
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-red-500/40 bg-red-950/90 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-red-400">NEW CRITICAL ALERT</p>
          <p className="mt-1 font-semibold">{alert.title}</p>
          <p className="mt-1 text-xs text-red-200/80">
            {[alert.location?.building, alert.location?.camera].filter(Boolean).join(" · ") || "Campus"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {alert.severity && <SeverityBadge severity={alert.severity} />}
          </div>
          {id && (
            <Link href={`${basePath}/alerts/${id}`} className="mt-3 inline-block text-xs font-medium text-red-300 hover:underline">
              View alert →
            </Link>
          )}
        </div>
        <button type="button" onClick={onDismiss} className="text-red-300 hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
