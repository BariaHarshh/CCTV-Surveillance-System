"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function IncidentTasksClient({ user, incidentId }: { user: SafeUser; incidentId: string }) {
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [title, setTitle] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/incidents/${incidentId}/tasks`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []));
  }, [incidentId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!title.trim()) return;
    await fetch(`/api/admin/incidents/${incidentId}/tasks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setTitle("");
    load();
  }

  return (
    <AdminShell user={user}>
      <Link href={`/admin/incidents/${incidentId}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Back to incident
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Incident Tasks</h1>
      <div className="mt-6 flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="flex-1 rounded-lg border border-border bg-black/20 px-3 py-2 text-sm" />
        <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">Add</button>
      </div>
      <ul className="mt-4 space-y-2">
        {tasks.map((t) => (
          <li key={String(t.id)} className="rounded-xl border border-border px-4 py-3 text-sm">
            <p className="font-medium">{String(t.title)}</p>
            <p className="text-xs text-muted">{String(t.status)} · {String(t.taskId)}</p>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
