"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function VideoWallClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/video/ops?view=wall", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setData(j));
  }, []);

  const cameras = (data?.cameras as Array<Record<string, unknown>>) || [];
  const presets = (data?.presets as Array<Record<string, unknown>>) || [];

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-red-400">Command</p>
          <h1 className="text-2xl font-semibold">Video Wall</h1>
          <p className="text-xs text-muted">Control-room layout — dark, dense, operational.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {presets.map((p) => (
            <span key={String(p.presetId)} className="rounded border border-white/15 px-2 py-1">
              {String(p.name)}
            </span>
          ))}
          <Link href="/video" className="rounded border border-white/15 px-3 py-1.5">
            Video center
          </Link>
          <Link href="/map?mode=EMERGENCY" className="rounded border border-red-500/30 px-3 py-1.5 text-red-300">
            Incident map
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cameras.slice(0, 16).map((c) => (
          <Link
            key={String(c.id)}
            href={`/video/cameras/${encodeURIComponent(String(c.cameraId))}`}
            className="aspect-video rounded-lg border border-border bg-black/60 p-3 hover:border-sky-500/40"
          >
            <p className="text-xs font-medium">{String(c.name)}</p>
            <p className="mt-1 text-[10px] text-muted">{String(c.status)} — not shown as live unless stream is live</p>
          </Link>
        ))}
        {!cameras.length && (
          <p className="col-span-full p-8 text-center text-sm text-muted">No online cameras.</p>
        )}
      </div>
    </AdminShell>
  );
}
