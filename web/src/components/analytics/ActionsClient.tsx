"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { KpiCard } from "@/components/analytics/charts";
import { ACTION_PRIORITIES } from "@/lib/analytics/constants";

type Action = {
  id: string;
  actionId: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  dueAt?: string | null;
  completedAt?: string | null;
  sourceType?: string;
};

export function ActionsClient({ user }: { user: SafeUser }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/actions", { credentials: "include" });
    const json = await res.json();
    setActions(json.actions ?? []);
    setStats(json.stats ?? {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createAction(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await fetch("/api/actions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, priority, sourceType: "MANUAL" }),
    });
    setTitle("");
    setDescription("");
    setBusy(false);
    load();
  }

  return (
    <AdminShell user={user}>
      <div>
        <h1 className="text-2xl font-bold">Corrective Actions</h1>
        <p className="mt-1 text-muted">Closed-loop improvements from incidents and patterns: investigate, update policy, inspect equipment.</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Open" value={stats.open ?? 0} />
        <KpiCard label="Due Soon" value={stats.dueSoon ?? 0} />
        <KpiCard label="Overdue" value={stats.overdue ?? 0} />
        <KpiCard label="Completed" value={stats.completed ?? 0} />
        <KpiCard label="Completion Rate" value={stats.completionRate != null ? `${stats.completionRate}%` : "—"} />
      </div>

      <form onSubmit={createAction} className="mt-6 space-y-3 rounded-2xl border border-border bg-surface/40 p-5">
        <h2 className="text-sm font-semibold">Create Corrective Action</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Investigate lighting / Review camera placement"
          className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-border bg-black/30 px-3 py-2 text-sm">
            {ACTION_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            Create
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-2">
        {actions.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-[10px] text-muted">{a.actionId} · {a.priority} · {a.status}{a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ""}</p>
            </div>
            {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1 text-xs hover:text-accent"
                onClick={async () => {
                  await fetch(`/api/actions/${a.id}/complete`, { method: "POST", credentials: "include" });
                  load();
                }}
              >
                Mark Complete
              </button>
            )}
          </div>
        ))}
        {actions.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No corrective actions yet.</p>
        )}
      </div>
    </AdminShell>
  );
}
