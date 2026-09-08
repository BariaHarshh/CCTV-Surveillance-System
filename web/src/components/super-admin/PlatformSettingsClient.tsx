"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Moon,
  Save,
  Shield,
  Sun,
  AlertTriangle,
} from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import type { PlatformSettingsPublic } from "@/lib/platform/platform-settings-service";
import { cn } from "@/lib/utils";

type RuntimeStatus = {
  nodeEnv: string;
  appUrl: string | null;
  aiProvider: string;
  emailProvider: string;
  pushProvider: string;
  paymentProvider: string;
  mongodbConfigured: boolean;
  cameraEncryptionConfigured: boolean;
  webhookSecretConfigured: boolean;
  internalEventsKeyConfigured: boolean;
};

const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border bg-glass px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-border-strong"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </label>
  );
}

export function PlatformSettingsClient({ user }: { user: SafeUser }) {
  const [settings, setSettings] = useState<PlatformSettingsPublic | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/settings", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load settings");
      setSettings(json.settings);
      setRuntime(json.runtime);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSettings(json.settings);
      setRuntime(json.runtime);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof PlatformSettingsPublic>(key: K, value: PlatformSettingsPublic[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <SuperAdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Global configuration for AI Campus Guardian. Changes apply platform-wide and are audited.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted sm:flex">
            <Sun className="h-3.5 w-3.5 text-accent" />
            <span>Your view</span>
            <ThemeToggle size="sm" />
            <Moon className="h-3.5 w-3.5 text-muted" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading" />
        </div>
      )}

      {error && !loading && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <button type="button" onClick={load} className="mt-2 text-accent hover:underline">
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && settings && (
        <form onSubmit={onSubmit} className="mt-8 space-y-8">
          <section className="rounded-2xl border border-border bg-surface/60 p-5 shadow-[var(--shadow-panel)] backdrop-blur-sm sm:p-6">
            <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">General</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted">Platform name</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.platformName}
                  onChange={(e) => patch("platformName", e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Default timezone</span>
                <select
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.defaultTimezone}
                  onChange={(e) => patch("defaultTimezone", e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-muted">Support email</span>
                <input
                  type="email"
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.supportEmail}
                  onChange={(e) => patch("supportEmail", e.target.value)}
                  placeholder="support@example.com"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Support URL</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.supportUrl}
                  onChange={(e) => patch("supportUrl", e.target.value)}
                  placeholder="https://"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-muted">Default theme for new sessions</span>
                <select
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40 sm:max-w-xs"
                  value={settings.defaultTheme}
                  onChange={(e) =>
                    patch("defaultTheme", e.target.value as PlatformSettingsPublic["defaultTheme"])
                  }
                >
                  <option value="night">Night</option>
                  <option value="day">Day</option>
                  <option value="system">Follow system</option>
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-muted">Public status message (optional)</span>
                <textarea
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.statusPageMessage}
                  onChange={(e) => patch("statusPageMessage", e.target.value)}
                  placeholder="Shown on status surfaces when set"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5 shadow-[var(--shadow-panel)] backdrop-blur-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                Security & sessions
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              <Toggle
                checked={settings.requireMfaForAdmins}
                onChange={(v) => patch("requireMfaForAdmins", v)}
                label="Require MFA for organization admins"
                description="Org admins should enable MFA when this policy is on."
              />
              <Toggle
                checked={settings.requireMfaForStaff}
                onChange={(v) => patch("requireMfaForStaff", v)}
                label="Require MFA for staff"
                description="Field and operations staff MFA expectation."
              />
              <Toggle
                checked={settings.allowOrganizationSelfService}
                onChange={(v) => patch("allowOrganizationSelfService", v)}
                label="Allow organization self-service"
                description="When off, only Super Admins create organizations."
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="text-muted">Session idle (minutes)</span>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.sessionIdleMinutes}
                  onChange={(e) => patch("sessionIdleMinutes", Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Absolute session (hours)</span>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.sessionAbsoluteHours}
                  onChange={(e) => patch("sessionAbsoluteHours", Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Max concurrent sessions</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.maxConcurrentSessions}
                  onChange={(e) => patch("maxConcurrentSessions", Number(e.target.value))}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5 shadow-[var(--shadow-panel)] backdrop-blur-sm sm:p-6">
            <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
              Retention & capabilities
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted">Default audit retention (days)</span>
                <input
                  type="number"
                  min={30}
                  max={3650}
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.defaultAuditRetentionDays}
                  onChange={(e) => patch("defaultAuditRetentionDays", Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Default evidence retention (days)</span>
                <input
                  type="number"
                  min={7}
                  max={3650}
                  className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                  value={settings.defaultEvidenceRetentionDays}
                  onChange={(e) => patch("defaultEvidenceRetentionDays", Number(e.target.value))}
                />
              </label>
            </div>
            <div className="mt-4 space-y-3">
              <Toggle
                checked={settings.allowAiFeatures}
                onChange={(v) => patch("allowAiFeatures", v)}
                label="Allow AI features"
                description="Master switch for copilot / agent surfaces."
              />
              <Toggle
                checked={settings.allowVideoAi}
                onChange={(v) => patch("allowVideoAi", v)}
                label="Allow video AI"
                description="Detection and video intelligence modules."
              />
              <Toggle
                checked={settings.allowAdvancedAnalytics}
                onChange={(v) => patch("allowAdvancedAnalytics", v)}
                label="Allow advanced analytics"
                description="Executive BI and forecasting modules."
              />
            </div>
            <p className="mt-4 text-xs text-muted">
              Fine-grained flags also live under{" "}
              <Link href="/super-admin/feature-flags" className="text-accent hover:underline">
                Feature Flags
              </Link>{" "}
              and{" "}
              <Link href="/super-admin/maintenance" className="text-accent hover:underline">
                Maintenance
              </Link>
              .
            </p>
          </section>

          {runtime && (
            <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
              <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                Runtime environment
              </h2>
              <p className="mt-1 text-xs text-muted">
                Read-only — configured via deployment secrets, not editable here.
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Environment", runtime.nodeEnv],
                  ["App URL", runtime.appUrl || "—"],
                  ["AI provider", runtime.aiProvider],
                  ["Email provider", runtime.emailProvider],
                  ["Push provider", runtime.pushProvider],
                  ["Payment provider", runtime.paymentProvider],
                  ["MongoDB", runtime.mongodbConfigured ? "Configured" : "Missing"],
                  ["Camera encryption", runtime.cameraEncryptionConfigured ? "Configured" : "Missing"],
                  ["Webhook secret", runtime.webhookSecretConfigured ? "Configured" : "Missing"],
                  ["Internal events key", runtime.internalEventsKeyConfigured ? "Configured" : "Missing"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border bg-glass px-3 py-2.5">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">{k}</dt>
                    <dd className="mt-0.5 font-mono text-sm text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dim disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save platform settings
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </span>
            )}
            {settings.updatedAt && (
              <span className="text-xs text-muted">
                Last updated {new Date(settings.updatedAt).toLocaleString()}
                {settings.updatedBy ? ` by ${settings.updatedBy}` : ""}
              </span>
            )}
          </div>
        </form>
      )}
    </SuperAdminShell>
  );
}
