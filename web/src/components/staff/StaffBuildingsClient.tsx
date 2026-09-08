"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "./StaffShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function StaffBuildingsClient({ user }: { user: SafeUser }) {
  const [buildings, setBuildings] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/staff/buildings", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setBuildings(j.buildings ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">Buildings</h1>
      <p className="mt-1 text-muted">View campus buildings (read-only)</p>
      {error && <div className="mt-4 text-sm text-red-300">Unable to load buildings <button type="button" onClick={load} className="ml-2 text-accent underline">Retry</button></div>}
      <div className="mt-8 overflow-hidden rounded-2xl border border-border">
        {loading ? <div className="p-6"><div className="h-32 animate-pulse rounded-xl bg-glass" /></div> : buildings.length === 0 ? (
          <div className="p-8"><EmptyState title="No buildings" description="Your administrator has not configured buildings yet." icon="inbox" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted"><th className="px-4 py-3">Building</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Floors</th><th className="px-4 py-3">Rooms</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>
                {buildings.map((b) => (
                  <tr key={String(b.id)} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3"><p className="font-medium">{String(b.name)}</p><p className="font-mono text-xs text-accent">{String(b.buildingId)}</p></td>
                    <td className="px-4 py-3">{String(b.code)}</td>
                    <td className="px-4 py-3">{String(b.type)}</td>
                    <td className="px-4 py-3">{String(b.floors)}</td>
                    <td className="px-4 py-3">{String(b.roomCount)}</td>
                    <td className="px-4 py-3">{String(b.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StaffShell>
  );
}
