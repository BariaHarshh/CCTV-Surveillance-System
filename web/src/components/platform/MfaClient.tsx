"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function MfaClient({ user, bare }: { user: SafeUser; bare?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const res = await fetch("/api/settings/mfa", { credentials: "include" });
    const j = await res.json();
    setEnabled(Boolean(j.mfa?.enabled));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function begin() {
    setMessage("");
    const res = await fetch("/api/settings/mfa", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "begin" }),
    });
    const j = await res.json();
    if (!res.ok) {
      setMessage(j.error ?? "Failed to start enrollment.");
      return;
    }
    setSecret(j.enrollment.secret);
    setOtpauth(j.enrollment.otpauth);
  }

  async function verify() {
    setMessage("");
    const res = await fetch("/api/settings/mfa", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", code }),
    });
    const j = await res.json();
    if (!res.ok) {
      setMessage(j.error ?? "Invalid code.");
      return;
    }
    setRecoveryCodes(j.recoveryCodes ?? []);
    setEnabled(true);
    setSecret("");
    setOtpauth("");
    setMessage("MFA enabled. Store recovery codes securely.");
  }

  async function disable() {
    const res = await fetch("/api/settings/mfa", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable" }),
    });
    if (res.ok) {
      setEnabled(false);
      setRecoveryCodes([]);
      setMessage("MFA disabled.");
    }
  }

  async function regenerate() {
    const res = await fetch("/api/settings/mfa", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate" }),
    });
    const j = await res.json();
    if (res.ok) {
      setRecoveryCodes(j.recoveryCodes ?? []);
      setMessage("Recovery codes regenerated.");
    } else {
      setMessage(j.error ?? "Failed.");
    }
  }

  const body = loading ? (
    <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
  ) : (
    <>
      <h1 className="text-2xl font-bold">Multi-factor authentication</h1>
      <p className="mt-1 text-muted">
        Status: {enabled ? <span className="text-emerald-400">Enabled</span> : "Disabled"}
      </p>

      <div className="mt-8 space-y-6">
        {!enabled && (
          <section className="rounded-2xl border border-border bg-surface/50 p-6">
            <button
              type="button"
              onClick={begin}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black"
            >
              Begin enrollment
            </button>
            {secret && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted">Add this secret in your authenticator app:</p>
                <code className="block break-all rounded-xl border border-border bg-background p-3 font-mono text-accent">
                  {secret}
                </code>
                <a href={otpauth} className="text-accent underline">
                  Open otpauth link
                </a>
                <div className="flex gap-2 pt-2">
                  <input
                    className="rounded-xl border border-border bg-background px-3 py-2"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={verify}
                    className="rounded-xl border border-border px-4 py-2 hover:border-accent/40"
                  >
                    Verify & enable
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {enabled && (
          <section className="rounded-2xl border border-border bg-surface/50 p-6 space-y-3">
            <button
              type="button"
              onClick={regenerate}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:border-accent/40"
            >
              Regenerate recovery codes
            </button>
            <button
              type="button"
              onClick={disable}
              className="ml-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Disable MFA
            </button>
          </section>
        )}

        {recoveryCodes.length > 0 && (
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h2 className="font-semibold text-amber-200">Recovery codes (shown once)</h2>
            <ul className="mt-3 grid gap-1 font-mono text-sm sm:grid-cols-2">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        {message && <p className="text-sm text-muted">{message}</p>}
      </div>
    </>
  );

  if (bare) return <div className="mx-auto max-w-2xl p-6">{body}</div>;
  return <AdminShell user={user}>{body}</AdminShell>;
}
