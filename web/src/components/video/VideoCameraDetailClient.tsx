"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function VideoCameraDetailClient({ user }: { user: SafeUser }) {
  const params = useParams<{ cameraId: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/video/cameras/${encodeURIComponent(params.cameraId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.camera) setData(j.camera);
        else setError(j.error || "Failed");
      });
  }, [params.cameraId]);

  const cam = data?.camera as Record<string, unknown> | undefined;
  const health = data?.health as Record<string, unknown> | undefined;
  const stream = data?.stream as Record<string, unknown> | undefined;

  const runTest = async () => {
    const res = await fetch(`/api/video/cameras/${encodeURIComponent(params.cameraId)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const j = await res.json();
    setTestMsg(res.ok ? `${j.test?.result}: ${j.test?.details}` : j.error);
  };

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-sky-400">Camera</p>
          <h1 className="text-xl font-semibold">{String(cam?.name || params.cameraId)}</h1>
          <p className="text-xs text-muted">{String(cam?.cameraId)} · {String(cam?.status)}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href="/video" className="rounded border border-white/15 px-3 py-1.5">
            Video center
          </Link>
          <Link href={String((data?.links as { map?: string })?.map || "/map")} className="rounded border border-sky-500/30 px-3 py-1.5 text-sky-300">
            Map
          </Link>
          <button type="button" onClick={runTest} className="rounded border border-white/15 px-3 py-1.5">
            Test
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {testMsg && <p className="mb-3 text-xs text-amber-200">{testMsg}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border p-4 text-xs lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Stream</h2>
          <div className="flex aspect-video items-center justify-center rounded-lg bg-[#060a12] text-muted">
            {stream?.live ? (
              <span>Secure proxy available — credentials not exposed</span>
            ) : (
              <span>
                {String(stream?.demoLabel || stream?.message || "OFFLINE / Not live")}
                {cam?.lastSeen ? ` · Last known ${new Date(String(cam.lastSeen)).toLocaleString()}` : ""}
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p>Building: {String(cam?.building || "—")}</p>
            <p>Floor: {String(cam?.floor ?? "—")}</p>
            <p>Room: {String(cam?.room || "—")}</p>
            <p>Protocol: {String(cam?.protocol || "—")}</p>
            <p>Has credentials: {cam?.hasCredentials ? "yes (encrypted)" : "no"}</p>
            <p>AI health: {String(health?.label || "—")} ({String(health?.score ?? "—")})</p>
          </div>
          <ul className="mt-3 list-disc pl-4 text-muted">
            {((health?.factors as string[]) || []).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border p-4 text-xs">
            <h2 className="mb-2 font-semibold">Health timeline</h2>
            <ul className="max-h-64 space-y-2 overflow-auto">
              {((data?.timeline as Array<Record<string, unknown>>) || []).map((t, i) => (
                <li key={i}>
                  {t.at ? new Date(String(t.at)).toLocaleTimeString() : ""} {String(t.status)}
                  <span className="text-muted"> · {String(t.message)}</span>
                </li>
              ))}
              {!((data?.timeline as unknown[]) || []).length && (
                <li className="text-muted">No health transitions logged yet.</li>
              )}
            </ul>
          </section>
          <section className="rounded-xl border border-border p-4 text-xs">
            <h2 className="mb-2 font-semibold">Recent AI events</h2>
            <ul className="space-y-2">
              {((data?.recentEvents as Array<Record<string, unknown>>) || []).map((e) => (
                <li key={String(e.videoEventId)}>
                  {String(e.eventType)} · {e.confidence != null ? `${Math.round(Number(e.confidence) * 100)}%` : "—"}
                  {e.demo ? " · DEMO" : ""}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border p-4 text-xs">
            <h2 className="mb-2 font-semibold">Privacy masks</h2>
            <p>{((data?.privacyZones as unknown[]) || []).length} active zone(s)</p>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
