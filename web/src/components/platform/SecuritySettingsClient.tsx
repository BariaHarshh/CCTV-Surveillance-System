"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Policy = {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
    expiryDays: number | null;
    historyCount: number;
  };
  sessionPolicy: {
    idleMinutes: number;
    absoluteHours: number;
    maxConcurrent: number;
  };
};

export function SecuritySettingsClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/security", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setData(j));
  }, []);

  async function save() {
    if (!data) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/settings/security", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const j = await res.json();
    setSaving(false);
    if (res.ok) {
      setData(j);
      setMessage("Security policy saved.");
    } else {
      setMessage(j.error ?? "Failed to save.");
    }
  }

  if (!data) {
    return (
      <AdminShell user={user}>
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      </AdminShell>
    );
  }

  const pp = data.passwordPolicy;
  const sp = data.sessionPolicy;

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Security settings</h1>
      <p className="mt-1 text-muted">Password policy, sessions, and MFA</p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Password policy</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted">Minimum length</span>
              <input
                type="number"
                min={8}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                value={pp.minLength}
                onChange={(e) =>
                  setData({
                    ...data,
                    passwordPolicy: { ...pp, minLength: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">History count</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                value={pp.historyCount}
                onChange={(e) =>
                  setData({
                    ...data,
                    passwordPolicy: { ...pp, historyCount: Number(e.target.value) },
                  })
                }
              />
            </label>
            {(
              [
                ["requireUppercase", "Require uppercase"],
                ["requireLowercase", "Require lowercase"],
                ["requireNumber", "Require number"],
                ["requireSpecial", "Require special character"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pp[key]}
                  onChange={(e) =>
                    setData({
                      ...data,
                      passwordPolicy: { ...pp, [key]: e.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Session policy</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(
              [
                ["idleMinutes", "Idle timeout (min)"],
                ["absoluteHours", "Absolute timeout (hrs)"],
                ["maxConcurrent", "Max concurrent"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-muted">{label}</span>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  value={sp[key]}
                  onChange={(e) =>
                    setData({
                      ...data,
                      sessionPolicy: { ...sp, [key]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Multi-factor authentication</h2>
          <p className="mt-1 text-sm text-muted">Manage your personal MFA enrollment.</p>
          <Link
            href="/settings/security/mfa"
            className="mt-4 inline-flex rounded-xl border border-border px-4 py-2 text-sm hover:border-accent/40"
          >
            Open MFA settings
          </Link>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save policy"}
          </button>
          {message && <span className="text-sm text-muted">{message}</span>}
        </div>
      </div>
    </AdminShell>
  );
}
