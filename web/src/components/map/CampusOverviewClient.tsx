"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function CampusOverviewClient({ user }: { user: SafeUser }) {
  const params = useParams<{ id: string }>();
  const [bootstrap, setBootstrap] = useState<Record<string, unknown> | null>(null);
  const [heatmap, setHeatmap] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/map/bootstrap", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/map/heatmap?timeRange=30D", { credentials: "include" }).then((r) => r.json()),
    ]).then(([b, h]) => {
      setBootstrap(b.bootstrap);
      setHeatmap(h.heatmap);
    });
  }, [params.id]);

  const campus = bootstrap?.campus as Record<string, unknown> | undefined;

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{String(campus?.name || "Campus")}</h1>
          <p className="text-xs text-muted">{String(campus?.address || "")}</p>
        </div>
        <Link href="/map" className="rounded border border-white/15 px-3 py-1.5 text-xs">
          Open map
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="text-xs text-muted">Buildings</p>
          <p className="text-2xl font-semibold">
            {((bootstrap?.buildings as unknown[]) || []).length}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="text-xs text-muted">Active emergency</p>
          <p className="text-2xl font-semibold">
            {bootstrap?.activeEmergency ? "YES" : "None"}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="text-xs text-muted">Coordinates</p>
          <p className="text-sm">
            {campus?.hasCoordinates ? "Configured" : "Not configured"}
          </p>
        </div>
      </div>
      <section className="mt-6 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Risk areas (30d)</h2>
        <ul className="mt-3 space-y-2 text-xs">
          {((heatmap?.cells as Array<Record<string, unknown>>) || []).map((c) => (
            <li key={String(c.id)} className="flex justify-between border-b border-white/5 py-2">
              <span>{String(c.name)}</span>
              <span>{String(c.level)}</span>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
