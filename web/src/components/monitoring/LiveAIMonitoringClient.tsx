"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Users, AlertTriangle, ShieldCheck, RefreshCw, Activity, Layers } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { MonitoringPortal } from "./MonitoringPortal";
import { CameraStreamView } from "./CameraStreamView";
import { CameraStatusDot, SeverityBadge, RealtimeIndicator, formatDateTime, formatTime, formatEventType } from "./shared";
import { useMonitoringSocket } from "@/hooks/useMonitoringSocket";
import { cn } from "@/lib/utils";

interface CameraItem {
  id: string;
  cameraId: string;
  name: string;
  status: string;
  type?: string;
  lastSeen: string | null;
  location: { building?: string; room?: string; areaLabel?: string };
  capacity?: number;
}

interface DetectionMetadata {
  currentCount?: number;
  stableCount?: number;
  capacity?: number;
  threshold?: number;
  crowdState?: "NORMAL" | "CHECKING CROWD" | "CROWD DETECTED" | string;
  occupancyPercentage?: number;
  boundingBox?: { x: number; y: number; w: number; h: number };
  [key: string]: unknown;
}

interface EventRow {
  id: string;
  eventId: string;
  eventType: string;
  severity: string;
  confidence: number | null;
  detectedAt: string;
  status: string;
  source: string;
  metadata?: DetectionMetadata;
}

export function LiveAIMonitoringClient({
  user,
  portal,
  initialCameraId,
}: {
  user: SafeUser;
  portal: "admin" | "staff";
  initialCameraId?: string;
}) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(initialCameraId ?? null);
  const [camera, setCamera] = useState<CameraItem | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Crowd Detection state
  const [crowdData, setCrowdData] = useState<{
    currentCount: number;
    stableCount: number;
    capacity: number;
    crowdState: "NORMAL" | "CHECKING CROWD" | "CROWD DETECTED";
    lastUpdate: string | null;
    detections: { label: string; confidence?: number | null; boundingBox?: { x: number; y: number; w: number; h: number } }[];
  }>({
    currentCount: 0,
    stableCount: 0,
    capacity: 10,
    crowdState: "NORMAL",
    lastUpdate: null,
    detections: [],
  });

  // Load available camera list
  const loadCameras = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/cameras", { credentials: "include" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.cameras)) {
        const sorted = [...data.cameras].sort((a, b) => (a.cameraId || "").localeCompare(b.cameraId || ""));
        setCameras(sorted);
        if (sorted.length > 0) {
          if (!selectedCameraId) {
            setSelectedCameraId(sorted[0].id);
          }
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [selectedCameraId]);

  // Load details for selected camera
  const loadCameraDetail = useCallback(async (camId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitoring/cameras/${camId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load camera details");
      }
      if (data.camera) {
        setCamera(data.camera);
      }
      const fetchedEvents: EventRow[] = data.recentEvents ?? [];
      setEvents(fetchedEvents);

      // Extract crowd detection state from recent events if available
      const crowdEvent = fetchedEvents.find(
        (e) => e.eventType === "OCCUPANCY_HIGH" || e.eventType === "PERSON_DETECTED" || e.metadata?.currentCount !== undefined
      );

      if (crowdEvent?.metadata) {
        const meta = crowdEvent.metadata;
        const currentCount = Number(meta.currentCount ?? 0);
        const capacity = Number(meta.capacity ?? meta.threshold ?? 10);
        let crowdState: "NORMAL" | "CHECKING CROWD" | "CROWD DETECTED" = "NORMAL";

        if (meta.crowdState) {
          const s = String(meta.crowdState).toUpperCase();
          if (s.includes("CROWD DETECTED") || s.includes("HIGH") || s.includes("CRITICAL")) {
            crowdState = "CROWD DETECTED";
          } else if (s.includes("CHECKING") || s.includes("ELEVATED") || s.includes("MEDIUM")) {
            crowdState = "CHECKING CROWD";
          }
        } else if (currentCount >= capacity) {
          crowdState = "CROWD DETECTED";
        } else if (currentCount >= Math.floor(capacity * 0.7)) {
          crowdState = "CHECKING CROWD";
        }

        const detections = meta.boundingBox
          ? [{ label: formatEventType(crowdEvent.eventType), confidence: crowdEvent.confidence, boundingBox: meta.boundingBox }]
          : [];

        setCrowdData({
          currentCount,
          stableCount: Number(meta.stableCount ?? currentCount),
          capacity,
          crowdState,
          lastUpdate: crowdEvent.detectedAt,
          detections,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading camera detail");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  useEffect(() => {
    if (selectedCameraId) {
      loadCameraDetail(selectedCameraId);
    }
  }, [selectedCameraId, loadCameraDetail]);

  // Realtime Socket.IO handler
  const { status: realtimeStatus } = useMonitoringSocket({
    onCameraStatus: (payload) => {
      const camId = (payload.cameraId as string) || (payload.id as string);
      if (camera && (camera.id === camId || camera.cameraId === camId)) {
        setCamera((prev) => (prev ? { ...prev, status: String(payload.status ?? prev.status) } : prev));
      }
    },
    onDetectionCreated: (payload) => {
      const camId = payload.cameraId as string;
      if (camera && (camera.id === camId || camera.cameraId === camId)) {
        const meta = (payload.metadata as DetectionMetadata) || {};
        const count = Number(meta.currentCount ?? crowdData.currentCount);
        const cap = Number(meta.capacity ?? meta.threshold ?? crowdData.capacity);
        let state: "NORMAL" | "CHECKING CROWD" | "CROWD DETECTED" = "NORMAL";

        if (meta.crowdState) {
          const s = String(meta.crowdState).toUpperCase();
          if (s.includes("CROWD DETECTED") || s.includes("HIGH") || s.includes("CRITICAL")) {
            state = "CROWD DETECTED";
          } else if (s.includes("CHECKING") || s.includes("ELEVATED") || s.includes("MEDIUM")) {
            state = "CHECKING CROWD";
          }
        } else if (count >= cap) {
          state = "CROWD DETECTED";
        } else if (count >= Math.floor(cap * 0.7)) {
          state = "CHECKING CROWD";
        }

        const detections = meta.boundingBox
          ? [{ label: "Person", confidence: 0.9, boundingBox: meta.boundingBox }]
          : crowdData.detections;

        setCrowdData({
          currentCount: count,
          stableCount: Number(meta.stableCount ?? count),
          capacity: cap,
          crowdState: state,
          lastUpdate: new Date().toISOString(),
          detections,
        });
      }
    },
    onEventCreated: (payload) => {
      const camId = payload.cameraId as string;
      if (selectedCameraId && (selectedCameraId === camId || camera?.id === camId || camera?.cameraId === camId)) {
        loadCameraDetail(selectedCameraId);
      }
    },
  });

  const capacityPct = Math.min(100, Math.round((crowdData.currentCount / (crowdData.capacity || 1)) * 100));

  return (
    <MonitoringPortal portal={portal} user={user}>
      {/* Header & Camera Selection Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`${base}/monitoring`} className="text-xs text-muted hover:text-accent">
              ← Monitoring Overview
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">Live AI Crowd Monitoring</h1>
          <p className="mt-1 text-xs text-muted">Real-time video feed and crowd occupancy analytics from Python ML backend.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealtimeIndicator status={realtimeStatus} />
          {cameras.length > 0 && (
            <select
              value={selectedCameraId ?? ""}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="rounded-xl border border-border bg-surface/80 px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.cameraId}) — {c.status}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => selectedCameraId && loadCameraDetail(selectedCameraId)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-glass lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-2xl bg-glass" />
        </div>
      ) : error || !camera ? (
        <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
          <h3 className="mt-2 font-semibold text-red-300">Camera Unavailable</h3>
          <p className="mt-1 text-xs text-muted">{error || "Selected camera could not be found."}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Main Column: 4-Camera Live Video Stream Grid */}
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              {cameras.map((cam) => {
                const isSelected = selectedCameraId === cam.id;
                return (
                  <div
                    key={cam.id}
                    onClick={() => setSelectedCameraId(cam.id)}
                    className={cn(
                      "cursor-pointer overflow-hidden rounded-2xl border bg-surface/50 p-3.5 transition-all",
                      isSelected
                        ? "border-accent/80 shadow-lg shadow-accent/10 ring-1 ring-accent/50"
                        : "border-border hover:border-accent/40"
                    )}
                  >
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="font-mono text-xs font-semibold text-foreground">{cam.cameraId}</span>
                        <span className="text-[11px] font-medium text-muted truncate max-w-[130px]">{cam.name}</span>
                      </div>
                      <CameraStatusDot status={cam.status} />
                    </div>

                    {/* Camera Video Feed - Autoplays on mount */}
                    <CameraStreamView
                      cameraDbId={cam.id}
                      status={cam.status}
                      className="w-full aspect-video"
                      detections={isSelected ? crowdData.detections : []}
                    />

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                      <span className="truncate max-w-[170px]">
                        {[cam.location.building, cam.location.room, cam.location.areaLabel].filter(Boolean).join(" · ") || "Campus Area"}
                      </span>
                      {isSelected ? (
                        <span className="font-semibold text-accent flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> Focused
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">Click to Focus</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Panel: Recent AI Events Timeline */}
            <div className="rounded-2xl border border-border bg-surface/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent AI Events</h3>
                  <p className="mt-0.5 text-xs text-muted">Logged Crowd & Occupancy detections from Python ML pipeline.</p>
                </div>
                <span className="rounded-full bg-glass px-2.5 py-1 font-mono text-xs font-medium text-muted">
                  {events.length} Events
                </span>
              </div>

              {events.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No recent AI events logged for this camera yet.
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {events.map((e) => {
                    const count = e.metadata?.currentCount ?? e.metadata?.occupancyPercentage;
                    return (
                      <li key={e.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "rounded-lg p-2",
                            e.severity === "CRITICAL" || e.severity === "HIGH" ? "bg-red-500/10 text-red-400" :
                            e.severity === "MEDIUM" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                          )}>
                            <Activity className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">{formatEventType(e.eventType)}</span>
                              <span className="rounded bg-glass px-1.5 py-0.5 font-mono text-[10px] text-muted">{e.source}</span>
                            </div>
                            <p className="text-[11px] text-muted">
                              {formatDateTime(e.detectedAt)}
                              {count !== undefined && ` · Count: ${count}`}
                            </p>
                          </div>
                        </div>
                        <SeverityBadge severity={e.severity} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right Column: AI Status & Crowd Occupancy Panel */}
          <div className="space-y-6">
            {/* AI Status Badge Card */}
            <div className="rounded-2xl border border-border bg-surface/50 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">AI Detection Status</h3>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-glass p-4">
                <div className="flex items-center gap-3">
                  {crowdData.crowdState === "CROWD DETECTED" ? (
                    <div className="rounded-full bg-red-500/20 p-2.5 text-red-400">
                      <AlertTriangle className="h-6 w-6 animate-pulse" />
                    </div>
                  ) : crowdData.crowdState === "CHECKING CROWD" ? (
                    <div className="rounded-full bg-amber-500/20 p-2.5 text-amber-400">
                      <Users className="h-6 w-6" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-emerald-500/20 p-2.5 text-emerald-400">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Current AI State</p>
                    <p className={cn(
                      "text-base font-bold tracking-tight",
                      crowdData.crowdState === "CROWD DETECTED" ? "text-red-400" :
                      crowdData.crowdState === "CHECKING CROWD" ? "text-amber-400" : "text-emerald-400"
                    )}>
                      {crowdData.crowdState}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs text-muted">
                  <span className="block text-[10px] uppercase text-muted">Module</span>
                  <span>Crowd Det.</span>
                </div>
              </div>
            </div>

            {/* Crowd / Occupancy Analytics Panel */}
            <div className="rounded-2xl border border-border bg-surface/50 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Crowd & Occupancy</h3>
                <Users className="h-4 w-4 text-muted" />
              </div>

              {/* Current People Count Display */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-glass p-4 text-center">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted">People Count</span>
                  <span className="mt-1 block text-3xl font-extrabold text-foreground font-mono">
                    {crowdData.currentCount}
                  </span>
                  <span className="text-[10px] text-muted">Realtime Yolov8</span>
                </div>

                <div className="rounded-xl border border-border bg-glass p-4 text-center">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted">Stable Count</span>
                  <span className="mt-1 block text-3xl font-extrabold text-accent font-mono">
                    {crowdData.stableCount}
                  </span>
                  <span className="text-[10px] text-muted">ByteTrack filtered</span>
                </div>
              </div>

              {/* Threshold & Progress Bar */}
              <div className="mt-4 rounded-xl border border-border bg-glass p-4">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted">Capacity Threshold</span>
                  <span className="font-mono text-foreground">{crowdData.currentCount} / {crowdData.capacity} people ({capacityPct}%)</span>
                </div>

                <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      capacityPct >= 100 ? "bg-red-500" :
                      capacityPct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Camera Information Panel */}
            <div className="rounded-2xl border border-border bg-surface/50 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Camera Information</h3>
              <dl className="mt-4 divide-y divide-border text-xs">
                <div className="flex justify-between py-2"><dt className="text-muted">Camera ID</dt><dd className="font-mono">{camera.cameraId}</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted">Name</dt><dd className="font-semibold">{camera.name}</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted">Building</dt><dd>{camera.location.building ?? "Main Building"}</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted">Room / Area</dt><dd>{camera.location.room ?? camera.location.areaLabel ?? "Entrance Zone"}</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted">Status</dt><dd><CameraStatusDot status={camera.status} /></dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted">Last Active</dt><dd>{formatDateTime(camera.lastSeen)}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </MonitoringPortal>
  );
}
