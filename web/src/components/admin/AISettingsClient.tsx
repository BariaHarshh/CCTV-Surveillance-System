"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function AISettingsClient({ user, variant }: { user: SafeUser; variant: "ai" | "retention" | "notifications" }) {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/ai/config", { credentials: "include" }).then((r) => r.json()).then((d) => setSettings(d.settings ?? {}));
  }, []);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/ai", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setMsg(res.ok ? "Saved." : "Failed to save.");
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings ?? settings);
    }
  }

  const titles = { ai: "Organization AI Settings", retention: "Data Retention", notifications: "Notification Rules" };

  return (
    <AdminShell user={user}>
      <Link href="/admin/ai" className="text-xs text-accent hover:underline">← AI Intelligence</Link>
      <h1 className="mt-2 text-2xl font-bold">{titles[variant]}</h1>

      {variant === "ai" && (
        <div className="mt-6 max-w-lg space-y-4">
          <label className="block text-sm">
            <span className="text-muted">Default confidence threshold</span>
            <input type="number" step="0.05" min="0" max="1" defaultValue={Number(settings.defaultConfidenceThreshold ?? 0.7)}
              onBlur={(e) => save({ defaultConfidenceThreshold: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-glass px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Event cooldown (seconds)</span>
            <input type="number" min="0" defaultValue={Number(settings.eventCooldownSeconds ?? 30)}
              onBlur={(e) => save({ eventCooldownSeconds: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-glass px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Abandoned object threshold (seconds)</span>
            <input type="number" min="0" defaultValue={Number(settings.abandonedObjectThresholdSeconds ?? 120)}
              onBlur={(e) => save({ abandonedObjectThresholdSeconds: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-glass px-3 py-2" />
          </label>
        </div>
      )}

      {variant === "retention" && (
        <div className="mt-6 max-w-lg space-y-4">
          {(["eventsDays", "snapshotsDays", "incidentsDays", "auditDays"] as const).map((key) => (
            <label key={key} className="block text-sm">
              <span className="text-muted">{key.replace("Days", " retention (days)")}</span>
              <input type="number" min="1" defaultValue={Number((settings.dataRetention as Record<string, number>)?.[key] ?? 90)}
                onBlur={(e) => save({ dataRetention: { ...(settings.dataRetention as object), [key]: Number(e.target.value) } })}
                className="mt-1 w-full rounded-lg border border-border bg-glass px-3 py-2" />
            </label>
          ))}
          <p className="text-xs text-muted">Audit records are never auto-deleted without explicit policy.</p>
        </div>
      )}

      {variant === "notifications" && (
        <div className="mt-6 max-w-lg space-y-3 text-sm">
          {[
            { severity: "Critical Alert", rule: "Immediate" },
            { severity: "High Alert", rule: "Immediate" },
            { severity: "Medium Alert", rule: "Dashboard" },
            { severity: "Low Event", rule: "Event Timeline" },
          ].map((r) => (
            <div key={r.severity} className="flex justify-between rounded-lg border border-border px-4 py-3">
              <span>{r.severity}</span>
              <span className="text-muted">{r.rule}</span>
            </div>
          ))}
          <p className="text-xs text-muted">Email, SMS, and webhook channels can be added in a future release.</p>
        </div>
      )}

      {msg && <p className="mt-4 text-sm text-accent">{msg}</p>}
      {saving && <p className="mt-4 text-sm text-muted">Saving...</p>}
    </AdminShell>
  );
}
