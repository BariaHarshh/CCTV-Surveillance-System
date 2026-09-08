"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { PLAYBOOK_CATEGORIES } from "@/lib/emergency/constants";

export function PlaybooksClient({ user }: { user: SafeUser }) {
  const [playbooks, setPlaybooks] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("SECURITY");

  const load = useCallback(() => {
    fetch("/api/playbooks", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPlaybooks(d.playbooks ?? []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/playbooks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        steps: [
          { title: "Verify situation" },
          { title: "Assign response team" },
          { title: "Record status" },
        ],
      }),
    });
    setName("");
    load();
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/playbooks/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    load();
  }

  async function duplicate(id: string) {
    await fetch(`/api/playbooks/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicate: true }),
    });
    load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Emergency Playbooks</h1>
      <p className="mt-1 text-muted">Organization-approved emergency response workflows.</p>

      <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Playbook name" className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm">
          {PLAYBOOK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">Create</button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {playbooks.map((p) => (
          <div key={String(p.id)} className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{String(p.name)}</h3>
                <p className="text-xs text-muted">{String(p.category)} · v{String(p.version)} · {p.enabled ? "Enabled" : "Disabled"}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => toggle(String(p.id), Boolean(p.enabled))} className="text-[10px] text-accent">{p.enabled ? "Disable" : "Enable"}</button>
                <button type="button" onClick={() => duplicate(String(p.id))} className="text-[10px] text-muted">Duplicate</button>
              </div>
            </div>
            <ol className="mt-3 space-y-1 text-xs text-muted">
              {((p.steps as Array<{ order: number; title: string }>) ?? []).map((s) => (
                <li key={s.order}>{s.order}. {s.title}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
