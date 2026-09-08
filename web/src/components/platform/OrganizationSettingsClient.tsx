"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type OrgData = {
  organization: {
    basicInformation?: Record<string, string>;
    location?: Record<string, string>;
  } | null;
  profile: {
    timezone: string;
    language: string;
    currency: string;
    dateFormat: string;
    branding: Record<string, string>;
  };
};

export function OrganizationSettingsClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<OrgData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    timezone: "UTC",
    language: "en",
    currency: "USD",
    primaryColor: "#38bdf8",
  });

  useEffect(() => {
    fetch("/api/settings/organization", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        setData(j);
        const basic = j.organization?.basicInformation ?? {};
        setForm({
          name: basic.name ?? "",
          email: basic.email ?? "",
          phone: basic.phone ?? "",
          website: basic.website ?? "",
          timezone: j.profile?.timezone ?? "UTC",
          language: j.profile?.language ?? "en",
          currency: j.profile?.currency ?? "USD",
          primaryColor: j.profile?.branding?.primaryColor ?? "#38bdf8",
        });
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/settings/organization", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basicInformation: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          website: form.website,
        },
        timezone: form.timezone,
        language: form.language,
        currency: form.currency,
        branding: { primaryColor: form.primaryColor },
      }),
    });
    const j = await res.json();
    setSaving(false);
    setMessage(res.ok ? "Saved." : j.error ?? "Failed to save.");
    if (res.ok) setData((d) => (d ? { ...d, ...j } : j));
  }

  if (!data) {
    return (
      <AdminShell user={user}>
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Organization settings</h1>
      <p className="mt-1 text-muted">Profile, locale, and branding</p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Basic information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["name", "Name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["website", "Website"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-muted">{label}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/50 p-6">
          <h2 className="font-semibold">Locale & branding</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted">Timezone</span>
              <input
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Language</span>
              <input
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Currency</span>
              <input
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Primary color</span>
              <input
                type="color"
                className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              />
            </label>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {message && <span className="text-sm text-muted">{message}</span>}
        </div>
      </div>
    </AdminShell>
  );
}
