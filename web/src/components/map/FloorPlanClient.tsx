"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function FloorPlanClient({ user }: { user: SafeUser }) {
  const params = useParams<{ buildingId: string; floorId: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const buildingId = params.buildingId;
  const floorId = params.floorId;

  useEffect(() => {
    (async () => {
      const b = await fetch(`/api/map/buildings/${encodeURIComponent(buildingId)}`, {
        credentials: "include",
      });
      const bj = await b.json();
      if (!b.ok) {
        setError(bj.error || "Failed to load building");
        return;
      }
      setData(bj.building);
      const floors = (bj.building?.floors as Array<{ floorId: string; level: number }>) || [];
      const match =
        floors.find((f) => f.floorId === floorId || String(f.level) === floorId) || floors[0];
      const qs = new URLSearchParams({ buildingId });
      if (match?.floorId) qs.set("floorId", match.floorId);
      const p = await fetch(`/api/map/floor-plans?${qs}`, { credentials: "include" });
      const pj = await p.json();
      if (p.ok) setPlans(pj.floorPlans || []);
    })();
  }, [buildingId, floorId]);

  const upload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("buildingId", buildingId);
    if (/^\d+$/.test(floorId)) fd.set("level", floorId);
    else fd.set("floorId", floorId);
    const res = await fetch("/api/map/floor-plans", { method: "POST", credentials: "include", body: fd });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Upload failed");
      return;
    }
    setPlans((prev) => [j.floorPlan, ...prev]);
    setFile(null);
  };

  const publish = async (floorPlanId: string) => {
    const res = await fetch("/api/map/floor-plans", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ floorPlanId, status: "PUBLISHED" }),
    });
    const j = await res.json();
    if (res.ok) {
      setPlans((prev) =>
        prev.map((p) => (p.floorPlanId === floorPlanId ? { ...p, status: "PUBLISHED" } : p))
      );
    } else setError(j.error || "Publish failed");
  };

  const building = data?.building as Record<string, unknown> | undefined;
  const published = plans.find((p) => p.status === "PUBLISHED") || plans[0];

  return (
    <AdminShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-sky-400">Floor plan</p>
          <h1 className="text-xl font-semibold">
            {String(building?.name || buildingId)} · Floor {floorId}
          </h1>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href={`/map?building=${encodeURIComponent(buildingId)}`} className="rounded border border-white/15 px-3 py-1.5">
            Campus map
          </Link>
          <Link href={`/building/${encodeURIComponent(buildingId)}`} className="rounded border border-white/15 px-3 py-1.5">
            Building overview
          </Link>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="min-h-[480px] overflow-hidden rounded-xl border border-border bg-[#0b1220]">
          {published?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(published.imageUrl)}
              alt="Floor plan"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-[480px] items-center justify-center text-sm text-muted">
              No published floor plan for this floor.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border p-3 text-xs">
            <p className="font-semibold">Building</p>
            <p className="mt-1 text-muted">{String(building?.address || "—")}</p>
            <p className="mt-2">Rooms: {String(data?.rooms ?? "—")}</p>
            <p>
              Cameras:{" "}
              {String((data?.cameras as { total?: number } | undefined)?.total ?? "—")}
            </p>
            <p>
              Risk:{" "}
              {String((data?.risk as { level?: string } | undefined)?.level ?? "INSUFFICIENT_DATA")}
            </p>
          </div>

          <div className="rounded-xl border border-border p-3 text-xs">
            <p className="mb-2 font-semibold">Versions</p>
            <ul className="space-y-2">
              {plans.map((p) => (
                <li key={String(p.floorPlanId)} className="rounded border border-border p-2">
                  v{String(p.version)} · {String(p.status)}
                  {p.status !== "PUBLISHED" && (
                    <button
                      type="button"
                      className="ml-2 text-sky-400"
                      onClick={() => publish(String(p.floorPlanId))}
                    >
                      Publish
                    </button>
                  )}
                </li>
              ))}
              {!plans.length && <li className="text-muted">No floor plans uploaded.</li>}
            </ul>
          </div>

          <div className="rounded-xl border border-border p-3 text-xs">
            <p className="mb-2 font-semibold">Upload (admin)</p>
            <p className="mb-2 text-muted">PNG, JPG, SVG, PDF — stored privately.</p>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={!file}
              onClick={upload}
              className="mt-2 rounded bg-sky-500/20 px-3 py-1.5 text-sky-300 disabled:opacity-40"
            >
              Upload draft
            </button>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
