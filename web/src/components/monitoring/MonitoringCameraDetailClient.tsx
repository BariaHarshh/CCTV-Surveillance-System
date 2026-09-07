"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { MonitoringPortal } from "./MonitoringPortal";
import { CameraStreamView } from "./CameraStreamView";
import { CameraStatusDot, SeverityBadge, formatDateTime, formatEventType } from "./shared";

interface CameraDetail {
  id: string;
  cameraId: string;
  name: string;
  type: string;
  status: string;
  lastSeen: string | null;
  location: { building?: string; room?: string; areaLabel?: string; floor?: string };
  deviceModel?: string;
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
  metadata?: Record<string, unknown>;
}

export function MonitoringCameraDetailClient({
  user,
  portal,
  cameraId,
}: {
  user: SafeUser;
  portal: "admin" | "staff";
  cameraId: string;
}) {
  const base = portal === "admin" ? "/admin" : "/staff";
  const [camera, setCamera] = useState<CameraDetail | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/monitoring/cameras/${cameraId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.camera) setCamera(data.camera);
        setEvents(data.recentEvents ?? []);
      })
      .finally(() => setLoading(false));
  }, [cameraId]);

  const activeEvents = events.filter((e) => e.status === "OPEN");

  const overlayEvent = events.find((e) => {
    const meta = (e as EventRow & { metadata?: Record<string, unknown> }).metadata;
    return meta && typeof meta === "object" && "boundingBox" in meta;
  });
  const overlayMeta = (overlayEvent as (EventRow & { metadata?: Record<string, unknown> }) | undefined)?.metadata;
  const boundingBox = overlayMeta?.boundingBox as { x: number; y: number; w: number; h: number } | undefined;
  const overlayDetections = boundingBox
    ? [{ label: formatEventType(overlayEvent!.eventType), confidence: overlayEvent!.confidence, boundingBox }]
    : [];
  const zonePolygon = overlayMeta?.zonePolygon as { x: number; y: number }[] | undefined;
  const overlayZones =
    zonePolygon && overlayMeta?.zoneName
      ? [{ name: String(overlayMeta.zoneName), polygon: zonePolygon }]
      : [];

  return (
    <MonitoringPortal portal={portal} user={user}>
      <Link href={`${base}/monitoring`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Back to monitoring
      </Link>

      {loading ? (
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-glass" />
      ) : !camera ? (
        <p className="mt-8 text-red-400">Camera not found.</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h1 className="text-2xl font-bold">{camera.name}</h1>
            <p className="font-mono text-sm text-muted">{camera.cameraId}</p>
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Live View</h2>
              <CameraStreamView
                cameraDbId={camera.id}
                status={camera.status}
                className="w-full"
                detections={overlayDetections}
                zones={overlayZones}
              />
            </div>

            {portal === "admin" && (
              <Link href={`/admin/cameras/${camera.id}/ai`} className="mt-3 inline-block text-xs text-accent hover:underline">
                Configure AI detection for this camera
              </Link>
            )}

            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Current Events</h2>
              {activeEvents.length === 0 ? (
                <p className="rounded-xl border border-border p-4 text-sm text-muted">No active events for this camera.</p>
              ) : (
                <ul className="space-y-2">
                  {activeEvents.map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{formatEventType(e.eventType)}</p>
                        <p className="text-xs text-muted">{formatDateTime(e.detectedAt)} · {e.source === "TEST" ? "SIMULATED" : e.source}</p>
                      </div>
                      <SeverityBadge severity={e.severity} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Event Timeline</h2>
              {events.length === 0 ? (
                <p className="rounded-xl border border-border p-4 text-sm text-muted">No recent events.</p>
              ) : (
                <ul className="space-y-2">
                  {events.map((e) => (
                    <li key={e.id}>
                      <Link href={`${base}/events/${e.id}`} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-glass">
                        <div>
                          <p className="text-sm">{formatEventType(e.eventType)}</p>
                          <p className="text-xs text-muted">{formatDateTime(e.detectedAt)}</p>
                        </div>
                        <SeverityBadge severity={e.severity} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Camera Information</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-muted">Camera ID</dt><dd className="font-mono">{camera.cameraId}</dd></div>
              <div><dt className="text-muted">Name</dt><dd>{camera.name}</dd></div>
              <div><dt className="text-muted">Building</dt><dd>{camera.location.building ?? "—"}</dd></div>
              <div><dt className="text-muted">Room</dt><dd>{camera.location.room ?? "—"}</dd></div>
              <div><dt className="text-muted">Camera type</dt><dd>{camera.type}</dd></div>
              <div><dt className="text-muted">Status</dt><dd><CameraStatusDot status={camera.status} /></dd></div>
              <div><dt className="text-muted">Last seen</dt><dd>{formatDateTime(camera.lastSeen)}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </MonitoringPortal>
  );
}
