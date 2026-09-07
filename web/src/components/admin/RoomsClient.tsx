"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { inputClass, selectClass } from "@/components/organizations/WizardUI";
import { ROOM_TYPES } from "@/lib/campus/constants";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";

interface RoomRow {
  id: string;
  roomId: string;
  name: string;
  code: string;
  roomNumber: string;
  buildingName: string;
  type: string;
  maxCapacity: number;
  cameras: number;
  status: string;
  floor: number;
  buildingId: string;
}

interface BuildingOption {
  id: string;
  name: string;
}

const emptyForm = {
  buildingId: "",
  floor: 1,
  name: "",
  roomNumber: "",
  code: "",
  type: "Classroom" as (typeof ROOM_TYPES)[number],
  maxCapacity: 30,
  normalCapacity: 25,
  purpose: "",
};

export function RoomsClient({ user }: { user: SafeUser }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/admin/rooms", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/buildings", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([roomsJson, buildingsJson]) => {
        setRooms(roomsJson.rooms ?? []);
        setBuildings((buildingsJson.buildings ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setSaving(true);
    const url = editId ? `/api/admin/rooms/${editId}` : "/api/admin/rooms";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      load();
    }
  };

  const toggleStatus = async (id: string, status: string) => {
    const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await fetch(`/api/admin/rooms/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  };

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rooms</h1>
          <p className="mt-1 text-muted">Manage rooms across campus buildings</p>
        </div>
        <button type="button" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background">Create Room</button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          Unable to load rooms
          <button type="button" onClick={load} className="ml-3 text-accent underline">Retry</button>
        </div>
      )}

      {showForm && (
        <div className="mt-6 rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">{editId ? "Edit Room" : "New Room"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Building</label>
              <select className={selectClass + " mt-1"} value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })}>
                <option value="">Select building</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Floor</label>
              <input type="number" min={0} className={inputClass + " mt-1"} value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} />
            </div>
            {(["name", "roomNumber", "code"] as const).map((f) => (
              <div key={f}>
                <label className="text-xs text-muted capitalize">{f.replace(/([A-Z])/g, " $1")}</label>
                <input className={inputClass + " mt-1"} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="text-xs text-muted">Type</label>
              <select className={selectClass + " mt-1"} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Max Capacity</label>
              <input type="number" min={0} className={inputClass + " mt-1"} value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={saving} onClick={submit} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background disabled:opacity-70">{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-border px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border border-border">
        {loading ? (
          <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-glass" /></div>
        ) : rooms.length === 0 ? (
          <div className="p-8"><EmptyState title="No rooms configured" description="Create rooms inside your buildings to complete the campus structure." icon="inbox" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Room Code</th>
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Capacity</th>
                  <th className="px-4 py-3 text-right">Cameras</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3"><p className="font-medium">{r.name}</p><p className="font-mono text-xs text-accent">{r.roomId}</p></td>
                    <td className="px-4 py-3">{r.code}</td>
                    <td className="px-4 py-3">{r.buildingName}</td>
                    <td className="px-4 py-3">{r.type}</td>
                    <td className="px-4 py-3 text-right">{r.maxCapacity}</td>
                    <td className="px-4 py-3 text-right">{r.cameras}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs", r.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-muted")}>{r.status}</span></td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggleStatus(r.id, r.status)} className="text-xs text-muted">{r.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
