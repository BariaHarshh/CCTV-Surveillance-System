"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Layers,
  Map as MapIcon,
  Radio,
  Search,
  X,
  WifiOff,
} from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";
import { cn } from "@/lib/utils";
import { LEGEND_ITEMS, MAP_MODES, MAP_LAYER_KEYS } from "@/lib/map/constants";
import { CampusMapCanvas } from "@/components/map/CampusMapCanvas";

type LayerKey = (typeof MAP_LAYER_KEYS)[number];

const LAYER_LABELS: Record<string, string> = {
  campuses: "Campuses",
  buildings: "Buildings",
  cameras: "Cameras",
  incidents: "Incidents",
  alerts: "Alerts",
  responseTeams: "Response Teams",
  emergencyPoints: "Emergency Points",
  assets: "Assets",
  exits: "Emergency Exits",
  assemblyAreas: "Assembly Areas",
  zones: "Zones",
  coverage: "Camera Coverage",
  heatmap: "Risk Heatmap",
};

export function DigitalCampusMapClient({
  user,
  embedded = false,
  commandMode,
}: {
  user: SafeUser;
  embedded?: boolean;
  commandMode?: "NORMAL" | "ALERT" | "INCIDENT" | "EMERGENCY" | "RECOVERY";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bootstrap, setBootstrap] = useState<Record<string, unknown> | null>(null);
  const [objects, setObjects] = useState<Record<string, unknown> | null>(null);
  const [heatmap, setHeatmap] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [aiQ, setAiQ] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [listMode, setListMode] = useState(false);

  const mode = (searchParams.get("mode") || "STANDARD").toUpperCase();
  const timeRange = searchParams.get("range") || "7D";
  const buildingParam = searchParams.get("building");

  const [layers, setLayers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const k of MAP_LAYER_KEYS) initial[k] = ["buildings", "cameras", "incidents", "alerts", "exits", "assemblyAreas"].includes(k);
    if (mode === "CAMERA") initial.coverage = true;
    if (mode === "RISK") initial.heatmap = true;
    if (mode === "EMERGENCY") {
      initial.exits = true;
      initial.assemblyAreas = true;
      initial.responseTeams = true;
      initial.emergencyPoints = true;
    }
    if (mode === "RESPONSE") initial.responseTeams = true;
    if (mode === "ASSET") initial.assets = true;
    if (mode === "INCIDENT") {
      initial.incidents = true;
      initial.alerts = true;
    }
    return initial;
  });

  const updateUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`/map?${sp.toString()}`);
    },
    [router, searchParams]
  );

  const activeLayers = useMemo(
    () => Object.entries(layers).filter(([, v]) => v).map(([k]) => k),
    [layers]
  );

  const loadBootstrap = useCallback(async () => {
    const res = await fetch("/api/map/bootstrap", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setBootstrap(data.bootstrap);
  }, []);

  const loadObjects = useCallback(async () => {
    const qs = new URLSearchParams({
      layers: activeLayers.join(","),
      timeRange,
      zoom: searchParams.get("zoom") || "15",
    });
    if (searchParams.get("lat") && searchParams.get("lng")) {
      // optional center hint — bounds still from map
    }
    const res = await fetch(`/api/map/objects?${qs}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) {
      setObjects(data.objects);
      setLastUpdated(new Date().toISOString());
      setConnected(true);
    } else {
      setConnected(false);
    }
  }, [activeLayers, timeRange, searchParams]);

  const loadHeatmap = useCallback(async () => {
    if (!layers.heatmap && mode !== "RISK") {
      setHeatmap(null);
      return;
    }
    const res = await fetch(`/api/map/heatmap?timeRange=${timeRange}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) setHeatmap(data.heatmap);
  }, [layers.heatmap, mode, timeRange]);

  const loadActivity = useCallback(async () => {
    const res = await fetch("/api/map/activity", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setActivity(data.activity?.events ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadBootstrap(), loadObjects(), loadHeatmap(), loadActivity()]);
    setLoading(false);
  }, [loadBootstrap, loadObjects, loadHeatmap, loadActivity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (buildingParam) {
      fetch(`/api/map/buildings/${encodeURIComponent(buildingParam)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (d.building) setDetail({ kind: "building", ...d.building });
        });
    }
  }, [buildingParam]);

  useMonitoringSocket({
    onAlertCreated: () => {
      setToast("⚠ New alert");
      loadObjects();
      loadActivity();
    },
    onIncidentUpdated: () => {
      setToast("Incident updated");
      loadObjects();
    },
    onEmergencyCreated: () => {
      setToast("⚠ ACTIVE EMERGENCY");
      loadBootstrap();
      loadObjects();
    },
    onEmergencyUpdated: () => loadBootstrap(),
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const runSearch = async () => {
    if (search.trim().length < 2) return;
    const res = await fetch(`/api/map/activity?q=${encodeURIComponent(search)}`, {
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok) setSearchResults(data.results ?? []);
  };

  const askAi = async () => {
    if (!aiQ.trim()) return;
    setAiAnswer("Working…");
    const res = await fetch("/api/intelligence/copilot", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: aiQ,
        context: { surface: "map", mode, timeRange },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      const result = data.result as Record<string, unknown> | undefined;
      const text =
        (result?.message as string) ||
        (result?.answer as string) ||
        (typeof result?.summary === "string" ? result.summary : null) ||
        (Array.isArray(result?.toolResults)
          ? JSON.stringify(result?.toolResults).slice(0, 800)
          : null) ||
        JSON.stringify(result ?? data).slice(0, 800);
      setAiAnswer(text);
      const lower = aiQ.toLowerCase();
      if (lower.includes("risk") || lower.includes("highest")) {
        setLayers((l) => ({ ...l, heatmap: true, buildings: true }));
        updateUrl({ mode: "RISK" });
      }
      if (lower.includes("camera") && lower.includes("offline")) {
        setLayers((l) => ({ ...l, cameras: true, coverage: true }));
        updateUrl({ mode: "CAMERA" });
      }
      if (lower.includes("incident")) {
        setLayers((l) => ({ ...l, incidents: true }));
        updateUrl({ mode: "INCIDENT", range: "7D" });
      }
    } else {
      setAiAnswer(data.error || "AI request failed.");
    }
  };

  const emergency = bootstrap?.activeEmergency as Record<string, unknown> | null | undefined;
  const center = bootstrap?.center as { lat: number; lng: number } | null | undefined;
  const tileStyle =
    mode === "SATELLITE" ? "satellite" : mode === "DARK" || mode === "EMERGENCY" ? "dark" : "standard";

  const body = (
    <div
      className={cn(
        "flex min-h-[70vh] flex-col gap-3",
        embedded ? "h-full" : "",
        commandMode === "EMERGENCY" && "ring-1 ring-red-500/40"
      )}
    >
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-[#0b1220] px-4 py-3">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-sky-400" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400/80">
              AI Campus Guardian
            </p>
            <h1 className="text-sm font-semibold text-white">Digital Campus Map</h1>
          </div>
        </div>

        <select
          className="rounded-lg border border-border bg-black/40 px-2 py-1.5 text-xs"
          value={(bootstrap?.campus as { campusId?: string } | undefined)?.campusId ?? ""}
          onChange={() => undefined}
          aria-label="Campus selector"
        >
          {((bootstrap?.campuses as Array<{ campusId: string; name: string }>) ?? []).map((c) => (
            <option key={c.campusId} value={c.campusId}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-border bg-black/30 px-2">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search building, camera, incident…"
            className="w-full bg-transparent py-1.5 text-xs outline-none"
            aria-label="Map search"
          />
        </div>

        <select
          className="rounded-lg border border-border bg-black/40 px-2 py-1.5 text-xs"
          value={mode}
          onChange={(e) => updateUrl({ mode: e.target.value })}
          aria-label="Map mode"
        >
          {MAP_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border border-border bg-black/40 px-2 py-1.5 text-xs"
          value={timeRange}
          onChange={(e) => updateUrl({ range: e.target.value })}
          aria-label="Time range"
        >
          <option value="TODAY">Today</option>
          <option value="7D">7 Days</option>
          <option value="30D">30 Days</option>
          <option value="90D">90 Days</option>
        </select>

        <Link href="/ai-copilot" className="rounded-lg border border-accent/30 px-2 py-1.5 text-xs text-accent">
          AI Assistant
        </Link>
        <Link href="/admin/notifications" className="rounded-lg border border-border px-2 py-1.5 text-xs">
          Notifications
        </Link>

        {emergency ? (
          <Link
            href={`/emergency/${emergency.emergencyId}/map`}
            className="rounded-lg border border-red-500/40 bg-red-500/15 px-2 py-1.5 text-xs font-semibold text-red-300"
          >
            ⚠ ACTIVE EMERGENCY
          </Link>
        ) : (
          <span className="rounded-lg border border-emerald-500/20 px-2 py-1.5 text-xs text-emerald-400">
            Emergency: Clear
          </span>
        )}

        <button
          type="button"
          className="rounded-lg border border-border px-2 py-1.5 text-xs"
          onClick={() => setListMode((v) => !v)}
        >
          {listMode ? "Map view" : "List view"}
        </button>
      </header>

      {!connected && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <WifiOff className="h-4 w-4" />
          Connection Lost — Last Updated:{" "}
          {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "unknown"}
        </div>
      )}

      {toast && (
        <button
          type="button"
          onClick={() => setToast(null)}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-100"
        >
          {toast} — click to dismiss
        </button>
      )}

      <div className="grid flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Sidebar layers */}
        <aside className="rounded-xl border border-border bg-[#0b1220] p-3" aria-label="Map layers">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <Layers className="h-3.5 w-3.5" /> Layers
          </p>
          <ul className="space-y-1">
            {Object.keys(LAYER_LABELS).map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={Boolean(layers[key])}
                    onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))}
                  />
                  {LAYER_LABELS[key]}
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Legend</p>
            <ul className="space-y-1.5">
              {LEGEND_ITEMS.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-white/20 text-[9px] font-bold"
                    style={{ backgroundColor: `${item.color}33`, color: item.color }}
                    aria-hidden
                  >
                    {item.icon.slice(0, 1).toUpperCase()}
                  </span>
                  <span>{item.label}</span>
                  <span className="ml-auto text-muted">{item.color}</span>
                </li>
              ))}
            </ul>
          </div>

          {(bootstrap?.mapDataQuality as { message?: string } | undefined)?.message && (
            <p className="mt-4 text-[10px] leading-relaxed text-muted">
              {(bootstrap?.mapDataQuality as { message: string }).message}
            </p>
          )}
        </aside>

        {/* Map / list */}
        <section className="relative min-h-[520px] overflow-hidden rounded-xl border border-border bg-[#060a12]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-sm">
              Loading map…
            </div>
          )}
          {listMode ? (
            <div className="max-h-[70vh] overflow-auto p-4" tabIndex={0}>
              <p className="mb-3 text-sm font-medium">
                {(objects?.accessibilityList as { summary?: string } | undefined)?.summary ||
                  "Map list alternative"}
              </p>
              <ul className="space-y-2">
                {((objects?.accessibilityList as { items?: Array<Record<string, string>> })?.items ?? []).map(
                  (item) => (
                    <li
                      key={`${item.kind}-${item.id}`}
                      className="rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      <span className="font-semibold uppercase text-muted">{item.kind}</span> — {item.title}
                      <span className="ml-2 text-muted">{item.meta}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : center ? (
            <CampusMapCanvas
              center={center}
              tileStyle={tileStyle as "standard" | "dark" | "satellite"}
              objects={objects}
              heatmap={heatmap}
              showCoverage={Boolean(layers.coverage)}
              reducedMotion={
                typeof window !== "undefined" &&
                window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
              }
              onSelect={(payload) => setDetail(payload)}
              onViewChange={(view) => {
                updateUrl({
                  lat: String(view.lat.toFixed(5)),
                  lng: String(view.lng.toFixed(5)),
                  zoom: String(view.zoom),
                });
              }}
            />
          ) : (
            <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 p-8 text-center">
              <Building2 className="h-10 w-10 text-muted" />
              <p className="max-w-md text-sm text-muted">
                No geographic coordinates configured for this campus. Add latitude/longitude on Campus or
                Building settings to enable the geographic map. Floor plans and list view remain available.
              </p>
              <Link href="/admin/campus" className="text-xs text-sky-400 underline">
                Configure campus coordinates
              </Link>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="absolute left-3 top-3 z-[500] max-h-60 w-72 overflow-auto rounded-lg border border-white/15 bg-[#0b1220]/95 p-2 shadow-xl">
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[10px] uppercase text-muted">Results</span>
                <button type="button" onClick={() => setSearchResults([])}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {searchResults.map((r) => (
                <Link
                  key={`${r.kind}-${r.id}`}
                  href={String(r.href)}
                  className="block rounded px-2 py-1.5 text-xs hover:bg-white/5"
                >
                  <span className="text-muted">{String(r.kind)}</span> {String(r.label)}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Detail + AI + timeline */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-[#0b1220] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Detail</p>
            {!detail ? (
              <p className="text-xs text-muted">Select a marker for details.</p>
            ) : (
              <DetailPanel detail={detail} onClose={() => setDetail(null)} />
            )}
          </div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent">
              <Radio className="h-3.5 w-3.5" /> AI Map Assistant
            </p>
            <textarea
              value={aiQ}
              onChange={(e) => setAiQ(e.target.value)}
              rows={2}
              placeholder='e.g. "Which areas are becoming higher risk?"'
              className="w-full rounded-lg border border-border bg-black/30 p-2 text-xs outline-none"
            />
            <button
              type="button"
              onClick={askAi}
              className="mt-2 rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent"
            >
              Ask
            </button>
            {aiAnswer && <p className="mt-2 text-xs leading-relaxed text-foreground/80">{aiAnswer}</p>}
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border border-border bg-[#0b1220] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Map Activity</p>
            <ul className="space-y-2">
              {activity.map((e, i) => (
                <li key={`${e.at}-${i}`} className="border-l-2 border-border pl-2 text-[11px]">
                  <span className="text-muted">
                    {e.at ? new Date(String(e.at)).toLocaleTimeString() : ""}
                  </span>
                  <p>{String(e.text)}</p>
                </li>
              ))}
              {!activity.length && <li className="text-xs text-muted">No recent map activity.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );

  if (embedded) return body;
  return <AdminShell user={user}>{body}</AdminShell>;
}

function DetailPanel({
  detail,
  onClose,
}: {
  detail: Record<string, unknown>;
  onClose: () => void;
}) {
  const kind = String(detail.kind || detail.type || "item");
  const buildingObj =
    detail.building && typeof detail.building === "object"
      ? (detail.building as Record<string, unknown>)
      : null;
  const buildingId = String(detail.buildingId || buildingObj?.buildingId || "");
  const coverage =
    detail.coverage && typeof detail.coverage === "object"
      ? (detail.coverage as Record<string, unknown>)
      : null;
  const locationMeta =
    detail.locationMeta && typeof detail.locationMeta === "object"
      ? (detail.locationMeta as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">{kind}</p>
          <p className="text-sm font-semibold">
            {String(detail.name || detail.title || detail.cameraId || "")}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close detail">
          <X className="h-4 w-4" />
        </button>
      </div>
      {detail.status != null && (
        <p>
          Status: <span className="font-medium">{String(detail.status)}</span>
        </p>
      )}
      {detail.severity != null && <p>Severity: {String(detail.severity)}</p>}
      {detail.building != null && typeof detail.building === "string" && (
        <p>Building: {detail.building}</p>
      )}
      {buildingObj?.name != null && <p>Building: {String(buildingObj.name)}</p>}
      {detail.floor != null && <p>Floor: {String(detail.floor)}</p>}
      {coverage && (
        <p className="text-muted">
          Coverage: estimate{coverage.calibrated ? " (calibrated)" : " (not calibrated)"}
        </p>
      )}
      {locationMeta && (
        <p className="text-[10px] text-muted">
          Source: {String(locationMeta.source || "Admin Configuration")}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {(kind === "CAMERA" || Boolean(detail.cameraId)) && (
          <Link href="/admin/cameras" className="rounded border border-sky-500/30 px-2 py-1 text-sky-300">
            Open Camera
          </Link>
        )}
        {detail.incidentId ? (
          <Link
            href="/admin/incidents"
            className="rounded border border-amber-500/30 px-2 py-1 text-amber-300"
          >
            Open Incident
          </Link>
        ) : null}
        {buildingId ? (
          <>
            <Link
              href={`/map/building/${encodeURIComponent(buildingId)}/floor/1`}
              className="rounded border border-white/20 px-2 py-1"
            >
              Floor plans
            </Link>
            <Link
              href={`/building/${encodeURIComponent(buildingId)}`}
              className="rounded border border-white/20 px-2 py-1"
            >
              Building overview
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
