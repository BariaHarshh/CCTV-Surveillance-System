"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { inputClass, selectClass } from "@/components/organizations/WizardUI";
import { CAMERA_PROTOCOLS, CAMERA_TYPES } from "@/lib/campus/constants";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/time";

interface CameraRow {
  id: string;
  cameraId: string;
  name: string;
  type: string;
  status: string;
  lastSeen: string | null;
  location: { campus?: string; building?: string; room?: string };
}

interface BuildingOption { id: string; name: string }
interface RoomOption { id: string; name: string; buildingId: string }

const emptyForm = {
  name: "",
  type: "Fixed" as (typeof CAMERA_TYPES)[number],
  manufacturer: "",
  model: "",
  serialNumber: "",
  buildingId: "",
  roomId: "",
  floor: 1,
  areaLabel: "",
  connection: { streamUrl: "", protocol: "HTTP" as (typeof CAMERA_PROTOCOLS)[number], connectionType: "Wired", username: "", password: "" },
};

function statusClass(status: string) {
  if (status === "ONLINE") return "bg-emerald-500/10 text-emerald-400";
  if (status === "ERROR") return "bg-red-500/10 text-red-400";
  if (status === "MAINTENANCE") return "bg-amber-500/10 text-amber-400";
  if (status === "CONNECTING") return "bg-sky-500/10 text-sky-400";
  return "bg-white/5 text-muted";
}

export function CamerasClient({ user }: { user: SafeUser }) {
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/admin/cameras", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/buildings", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/rooms", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([camJson, bldJson, roomJson]) => {
        setCameras(camJson.cameras ?? []);
        setBuildings((bldJson.buildings ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
        setRooms((roomJson.rooms ?? []).map((r: { id: string; name: string; buildingId: string }) => ({ id: r.id, name: r.name, buildingId: r.buildingId })));
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/cameras", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        buildingId: form.buildingId || null,
        roomId: form.roomId || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm(emptyForm);
      load();
    }
  };

  const testCamera = async (id: string) => {
    setTestingId(id);
    setTestMsg("Testing Camera Connection...");
    const res = await fetch(`/api/admin/cameras/${id}/test`, { method: "POST", credentials: "include" });
    const j = await res.json();
    setTestMsg(res.ok && j.success ? "Camera Connected" : "Unable to Connect");
    setTestingId(null);
    load();
  };

  const toggleEnable = async (id: string, status: string) => {
    const action = status === "DISABLED" ? "enable" : "disable";
    await fetch(`/api/admin/cameras/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this camera?")) return;
    await fetch(`/api/admin/cameras/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const filteredRooms = rooms.filter((r) => !form.buildingId || r.buildingId === form.buildingId);

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cameras</h1>
          <p className="mt-1 text-muted">Camera management foundation — no AI engine yet</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background">Add Camera</button>
      </div>

      {testMsg && <p className="mt-4 text-sm text-accent">{testMsg}</p>}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          Unable to load cameras
          <button type="button" onClick={load} className="ml-3 text-accent underline">Retry</button>
        </div>
      )}

      {showForm && (
        <div className="mt-6 rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">New Camera</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs text-muted">Name</label><input className={inputClass + " mt-1"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label className="text-xs text-muted">Type</label>
              <select className={selectClass + " mt-1"} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                {CAMERA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-muted">Stream URL</label><input className={inputClass + " mt-1"} value={form.connection.streamUrl} onChange={(e) => setForm({ ...form, connection: { ...form.connection, streamUrl: e.target.value } })} placeholder="https://..." /></div>
            <div>
              <label className="text-xs text-muted">Protocol</label>
              <select className={selectClass + " mt-1"} value={form.connection.protocol} onChange={(e) => setForm({ ...form, connection: { ...form.connection, protocol: e.target.value as typeof form.connection.protocol } })}>
                {CAMERA_PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Building</label>
              <select className={selectClass + " mt-1"} value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value, roomId: "" })}>
                <option value="">Optional</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Room</label>
              <select className={selectClass + " mt-1"} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">Optional</option>
                {filteredRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-muted">Username (encrypted at rest)</label><input className={inputClass + " mt-1"} value={form.connection.username} onChange={(e) => setForm({ ...form, connection: { ...form.connection, username: e.target.value } })} autoComplete="off" /></div>
            <div><label className="text-xs text-muted">Password (encrypted at rest)</label><input type="password" className={inputClass + " mt-1"} value={form.connection.password} onChange={(e) => setForm({ ...form, connection: { ...form.connection, password: e.target.value } })} autoComplete="new-password" /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={saving} onClick={submit} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-background disabled:opacity-70">{saving ? "Saving..." : "Save Camera"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-border px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border border-border">
        {loading ? (
          <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-glass" /></div>
        ) : cameras.length === 0 ? (
          <div className="p-8"><EmptyState title="No cameras configured" description="Add your first campus camera to prepare the monitoring network." icon="inbox" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3">Camera</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Seen</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-accent">{c.cameraId}</td>
                    <td className="px-4 py-3 text-muted">{[c.location.building, c.location.room].filter(Boolean).join(" · ") || c.location.campus || "—"}</td>
                    <td className="px-4 py-3">{c.type}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs", statusClass(c.status))}>{c.status}</span></td>
                    <td className="px-4 py-3 text-muted">{c.lastSeen ? formatRelativeTime(new Date(c.lastSeen)) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button type="button" disabled={testingId === c.id} onClick={() => testCamera(c.id)} className="text-accent">{testingId === c.id ? "Testing..." : "Test"}</button>
                        <button type="button" onClick={() => toggleEnable(c.id, c.status)} className="text-muted">{c.status === "DISABLED" ? "Enable" : "Disable"}</button>
                        <button type="button" onClick={() => remove(c.id)} className="text-red-400">Remove</button>
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
