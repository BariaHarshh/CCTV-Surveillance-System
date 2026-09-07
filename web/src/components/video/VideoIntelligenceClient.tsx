"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Grid3X3,
  Radio,
  RefreshCw,
  Shield,
  AlertTriangle,
  Activity,
} from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { cn } from "@/lib/utils";
import { VIDEO_GRID_LAYOUTS } from "@/lib/video/constants";

type Tab = "overview" | "grid" | "detections" | "review" | "evidence" | "search";

export function VideoIntelligenceClient({
  user,
  initialTab = "overview",
}: {
  user: SafeUser;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [cameras, setCameras] = useState<Array<Record<string, unknown>>>([]);
  const [detections, setDetections] = useState<Array<Record<string, unknown>>>([]);
  const [evidence, setEvidence] = useState<Array<Record<string, unknown>>>([]);
  const [layout, setLayout] = useState(4);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, c, det, ev] = await Promise.all([
      fetch("/api/video/dashboard", { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/video/dashboard?cameras=1&q=${encodeURIComponent(q)}&status=${status}`, {
        credentials: "include",
      }).then((r) => r.json()),
      fetch("/api/video/detections", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/video/evidence", { credentials: "include" }).then((r) => r.json()),
    ]);
    if (d.dashboard) setDashboard(d.dashboard);
    if (c.cameras) setCameras(c.cameras);
    if (det.detections) setDetections(det.detections);
    if (ev.evidence) setEvidence(ev.evidence);
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = (dashboard?.summary as Record<string, unknown>) || {};
  const gridCams = useMemo(() => cameras.slice(0, layout), [cameras, layout]);

  const review = async (videoEventId: string, decision: string) => {
    const res = await fetch("/api/video/detections", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", videoEventId, decision }),
    });
    const j = await res.json();
    setMessage(res.ok ? `Reviewed as ${decision}` : j.error || "Failed");
    load();
  };

  const saveEvidence = async (cameraId: string) => {
    const res = await fetch("/api/video/evidence", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snapshot", cameraId }),
    });
    const j = await res.json();
    setMessage(
      res.ok
        ? j.evidence?.available
          ? "Evidence saved"
          : j.evidence?.unavailableReason || "Recording unavailable."
        : j.error || "Failed"
    );
    load();
  };

  return (
    <AdminShell user={user}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400">
            Video Intelligence
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Video Operations Center</h1>
          <p className="mt-1 text-xs text-muted">
            Enterprise camera ops, AI detections, and evidence — integrated with alerts, incidents, and map.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/command/video-wall" className="rounded-lg border border-white/15 px-3 py-1.5">
            Video Wall
          </Link>
          <Link href="/admin/video/ai" className="rounded-lg border border-white/15 px-3 py-1.5">
            AI Dashboard
          </Link>
          <Link href="/map?mode=CAMERA" className="rounded-lg border border-sky-500/30 px-3 py-1.5 text-sky-300">
            Map
          </Link>
          <button type="button" onClick={load} className="rounded-lg border border-white/15 p-1.5">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-3 rounded-lg border border-border bg-white/5 px-3 py-2 text-xs">{message}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["overview", "Overview"],
            ["grid", "Camera Grid"],
            ["detections", "Detections"],
            ["review", "Review"],
            ["evidence", "Evidence"],
            ["search", "Search"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full border px-3 py-1.5",
              tab === id ? "border-sky-500/40 bg-sky-500/15 text-sky-200" : "border-border text-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-sm text-muted">Loading…</p>}

      {tab === "overview" && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Online", value: summary.online, icon: Camera, color: "text-emerald-400" },
              { label: "Offline", value: summary.offline, icon: AlertTriangle, color: "text-amber-400" },
              { label: "Degraded", value: summary.degraded, icon: Activity, color: "text-orange-400" },
              { label: "Detections 24h", value: summary.detections24h, icon: Radio, color: "text-sky-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-[#0b1220] p-4">
                <div className={cn("flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted")}>
                  <s.icon className={cn("h-3.5 w-3.5", s.color)} /> {s.label}
                </div>
                <p className="mt-2 text-2xl font-semibold">{String(s.value ?? "—")}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">AI Processing</h2>
              <p className="mt-2 text-sm">Mode: {String(summary.processingMode ?? "—")}</p>
              <p className="text-xs text-muted">
                Demo mode: {summary.demoMode ? "ON — synthetic data labeled DEMO DATA" : "OFF"}
              </p>
              <p className="mt-2 text-xs text-muted">
                Critical video events (24h): {String(summary.criticalVideoEvents24h ?? 0)}
              </p>
            </section>
            <section className="rounded-xl border border-border p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Recent detections
              </h2>
              <ul className="max-h-48 space-y-2 overflow-auto text-xs">
                {((dashboard?.recentDetections as Array<Record<string, unknown>>) || []).map((d) => (
                  <li key={String(d.videoEventId)} className="border-b border-white/5 pb-2">
                    <span className="font-medium">{String(d.eventType)}</span>
                    {d.demo ? <span className="ml-2 text-amber-300">DEMO DATA</span> : null}
                    <span className="ml-2 text-muted">
                      {d.confidence != null ? `${Math.round(Number(d.confidence) * 100)}%` : "—"} ·{" "}
                      {String(d.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {tab === "grid" && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <Grid3X3 className="h-4 w-4 text-muted" />
            {VIDEO_GRID_LAYOUTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLayout(n)}
                className={cn(
                  "rounded border px-2 py-1",
                  layout === n ? "border-sky-500/40 text-sky-300" : "border-border"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(layout === 1 ? 1 : layout === 2 ? 2 : layout <= 4 ? 2 : layout <= 9 ? 3 : 4, 4)}, minmax(0, 1fr))`,
            }}
          >
            {gridCams.map((c) => (
              <div
                key={String(c.id)}
                className="relative aspect-video overflow-hidden rounded-xl border border-border bg-[#060a12]"
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center">
                  <Camera className="h-6 w-6 text-muted" />
                  <p className="text-xs font-medium">{String(c.name)}</p>
                  <p className="text-[10px] text-muted">
                    {String(c.status)}
                    {c.status === "ONLINE" ? "" : " · Not live"}
                  </p>
                  <p className="text-[10px] text-amber-200/80">Stream via secure proxy when available</p>
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 text-[10px]">
                  <Link
                    href={`/video/cameras/${encodeURIComponent(String(c.cameraId))}`}
                    className="rounded bg-black/60 px-2 py-1"
                  >
                    Details
                  </Link>
                  <Link href={String(c.mapHref)} className="rounded bg-black/60 px-2 py-1">
                    Map
                  </Link>
                  <button
                    type="button"
                    className="rounded bg-black/60 px-2 py-1"
                    onClick={() => saveEvidence(String(c.id))}
                  >
                    Save Evidence
                  </button>
                  <Link
                    href={`/admin/incidents?camera=${encodeURIComponent(String(c.cameraId))}`}
                    className="rounded bg-black/60 px-2 py-1"
                  >
                    Incident
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(tab === "detections" || tab === "review") && (
        <div className="mt-6 space-y-3">
          {(tab === "review"
            ? detections.filter((d) => d.status === "NEEDS_REVIEW")
            : detections
          ).map((d) => (
            <article
              key={String(d.videoEventId)}
              className="rounded-xl border border-border bg-[#0b1220] p-4 text-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    AI detected {String(d.eventType).replace(/_/g, " ").toLowerCase()}
                    {d.demo ? <span className="ml-2 text-amber-300">DEMO DATA</span> : null}
                  </p>
                  <p className="mt-1 text-muted">
                    Confidence: {d.confidencePct != null ? `${d.confidencePct}%` : "—"} (not confirmation) ·{" "}
                    {String(d.severity)} · {String(d.status)}
                  </p>
                  <p className="text-muted">{d.timestamp ? new Date(String(d.timestamp)).toLocaleString() : ""}</p>
                </div>
                {tab === "review" && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded border border-emerald-500/30 px-2 py-1 text-emerald-300"
                      onClick={() => review(String(d.videoEventId), "CONFIRM")}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="rounded border border-amber-500/30 px-2 py-1 text-amber-300"
                      onClick={() => review(String(d.videoEventId), "FALSE_POSITIVE")}
                    >
                      False Positive
                    </button>
                    <button
                      type="button"
                      className="rounded border border-white/15 px-2 py-1"
                      onClick={() => review(String(d.videoEventId), "IGNORE")}
                    >
                      Ignore
                    </button>
                    <Link
                      href={`/admin/incidents?fromVideo=${encodeURIComponent(String(d.videoEventId))}&camera=${encodeURIComponent(String(d.cameraId))}&detection=${encodeURIComponent(String(d.eventType))}&confidence=${encodeURIComponent(String(d.confidence ?? ""))}`}
                      className="rounded border border-sky-500/30 px-2 py-1 text-sky-300"
                    >
                      Create Incident
                    </Link>
                  </div>
                )}
              </div>
            </article>
          ))}
          {!detections.length && <p className="text-sm text-muted">No detections.</p>}
        </div>
      )}

      {tab === "evidence" && (
        <div className="mt-6 overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-white/5 text-muted">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Available</th>
                <th className="px-3 py-2">Hash</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={String(e.videoEvidenceId)} className="border-b border-white/5">
                  <td className="px-3 py-2">{String(e.videoEvidenceId)}</td>
                  <td className="px-3 py-2">{String(e.type)}</td>
                  <td className="px-3 py-2">
                    {e.available ? "Yes" : String(e.unavailableReason || "No")}
                    {e.demo ? " · DEMO" : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">{String(e.hash).slice(0, 12)}…</td>
                  <td className="px-3 py-2">
                    {e.createdAt ? new Date(String(e.createdAt)).toLocaleString() : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "search" && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Camera name / ID"
              className="rounded-lg border border-border bg-black/30 px-3 py-1.5"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-border bg-black/30 px-3 py-1.5"
            >
              {["ALL", "ONLINE", "OFFLINE", "DEGRADED", "MAINTENANCE"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" onClick={load} className="rounded-lg border border-white/15 px-3 py-1.5">
              Search
            </button>
          </div>
          <ul className="space-y-2 text-xs">
            {cameras.map((c) => (
              <li key={String(c.id)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>
                  <label className="mr-2 inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selected.includes(String(c.id))}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, String(c.id)]
                            : prev.filter((id) => id !== String(c.id))
                        )
                      }
                    />
                  </label>
                  {String(c.name)} · {String(c.cameraId)} · {String(c.status)}
                  {c.building ? ` · ${String(c.building)}` : ""}
                </span>
                <Link href={String(c.detailHref)} className="text-sky-400">
                  Open
                </Link>
              </li>
            ))}
          </ul>
          {selected.length > 0 && (
            <p className="text-[11px] text-muted">
              {selected.length} selected — use Admin Video Inventory for bulk AI enable/disable (audited).
            </p>
          )}
        </div>
      )}

      <p className="mt-8 flex items-center gap-2 text-[10px] text-muted">
        <Shield className="h-3 w-3" /> Credentials never exposed · AI confidence is not certainty · Offline cameras never shown as live
      </p>
    </AdminShell>
  );
}
