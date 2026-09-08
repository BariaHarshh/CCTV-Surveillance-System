"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";

export function EmergencyDetailClient({ user, emergencyId }: { user: SafeUser; emergencyId: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/emergencies/${emergencyId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [emergencyId]);

  useEffect(() => { load(); }, [load]);
  useMonitoringSocket({
    onEmergencyUpdated: () => load(),
    onTaskCreated: () => load(),
    onTaskUpdated: () => load(),
    onEscalationTriggered: () => load(),
  });

  const emergency = data?.emergency as Record<string, unknown> | undefined;
  const playbook = data?.playbook as Record<string, unknown> | undefined;
  const tasks = (data?.tasks as Record<string, unknown>[]) ?? [];
  const escalations = (data?.escalations as Record<string, unknown>[]) ?? [];
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch(`/api/emergencies/${emergencyId}/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []));
  }, [emergencyId, data]);

  async function setStatus(status: string) {
    await fetch(`/api/emergencies/${emergencyId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function sendMsg() {
    if (!message.trim()) return;
    await fetch(`/api/emergencies/${emergencyId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setMessage("");
    load();
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    await fetch(`/api/emergencies/${emergencyId}/tasks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: taskTitle }),
    });
    setTaskTitle("");
    load();
  }

  async function updateTask(taskId: string, status: string) {
    await fetch(`/api/emergencies/${emergencyId}/tasks/${taskId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function ackEscalation(escalationId: string) {
    await fetch("/api/escalations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escalationId, action: "acknowledge" }),
    });
    load();
  }

  if (loading) {
    return (
      <AdminShell user={user}>
        <div className="h-64 animate-pulse rounded-2xl bg-glass" />
      </AdminShell>
    );
  }

  if (!emergency) {
    return (
      <AdminShell user={user}>
        <p className="text-red-400">Emergency not found.</p>
      </AdminShell>
    );
  }

  const timeline = (emergency.timeline as Array<Record<string, string>>) ?? [];
  const steps = ((playbook?.steps as Array<{ order: number; title: string }>) ?? []);

  return (
    <AdminShell user={user}>
      <Link href="/admin/command-center" className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Command Center
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted">{String(emergency.emergencyId)}{emergency.source === "TEST" ? " · SIMULATED" : ""}</p>
          <h1 className="text-2xl font-bold text-red-300">{String(emergency.type).replace(/_/g, " ")}</h1>
          <p className="mt-1 text-sm text-muted">{String(emergency.reason)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/emergencies/${emergencyId}/report`} className="rounded-lg border border-border px-3 py-1.5 text-xs">Report</Link>
          <Link href={`/admin/emergencies/${emergencyId}/communications`} className="rounded-lg border border-border px-3 py-1.5 text-xs">Communications</Link>
          {emergency.status === "ACTIVE" && (
            <button type="button" onClick={() => setStatus("CONTAINED")} className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs text-amber-300">Mark Contained</button>
          )}
          {!["RESOLVED", "CANCELLED"].includes(String(emergency.status)) && (
            <>
              <button type="button" onClick={() => setStatus("RESOLVED")} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300">Resolve</button>
              <button type="button" onClick={() => setStatus("CANCELLED")} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-muted">Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Status", value: String(emergency.status) },
          { label: "Mode", value: String(emergency.mode) },
          { label: "Severity", value: String(emergency.severity) },
          { label: "Location", value: String((emergency.location as { label?: string })?.label ?? "—") },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border p-4">
            <p className="text-[10px] uppercase text-muted">{s.label}</p>
            <p className="mt-1 font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {playbook && (
            <section className="rounded-2xl border border-border p-5">
              <h2 className="text-sm font-semibold">Recommended Response Plan</h2>
              <p className="mt-1 text-xs text-muted">{String(playbook.name)} — organization-approved playbook</p>
              <ol className="mt-4 space-y-2">
                {steps.map((s) => (
                  <li key={s.order} className="flex gap-3 text-sm">
                    <span className="font-mono text-xs text-accent">{s.order}</span>
                    <span>{s.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Tasks</h2>
            <div className="mt-3 flex gap-2">
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="New task…" className="flex-1 rounded-lg border border-border bg-black/20 px-3 py-2 text-xs" />
              <button type="button" onClick={addTask} className="rounded-lg bg-accent/20 px-3 py-2 text-xs text-accent">Add</button>
            </div>
            <ul className="mt-3 space-y-2">
              {tasks.map((t) => (
                <li key={String(t.id)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <p>{String(t.title)}</p>
                    <p className="text-[10px] text-muted">{String(t.status)}</p>
                  </div>
                  {t.status === "PENDING" && (
                    <button type="button" onClick={() => updateTask(String(t.id), "IN_PROGRESS")} className="text-[10px] text-amber-300">Start</button>
                  )}
                  {t.status === "IN_PROGRESS" && (
                    <button type="button" onClick={() => updateTask(String(t.id), "COMPLETED")} className="text-[10px] text-emerald-300">Complete</button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Communications</h2>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {messages.map((m) => (
                <li key={String(m.id)} className="rounded-lg bg-black/20 px-3 py-2 text-xs">
                  <p className="font-semibold">{String(m.senderName)}</p>
                  <p className="text-muted">{String(m.message)}</p>
                  <p className="mt-1 text-[10px] text-muted">{new Date(String(m.createdAt)).toLocaleString()}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Internal response message…" className="flex-1 rounded-lg border border-border bg-black/20 px-3 py-2 text-xs" />
              <button type="button" onClick={sendMsg} className="rounded-lg bg-accent/20 px-3 py-2 text-xs text-accent">Send</button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <ul className="mt-3 space-y-3">
              {timeline.map((t, i) => (
                <li key={i} className="border-l border-border pl-3 text-xs">
                  <p className="text-muted">{new Date(t.timestamp).toLocaleString()}</p>
                  <p className="font-medium">{t.action.replace(/_/g, " ")}</p>
                  <p className="text-muted">{t.description}</p>
                  <p className="text-[10px] text-muted">{t.actorName}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="text-sm font-semibold">Escalation</h2>
            {escalations.length === 0 ? (
              <p className="mt-2 text-xs text-muted">No active escalation</p>
            ) : escalations.map((e) => (
              <div key={String(e.id)} className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
                <p className="font-semibold text-amber-300">{String(e.currentLevel)}</p>
                <p className="text-muted">{String(e.status)}</p>
                {e.status === "ACTIVE" && Boolean(e.nextEscalationAt) && (
                  <p className="mt-1">Escalation in: {new Date(String(e.nextEscalationAt)).toLocaleTimeString()} (server)</p>
                )}
                {e.status === "ACKNOWLEDGED" ? <p className="text-emerald-300">Escalation Paused</p> : null}
                <p className="text-[10px] text-muted">Delivery: {String(e.deliveryStatus)}</p>
                {e.status === "ACTIVE" ? (
                  <button type="button" onClick={() => ackEscalation(String(e.id))} className="mt-2 text-accent hover:underline">Acknowledge</button>
                ) : null}
              </div>
            ))}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
