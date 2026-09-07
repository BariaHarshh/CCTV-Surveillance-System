"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

const FIELDS = [
  "eventsDays",
  "alertsDays",
  "incidentsDays",
  "emergenciesDays",
  "cameraMetadataDays",
  "aiResultsDays",
  "auditDays",
  "reportsDays",
] as const;

type Retention = Record<(typeof FIELDS)[number], number>;

export function StorageRetentionClient({ user }: { user: SafeUser }) {
  const [retention, setRetention] = useState<Retention | null>(null);
  const [usage, setUsage] = useState<{ used: number; max: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/retention", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/billing/overview", { credentials: "include" }).then((r) => r.json()),
    ]).then(([r, b]) => {
      setRetention(r.retention);
      setUsage(b.overview?.usage?.storageMb ?? null);
    });
  }, []);

  async function save() {
    if (!retention) return;
    setSaving(true);
    const res = await fetch("/api/settings/retention", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(retention),
    });
    const j = await res.json();
    setSaving(false);
    if (res.ok) {
      setRetention(j.retention);
      setMessage("Retention policy saved.");
    } else {
      setMessage(j.error ?? "Failed.");
    }
  }

  if (!retention) {
    return (
      <AdminShell user={user}>
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Storage & retention</h1>
      <p className="mt-1 text-muted">Data lifecycle and storage usage</p>
      {usage && (
        <div className="mt-6 rounded-2xl border border-border bg-surface/50 p-5">
          <div className="text-xs uppercase text-muted">Storage</div>
          <div className="mt-1 text-2xl font-semibold">
            {usage.used} <span className="text-sm font-normal text-muted">/ {usage.max} MB</span>
          </div>
        </div>
      )}
      <section className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface/50 p-6 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field} className="block text-sm">
            <span className="text-muted">{field}</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              value={retention[field]}
              onChange={(e) =>
                setRetention({ ...retention, [field]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </section>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save retention"}
      </button>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
    </AdminShell>
  );
}
