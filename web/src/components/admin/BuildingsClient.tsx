"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { inputClass, selectClass } from "@/components/organizations/WizardUI";
import { BUILDING_TYPES } from "@/lib/campus/constants";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";

interface BuildingRow {
  id: string;
  buildingId: string;
  name: string;
  code: string;
  type: string;
  floors: number;
  roomCount: number;
  cameras: number;
  status: string;
}

const emptyForm = {
  name: "",
  code: "",
  type: "Academic" as (typeof BUILDING_TYPES)[number],
  description: "",
  floors: 1,
  entrances: 1,
  exits: 1,
  address: "",
};

export function BuildingsClient({ user }: { user: SafeUser }) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/admin/buildings", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setBuildings(j.buildings ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setSaving(true);
    const url = editId ? `/api/admin/buildings/${editId}` : "/api/admin/buildings";
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
    await fetch(`/api/admin/buildings/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  };

  const startEdit = (b: BuildingRow) => {
    setEditId(b.id);
    setForm({ name: b.name, code: b.code, type: b.type as typeof form.type, description: "", floors: b.floors, entrances: 1, exits: 1, address: "" });
    setShowForm(true);
  };

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Buildings</h1>
          <p className="mt-1 text-muted">Manage campus buildings and structure</p>
        </div>
        <button type="button" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background">Create Building</button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          Unable to load buildings
          <button type="button" onClick={load} className="ml-3 text-accent underline">Retry</button>
        </div>
      )}

      {showForm && (
        <div className="mt-6 rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">{editId ? "Edit Building" : "New Building"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["name", "code", "description", "address"] as const).map((f) => (
              <div key={f} className={f === "description" || f === "address" ? "sm:col-span-2" : ""}>
                <label className="text-xs text-muted capitalize">{f}</label>
                <input className={inputClass + " mt-1"} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="text-xs text-muted">Type</label>
              <select className={selectClass + " mt-1"} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                {BUILDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Floors</label>
              <input type="number" min={0} className={inputClass + " mt-1"} value={form.floors} onChange={(e) => setForm({ ...form, floors: Number(e.target.value) })} />
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
        ) : buildings.length === 0 ? (
          <div className="p-8"><EmptyState title="No buildings yet" description="Add your first building to structure your campus." icon="inbox" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Floors</th>
                  <th className="px-4 py-3 text-right">Rooms</th>
                  <th className="px-4 py-3 text-right">Cameras</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => (
                  <tr key={b.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3"><p className="font-medium">{b.name}</p><p className="font-mono text-xs text-accent">{b.buildingId}</p></td>
                    <td className="px-4 py-3">{b.code}</td>
                    <td className="px-4 py-3">{b.type}</td>
                    <td className="px-4 py-3 text-right">{b.floors}</td>
                    <td className="px-4 py-3 text-right">{b.roomCount}</td>
                    <td className="px-4 py-3 text-right">{b.cameras}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs", b.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-muted")}>{b.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEdit(b)} className="text-xs text-accent">Edit</button>
                        <button type="button" onClick={() => toggleStatus(b.id, b.status)} className="text-xs text-muted">{b.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                      </div>
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
