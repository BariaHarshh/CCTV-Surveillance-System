"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "./StaffShell";
import { StatCard, StatCardSkeleton } from "@/components/super-admin/StatCard";
import { CampusHierarchyTree, type HierarchyNode } from "@/components/campus/CampusHierarchyTree";
import { Building2, Camera, DoorOpen } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function StaffCampusClient({ user }: { user: SafeUser }) {
  const [campus, setCampus] = useState<Record<string, unknown> | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/staff/campus", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setCampus(j.campus);
        setHierarchy(j.hierarchy);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const stats = campus?.statistics as Record<string, number> | undefined;

  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">Campus Overview</h1>
      <p className="mt-1 text-muted">Read-only campus structure for your organization</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          Unable to load campus
          <button type="button" onClick={load} className="ml-3 text-accent underline">Retry</button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : stats && (
          <>
            <StatCard label="Buildings" value={stats.buildings} icon={Building2} delay={0} />
            <StatCard label="Rooms" value={stats.rooms} icon={DoorOpen} delay={0.05} />
            <StatCard label="Cameras" value={stats.cameras} icon={Camera} delay={0.1} />
            <StatCard label="Online Cameras" value={stats.onlineCameras} icon={Camera} delay={0.15} />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">{String(campus?.name ?? "Campus")}</h2>
          <p className="mt-1 text-sm text-muted">{String(campus?.type ?? "")}</p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Students</dt><dd>{String(campus?.students ?? 0)}</dd></div>
            <div><dt className="text-muted">Faculty</dt><dd>{String(campus?.faculty ?? 0)}</dd></div>
            <div><dt className="text-muted">Security</dt><dd>{String(campus?.securityPersonnel ?? 0)}</dd></div>
            <div><dt className="text-muted">AI Occupancy</dt><dd className="text-amber-300/90">Coming Soon</dd></div>
          </dl>
        </section>
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Campus Structure</h2>
          <div className="mt-4 max-h-80 overflow-y-auto">
            {hierarchy ? <CampusHierarchyTree node={hierarchy} /> : !loading && <p className="text-sm text-muted">No structure available.</p>}
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
