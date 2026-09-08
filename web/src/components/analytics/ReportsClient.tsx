"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { REPORT_FORMATS, REPORT_TYPES } from "@/lib/analytics/constants";

type Report = {
  id: string;
  reportId: string;
  type: string;
  format: string;
  status: string;
  generatedAt?: string;
  errorMessage?: string | null;
};

export function ReportsClient({ user }: { user: SafeUser }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [type, setType] = useState<string>("EXECUTIVE");
  const [format, setFormat] = useState<string>("PDF");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/reports", { credentials: "include" });
    const json = await res.json();
    setReports(json.reports ?? []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function generate() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, format }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error ?? "Report generation failed. Try again.");
      return;
    }
    setMessage(`Queued ${json.report?.reportId ?? "report"} — generating asynchronously.`);
    load();
  }

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="mt-1 text-muted">Generate PDF, CSV, or Excel safety intelligence reports from live operational data.</p>
        </div>
        <Link href="/admin/reports/scheduled" className="rounded-full border border-border px-3 py-1.5 text-xs hover:text-accent">
          Scheduled →
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-5">
        <h2 className="text-sm font-semibold">Report Generator</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-border bg-black/30 px-3 py-2 text-sm">
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="rounded-lg border border-border bg-black/30 px-3 py-2 text-sm">
            {REPORT_FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={generate}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {busy ? "Queueing…" : "Generate Report"}
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-muted">{message}</p>}
        <p className="mt-2 text-[10px] text-muted">Large reports generate asynchronously. Failed jobs show a safe error — stack traces stay server-side.</p>
      </section>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface/40 p-5">
        <h2 className="text-sm font-semibold">Recent Reports</h2>
        <table className="mt-4 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-2">ID</th>
              <th>Type</th>
              <th>Format</th>
              <th>Status</th>
              <th>Generated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="py-2 font-mono">{r.reportId}</td>
                <td>{r.type}</td>
                <td>{r.format}</td>
                <td>{r.status}</td>
                <td>{r.generatedAt ? new Date(r.generatedAt).toLocaleString() : "—"}</td>
                <td className="text-right space-x-2">
                  {r.status === "COMPLETED" && (
                    <a href={`/api/reports/${r.id}/download`} className="text-accent hover:underline">Download</a>
                  )}
                  {(r.status === "QUEUED" || r.status === "GENERATING") && (
                    <button
                      type="button"
                      className="text-muted hover:text-foreground"
                      onClick={async () => {
                        await fetch(`/api/reports/${r.id}/cancel`, { method: "POST", credentials: "include" });
                        load();
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  {r.status === "FAILED" && <span className="text-rose-300">Report generation failed. Try again.</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reports.length === 0 && <p className="mt-4 text-xs text-muted">No reports yet.</p>}
      </section>
    </AdminShell>
  );
}
