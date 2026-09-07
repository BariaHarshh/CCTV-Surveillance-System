"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function EscalationSettingsClient({ user }: { user: SafeUser }) {
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(() => {
    fetch("/api/escalation-rules", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRules(d.rules ?? []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/escalation-rules/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    load();
  }

  async function updateTimeout(id: string, timeoutMinutes: number) {
    await fetch(`/api/escalation-rules/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeoutMinutes }),
    });
    load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Escalation Rules</h1>
      <p className="mt-1 text-muted">Configure severity-based escalation levels and timeouts. Timers are server-authoritative.</p>

      <div className="mt-8 space-y-4">
        {rules.map((r) => (
          <div key={String(r.id)} className="rounded-2xl border border-border bg-surface/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{String(r.name)}</h3>
                <p className="text-xs text-muted">Severity: {String(r.severity)} · Timeout: {String(r.timeoutMinutes)} min</p>
              </div>
              <button type="button" onClick={() => toggle(String(r.id), Boolean(r.enabled))} className="text-xs text-accent">
                {r.enabled ? "Disable" : "Enable"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {((r.levels as Array<{ level: string; roleLabel: string; timeoutMinutes: number }>) ?? []).map((l) => (
                <span key={l.level} className="rounded-lg border border-border px-3 py-1.5 text-xs">
                  {l.level.replace(/_/g, " ")} → {l.roleLabel} ({l.timeoutMinutes}m)
                </span>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-[10px] text-muted">Base timeout (minutes)</label>
              <input
                type="number"
                min={1}
                max={240}
                defaultValue={Number(r.timeoutMinutes)}
                onBlur={(e) => updateTimeout(String(r.id), parseInt(e.target.value, 10) || 10)}
                className="ml-2 w-20 rounded border border-border bg-black/20 px-2 py-1 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
