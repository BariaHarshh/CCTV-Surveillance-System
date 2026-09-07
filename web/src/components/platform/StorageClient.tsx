"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Usage = { used: number; max: number };

export function StorageClient({ user }: { user: SafeUser }) {
  const [usage, setUsage] = useState<Record<string, Usage>>({});
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [billing, retention] = await Promise.all([
      fetch("/api/billing/overview", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/settings/retention", { credentials: "include" }).then((r) => r.json()),
    ]);
    if (!billing.overview) {
      setError(billing.error ?? "Failed to load storage usage.");
      setLoading(false);
      return;
    }
    setUsage(billing.overview.usage ?? {});
    setPlan(String(billing.overview.subscription?.planId ?? ""));
    setLoading(false);
    void retention;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const storage = usage.storageMb;
  const pct = storage && storage.max > 0 ? Math.min(100, Math.round((storage.used / storage.max) * 100)) : 0;

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Storage</h1>
      <p className="mt-1 text-sm text-muted">Usage metering and data retention policy</p>

      {loading ? (
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      ) : error ? (
        <p className="mt-8 text-sm text-red-400">{error}</p>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Storage usage</h2>
              <span className="text-xs text-muted">Plan: {plan}</span>
            </div>
            {storage ? (
              <>
                <p className="mt-3 text-2xl font-bold">
                  {storage.used} / {storage.max} MB
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">{pct}% of plan storage used</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">Storage metrics unavailable.</p>
            )}
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(usage)
              .filter(([k]) => k !== "storageMb")
              .map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border p-4">
                  <p className="text-[10px] uppercase text-muted">{k}</p>
                  <p className="mt-1 text-lg font-bold">
                    {v.used} / {v.max}
                  </p>
                </div>
              ))}
          </section>

          <p className="mt-6 text-sm">
            <Link href="/admin/settings/data-retention" className="text-accent hover:underline">
              Configure data retention policy →
            </Link>
          </p>
        </>
      )}
    </AdminShell>
  );
}
