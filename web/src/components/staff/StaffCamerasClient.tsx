"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "./StaffShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";

interface CameraCard {
  id: string;
  cameraId: string;
  name: string;
  status: string;
  location: { campus?: string; building?: string; room?: string };
  lastSeen: string | null;
}

function statusColor(status: string) {
  if (status === "ONLINE") return "text-emerald-400";
  if (status === "MAINTENANCE") return "text-amber-400";
  if (status === "ERROR") return "text-red-400";
  return "text-muted";
}

export function StaffCamerasClient({ user }: { user: SafeUser }) {
  const [cameras, setCameras] = useState<CameraCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/staff/cameras", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load");
        setCameras(j.cameras ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">Cameras</h1>
      <p className="mt-1 text-muted">Authorized camera feeds for your organization</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          Unable to load cameras
          <button type="button" onClick={load} className="ml-3 text-accent underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-glass" />)}</div>
      ) : cameras.length === 0 ? (
        <div className="mt-8"><EmptyState title="No cameras configured" description="Your administrator has not assigned any cameras yet." icon="inbox" /></div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map((c) => (
            <article key={c.id} className="overflow-hidden rounded-2xl border border-border bg-surface/50">
              <div className="flex aspect-video items-center justify-center bg-black/40 text-center text-sm text-muted">
                {c.status === "ONLINE" ? (
                  <span>NO LIVE STREAM AVAILABLE</span>
                ) : (
                  <span className="text-red-300/90">Camera Offline</span>
                )}
              </div>
              <div className="p-4">
                <p className="font-mono text-xs text-accent">{c.cameraId}</p>
                <h2 className="mt-1 font-semibold">{c.name}</h2>
                <p className={cn("mt-2 text-sm font-medium", statusColor(c.status))}>● {c.status}</p>
                <p className="mt-2 text-xs text-muted">{c.location.building ?? c.location.campus}{c.location.room ? ` · ${c.location.room}` : ""}</p>
                <p className="mt-1 text-xs text-muted">Last Seen: {c.lastSeen ? new Date(c.lastSeen).toLocaleTimeString() : "—"}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
