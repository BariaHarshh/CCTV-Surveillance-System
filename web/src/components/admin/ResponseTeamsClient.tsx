"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { RESPONSE_TEAM_TYPES } from "@/lib/emergency/constants";

export function ResponseTeamsClient({ user }: { user: SafeUser }) {
  const [teams, setTeams] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("SECURITY");

  const load = useCallback(() => {
    fetch("/api/response-teams", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/response-teams", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    setName("");
    load();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/response-teams/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Response Teams</h1>
      <p className="mt-1 text-muted">Manage campus emergency response teams.</p>

      <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm">
          {RESPONSE_TEAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">Create Team</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={String(t.id)} className="border-b border-white/[0.04]">
                <td className="px-4 py-3">
                  <p className="font-medium">{String(t.name)}</p>
                  <p className="font-mono text-[10px] text-muted">{String(t.teamId)}</p>
                </td>
                <td className="px-4 py-3">{String(t.type)}</td>
                <td className="px-4 py-3">{(t.members as unknown[])?.length ?? 0}</td>
                <td className="px-4 py-3">{String(t.status)}</td>
                <td className="px-4 py-3">
                  <select value={String(t.status)} onChange={(e) => setStatus(String(t.id), e.target.value)} className="rounded border border-border bg-black/20 px-2 py-1 text-xs">
                    {["AVAILABLE", "BUSY", "OFFLINE", "ON_LEAVE"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
