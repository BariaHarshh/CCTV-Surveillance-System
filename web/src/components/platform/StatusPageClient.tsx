"use client";

import { useEffect, useState } from "react";

type Status = {
  live?: string;
  ready?: string;
  maintenance?: { enabled: boolean; message: string } | null;
  announcements?: Array<{ title: string; message: string; type: string }>;
};

export function StatusPageClient() {
  const [status, setStatus] = useState<Status>({});

  useEffect(() => {
    async function load() {
      const [live, ready] = await Promise.all([
        fetch("/api/health/live").then((r) => r.json()).catch(() => ({ status: "UNKNOWN" })),
        fetch("/api/health/ready").then((r) => r.json()).catch(() => ({ status: "UNAVAILABLE" })),
      ]);
      setStatus({
        live: live.status,
        ready: ready.status,
      });
    }
    load();
  }, []);

  const overall =
    status.live === "LIVE" && status.ready === "READY"
      ? "Operational"
      : status.ready === "UNAVAILABLE"
        ? "Degraded"
        : "Checking…";

  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm uppercase tracking-widest text-muted">AI Campus Guardian</p>
        <h1 className="mt-2 text-3xl font-bold">System status</h1>
        <div
          className={`mt-6 rounded-2xl border p-6 ${
            overall === "Operational"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          <div className="text-xl font-semibold">{overall}</div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Liveness</dt>
              <dd>{status.live ?? "…"}</dd>
            </div>
            <div>
              <dt className="text-muted">Readiness</dt>
              <dd>{status.ready ?? "…"}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-8 text-sm text-muted">
          For incident history and maintenance windows, contact your platform administrator.
        </p>
      </div>
    </div>
  );
}
