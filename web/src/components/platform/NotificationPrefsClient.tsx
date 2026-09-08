"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

const DEFAULT_CHANNELS = { inApp: true, email: true, push: false, sms: false };
const CATEGORIES = ["alerts", "incidents", "emergencies", "reports", "system"] as const;

type Prefs = {
  channels: typeof DEFAULT_CHANNELS;
  categories: Record<string, typeof DEFAULT_CHANNELS>;
};

export function NotificationPrefsClient({ user }: { user: SafeUser }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/settings/notifications/preferences", { credentials: "include" });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Failed to load preferences.");
      setLoading(false);
      return;
    }
    setPrefs(j.preferences ?? { channels: DEFAULT_CHANNELS, categories: {} });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setMsg("");
    setError("");
    const res = await fetch("/api/settings/notifications/preferences", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(j.error ?? "Failed to save.");
      return;
    }
    setPrefs(j.preferences);
    setMsg("Preferences saved.");
  }

  function toggleChannel(scope: "channels" | "categories", key: string, channel: keyof typeof DEFAULT_CHANNELS) {
    if (!prefs) return;
    if (scope === "channels") {
      setPrefs({ ...prefs, channels: { ...prefs.channels, [channel]: !prefs.channels[channel] } });
      return;
    }
    const cat = prefs.categories[key] ?? { ...DEFAULT_CHANNELS };
    setPrefs({
      ...prefs,
      categories: { ...prefs.categories, [key]: { ...cat, [channel]: !cat[channel] } },
    });
  }

  if (loading || !prefs) {
    return (
      <AdminShell user={user}>
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Notification Preferences</h1>
      <p className="mt-1 text-sm text-muted">Choose how you receive alerts and updates</p>

      <section className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold">Global channels</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {(Object.keys(DEFAULT_CHANNELS) as Array<keyof typeof DEFAULT_CHANNELS>).map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="checkbox"
                checked={prefs.channels[ch]}
                onChange={() => toggleChannel("channels", "", ch)}
              />
              {ch}
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold">By category</h2>
        <div className="mt-4 space-y-4">
          {CATEGORIES.map((cat) => {
            const c = prefs.categories[cat] ?? DEFAULT_CHANNELS;
            return (
              <div key={cat} className="rounded-xl border border-border p-4">
                <p className="font-medium capitalize">{cat}</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {(Object.keys(DEFAULT_CHANNELS) as Array<keyof typeof DEFAULT_CHANNELS>).map((ch) => (
                    <label key={ch} className="flex items-center gap-2 text-xs capitalize text-muted">
                      <input
                        type="checkbox"
                        checked={c[ch]}
                        onChange={() => toggleChannel("categories", cat, ch)}
                      />
                      {ch}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </AdminShell>
  );
}
