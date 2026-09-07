"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

interface Zone {
  id: string;
  zoneId: string;
  name: string;
  cameraName?: string;
  buildingName?: string;
  roomName?: string;
  status: string;
  scheduleId: string | null;
}

export function RestrictedZonesClient({ user }: { user: SafeUser }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", cameraId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/restricted-zones", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setZones(data.zones ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/restricted-zones", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowForm(false); setForm({ name: "", cameraId: "" }); load(); }
  }

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/ai" className="text-xs text-accent hover:underline">← AI Intelligence</Link>
          <h1 className="mt-2 text-2xl font-bold">Restricted Zones</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-background">
            <Plus className="h-3.5 w-3.5" /> Create Zone
          </button>
          <button type="button" onClick={load} className="rounded-full border border-border p-2 text-muted"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createZone} className="mt-6 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
          <input required placeholder="Zone name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-border bg-glass px-3 py-2 text-sm" />
          <input required placeholder="Camera DB ID" value={form.cameraId} onChange={(e) => setForm({ ...form, cameraId: e.target.value })} className="rounded-lg border border-border bg-glass px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background">Save</button>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-border bg-glass text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Camera</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
            ) : zones.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No restricted zones configured.</td></tr>
            ) : zones.map((z) => (
              <tr key={z.id} className="border-b border-white/[0.04]">
                <td className="px-4 py-3"><p className="font-medium">{z.name}</p><p className="font-mono text-[10px] text-muted">{z.zoneId}</p></td>
                <td className="px-4 py-3 text-muted">{z.cameraName ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{[z.buildingName, z.roomName].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-3 text-muted">{z.scheduleId ? "Assigned" : "Always restricted"}</td>
                <td className="px-4 py-3">{z.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
