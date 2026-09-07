"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "./StaffShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function StaffRoomsClient({ user }: { user: SafeUser }) {
  const [rooms, setRooms] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/staff/rooms", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setRooms(j.rooms ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">Rooms</h1>
      <p className="mt-1 text-muted">View rooms across campus buildings (read-only)</p>
      {error && <div className="mt-4 text-sm text-red-300">Unable to load rooms <button type="button" onClick={load} className="ml-2 text-accent underline">Retry</button></div>}
      <div className="mt-8 overflow-hidden rounded-2xl border border-border">
        {loading ? <div className="p-6"><div className="h-32 animate-pulse rounded-xl bg-glass" /></div> : rooms.length === 0 ? (
          <div className="p-8"><EmptyState title="No rooms" description="Rooms will appear here once configured by your administrator." icon="inbox" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted"><th className="px-4 py-3">Room</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Building</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={String(r.id)} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3"><p className="font-medium">{String(r.name)}</p><p className="font-mono text-xs text-accent">{String(r.roomId)}</p></td>
                    <td className="px-4 py-3">{String(r.code)}</td>
                    <td className="px-4 py-3">{String(r.buildingName)}</td>
                    <td className="px-4 py-3">{String(r.type)}</td>
                    <td className="px-4 py-3">{String(r.maxCapacity)}</td>
                    <td className="px-4 py-3">{String(r.status)}</td>
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
