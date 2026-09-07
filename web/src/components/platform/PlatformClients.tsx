"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function SettingsHubClient({ user }: { user: SafeUser }) {
  const sections = [
    ["General / Organization", "/admin/settings/organization"],
    ["Security", "/admin/settings/security"],
    ["MFA", "/settings/security/mfa"],
    ["Notifications", "/admin/settings/notifications"],
    ["AI", "/admin/settings/ai"],
    ["Emergency Escalation", "/admin/settings/escalation"],
    ["Data Retention", "/admin/settings/data-retention"],
    ["API Keys", "/admin/settings/api"],
    ["Integrations", "/admin/integrations"],
    ["Webhooks", "/admin/settings/integrations/webhooks"],
    ["Permissions", "/admin/settings/permissions"],
    ["Billing", "/admin/billing"],
    ["Audit Logs", "/admin/audit"],
  ] as const;

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">Organization configuration — only sections you can access are listed.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(([label, href]) => (
          <Link key={href} href={href} className="rounded-xl border border-border bg-surface/40 p-4 hover:border-accent/30">
            <p className="font-medium">{label}</p>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}

export function BillingClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ov, pl] = await Promise.all([
      fetch("/api/billing/overview", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/billing/plans", { credentials: "include" }).then((r) => r.json()),
    ]);
    setData(ov.overview ?? null);
    setPlans(pl.plans ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upgrade(planId: string) {
    setMsg(null);
    const res = await fetch("/api/billing/upgrade", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? "Upgrade failed");
      return;
    }
    setMsg(`Plan updated to ${planId}`);
    load();
  }

  const usage = (data?.usage as Record<string, { used: number; max: number }>) ?? {};
  const sub = data?.subscription as Record<string, string> | undefined;

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-sm text-muted">Plans, usage metering, and invoices. Pricing is not hardcoded into feature logic.</p>
      {!data ? (
        <div className="mt-8 h-32 animate-pulse rounded-xl bg-glass" />
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-5">
            <h2 className="text-sm font-semibold">Current Plan</h2>
            <p className="mt-2 text-2xl font-bold">{String(sub?.planId)} <span className="text-sm text-muted">({String(sub?.status)})</span></p>
            {sub?.trialEndsAt && <p className="mt-1 text-xs text-muted">Trial ends {new Date(sub.trialEndsAt).toLocaleString()}</p>}
            <p className="mt-1 text-xs text-muted">Period ends {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}</p>
          </section>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(usage).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border p-4">
                <p className="text-[10px] uppercase text-muted">{k}</p>
                <p className="mt-1 text-lg font-bold">{v.used} / {v.max}</p>
              </div>
            ))}
          </section>
          <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-5">
            <h2 className="text-sm font-semibold">Available Plans</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {plans.map((p) => (
                <div key={String(p.planId)} className="rounded-xl border border-border p-4">
                  <p className="font-semibold">{String(p.name)}</p>
                  <p className="text-xs text-muted">{String(p.description)}</p>
                  <p className="mt-2 text-lg">{String(p.price)} {String(p.currency)}/{String(p.billingInterval)}</p>
                  <button type="button" onClick={() => upgrade(String(p.planId))} className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black">
                    Select
                  </button>
                </div>
              ))}
            </div>
            {msg && <p className="mt-3 text-xs text-muted">{msg}</p>}
          </section>
          <p className="mt-4 text-xs"><Link href="/admin/billing/invoices" className="text-accent">Invoice history →</Link></p>
        </>
      )}
    </AdminShell>
  );
}

export function OrganizationSettingsClient({ user }: { user: SafeUser }) {
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    website: "",
    email: "",
    phone: "",
    country: "",
    state: "",
    city: "",
    address: "",
    timezone: "UTC",
    language: "en",
    currency: "USD",
    primaryColor: "#38bdf8",
    secondaryColor: "#0f172a",
  });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/organization", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const b = j.organization?.basicInformation ?? {};
        const l = j.organization?.location ?? {};
        const p = j.profile ?? {};
        setForm({
          name: b.name ?? "",
          legalName: b.legalName ?? "",
          website: b.website ?? "",
          email: b.email ?? "",
          phone: b.phone ?? "",
          country: l.country ?? "",
          state: l.state ?? "",
          city: l.city ?? "",
          address: l.address ?? "",
          timezone: p.timezone ?? "UTC",
          language: p.language ?? "en",
          currency: p.currency ?? "USD",
          primaryColor: p.branding?.primaryColor ?? "#38bdf8",
          secondaryColor: p.branding?.secondaryColor ?? "#0f172a",
        });
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/organization", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basicInformation: {
          name: form.name,
          legalName: form.legalName,
          website: form.website,
          email: form.email,
          phone: form.phone,
        },
        location: {
          country: form.country,
          state: form.state,
          city: form.city,
          address: form.address,
        },
        timezone: form.timezone,
        language: form.language,
        currency: form.currency,
        branding: { primaryColor: form.primaryColor, secondaryColor: form.secondaryColor },
      }),
    });
    setMsg(res.ok ? "Saved." : "Save failed.");
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Organization Settings</h1>
      <form onSubmit={save} className="mt-6 grid max-w-2xl gap-3">
        {Object.entries(form).map(([k, v]) => (
          <label key={k} className="text-xs">
            <span className="text-muted capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
            <input
              value={v}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm"
            />
          </label>
        ))}
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black">Save</button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
        </div>
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </form>
    </AdminShell>
  );
}

export function MfaClient({ user }: { user: SafeUser }) {
  const [status, setStatus] = useState<{ enabled: boolean } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await fetch("/api/settings/mfa", { credentials: "include" }).then((r) => r.json());
    setStatus(j.mfa ?? { enabled: false });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function begin() {
    const j = await fetch("/api/settings/mfa", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "begin" }),
    }).then((r) => r.json());
    setSecret(j.enrollment?.secret ?? null);
    setOtpauth(j.enrollment?.otpauth ?? null);
    setRecovery(null);
  }

  async function verify() {
    const res = await fetch("/api/settings/mfa", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", code }),
    });
    const j = await res.json();
    if (!res.ok) {
      setMsg(j.error ?? "Verification failed");
      return;
    }
    setRecovery(j.recoveryCodes ?? []);
    setMsg("MFA enabled. Store recovery codes now — they will not be shown again.");
    load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Multi-Factor Authentication</h1>
      <p className="mt-1 text-sm text-muted">TOTP + recovery codes. Prefer stronger methods over SMS.</p>
      <p className="mt-4 text-sm">Status: <strong>{status?.enabled ? "Enabled" : "Disabled"}</strong></p>
      {!status?.enabled && (
        <div className="mt-4 space-y-3">
          <button type="button" onClick={begin} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black">Enable MFA</button>
          {secret && (
            <div className="rounded-xl border border-border p-4 text-xs">
              <p>Scan with authenticator app (otpauth):</p>
              <p className="mt-2 break-all font-mono text-[10px]">{otpauth}</p>
              <p className="mt-2">Secret: <span className="font-mono">{secret}</span></p>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code" className="mt-3 w-full rounded-lg border border-border bg-black/30 px-3 py-2" />
              <button type="button" onClick={verify} className="mt-2 rounded-lg border border-border px-3 py-1.5">Verify</button>
            </div>
          )}
        </div>
      )}
      {recovery && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
          <p className="font-semibold">Recovery codes (shown once)</p>
          <ul className="mt-2 font-mono">{recovery.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {status?.enabled && (
        <button
          type="button"
          className="mt-4 rounded-lg border border-border px-3 py-1.5 text-xs"
          onClick={async () => {
            await fetch("/api/settings/mfa", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disable" }) });
            load();
          }}
        >
          Disable MFA
        </button>
      )}
      {msg && <p className="mt-3 text-xs text-muted">{msg}</p>}
    </AdminShell>
  );
}

export function OnboardingClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<{ completed: number; total: number; steps: Record<string, boolean>; stepOrder: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/onboarding", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setData(j.onboarding));
  }, []);

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Onboarding</h1>
      {!data ? (
        <div className="mt-8 h-24 animate-pulse rounded-xl bg-glass" />
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">{data.completed} / {data.total} completed</p>
          <ul className="mt-6 space-y-2 text-sm">
            {data.stepOrder.map((s) => (
              <li key={s} className="flex items-center gap-2 rounded-lg border border-white/5 px-3 py-2">
                <span>{data.steps[s] ? "✓" : "○"}</span>
                <span className="capitalize">{s.replace(/([A-Z])/g, " $1")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const commands = [
    { label: "Go to Dashboard", href: "/admin/dashboard" },
    { label: "Command Center", href: "/admin/command-center" },
    { label: "Alerts", href: "/admin/alerts" },
    { label: "Incidents", href: "/admin/incidents" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Reports", href: "/admin/reports" },
    { label: "Settings", href: "/admin/settings" },
    { label: "Billing", href: "/admin/billing" },
    { label: "Search", href: "/search" },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-3" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command…"
          className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm"
        />
        <ul className="mt-2 max-h-64 overflow-y-auto text-sm">
          {filtered.map((c) => (
            <li key={c.href}>
              <Link href={c.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-glass">
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
