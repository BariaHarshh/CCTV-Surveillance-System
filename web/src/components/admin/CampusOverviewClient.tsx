"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { CampusHierarchyTree, type HierarchyNode } from "@/components/campus/CampusHierarchyTree";
import { Building2, Camera, DoorOpen } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function CampusOverviewClient({ user }: { user: SafeUser }) {
  const [campus, setCampus] = useState<Record<string, unknown> | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/campus", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        setCampus(j.campus);
        setHierarchy(j.hierarchy);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = campus?.statistics as Record<string, number> | undefined;

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campus Overview</h1>
          <p className="mt-1 text-muted">{String(campus?.name ?? "")} · {String(campus?.type ?? "")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/campus/buildings" className="rounded-full border border-border px-4 py-2 text-sm">Buildings</Link>
          <Link href="/admin/campus/rooms" className="rounded-full border border-border px-4 py-2 text-sm">Rooms</Link>
          <Link href="/admin/cameras" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-background">Cameras</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {loading ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />) : stats && (
          <>
            <StatCard label="Buildings" value={stats.buildings} icon={Building2} delay={0} />
            <StatCard label="Rooms" value={stats.rooms} icon={DoorOpen} delay={0.05} />
            <StatCard label="Cameras" value={stats.cameras} icon={Camera} delay={0.1} />
            <StatCard label="Online Cameras" value={stats.onlineCameras} icon={Camera} delay={0.15} />
            <StatCard label="Offline Cameras" value={stats.offlineCameras} icon={Camera} delay={0.2} />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Campus Details</h2>
          {loading ? <div className="mt-4 h-32 animate-pulse rounded-xl bg-glass" /> : (
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Students</dt><dd>{String(campus?.students ?? 0)}</dd></div>
              <div><dt className="text-muted">Faculty</dt><dd>{String(campus?.faculty ?? 0)}</dd></div>
              <div><dt className="text-muted">Security Personnel</dt><dd>{String(campus?.securityPersonnel ?? 0)}</dd></div>
              <div><dt className="text-muted">Capacity</dt><dd>{stats?.totalCapacity ?? 0}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">AI Occupancy</dt><dd className="text-amber-300/90">Coming Soon</dd></div>
            </dl>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Campus Structure</h2>
          <p className="mt-1 text-xs text-muted">Click Campus → Building → Floor → Room</p>
          <div className="mt-4 max-h-80 overflow-y-auto">
            {hierarchy ? <CampusHierarchyTree node={hierarchy} /> : loading ? null : <p className="text-sm text-muted">No structure yet. Add buildings and rooms.</p>}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
