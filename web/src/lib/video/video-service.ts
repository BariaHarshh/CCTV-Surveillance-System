import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { Camera } from "@/models/Camera";
import { Building } from "@/models/Building";
import { Room } from "@/models/Room";
import {
  CameraHealthLog,
  CameraMaintenance,
  PrivacyZone,
  VideoAIPolicy,
  VideoAIUsage,
  VideoEvent,
  VideoEvidenceMeta,
  newVideoId,
} from "@/models/Video";
import { createStreamSession } from "@/lib/monitoring/stream-service";
import { createCameraProvider } from "@/lib/video/provider";
import { getOrCreateVideoPolicy, recordCameraHealthTransition } from "@/lib/video/pipeline";
import type { VideoCameraHealth } from "@/lib/video/constants";

function mapStatusToDisplay(status: string): string {
  if (status === "ONLINE") return "ONLINE";
  if (status === "OFFLINE" || status === "DISABLED") return "OFFLINE";
  if (status === "ERROR" || status === "CONNECTING") return "DEGRADED";
  if (status === "MAINTENANCE") return "MAINTENANCE";
  return "UNKNOWN";
}

export function computePerformanceScore(opts: {
  status: string;
  offlineCount7d: number;
  avgLatency: number | null;
  errorCount7d: number;
}): { score: number; label: VideoCameraHealth; factors: string[] } {
  const factors: string[] = [];
  let score = 100;
  if (opts.status === "OFFLINE" || opts.status === "DISABLED") {
    score -= 50;
    factors.push("Currently offline/disabled");
  } else if (opts.status === "ERROR" || opts.status === "CONNECTING") {
    score -= 25;
    factors.push("Degraded connection");
  } else if (opts.status === "MAINTENANCE") {
    score -= 15;
    factors.push("In maintenance");
  } else {
    factors.push("Currently online");
  }
  if (opts.offlineCount7d > 0) {
    score -= Math.min(30, opts.offlineCount7d * 5);
    factors.push(`+ ${opts.offlineCount7d} offline events (7d)`);
  }
  if (opts.errorCount7d > 0) {
    score -= Math.min(20, opts.errorCount7d * 3);
    factors.push(`+ ${opts.errorCount7d} errors (7d)`);
  }
  if (opts.avgLatency != null && opts.avgLatency > 500) {
    score -= 10;
    factors.push(`High latency (~${Math.round(opts.avgLatency)}ms)`);
  }
  score = Math.max(0, Math.min(100, score));
  const label: VideoCameraHealth =
    score >= 75 ? "HEALTHY" : score >= 45 ? "WARNING" : score > 0 ? "CRITICAL" : "CRITICAL";
  return { score, label, factors };
}

export async function getVideoDashboard(organizationId: string) {
  await connectDB();
  const cameras = await Camera.find(orgFilter(organizationId));
  const since = new Date(Date.now() - 24 * 3600_000);
  const [detections, critical, evidence, policy] = await Promise.all([
    VideoEvent.countDocuments(orgFilter(organizationId, { timestamp: { $gte: since }, demo: false })),
    VideoEvent.countDocuments(
      orgFilter(organizationId, {
        timestamp: { $gte: since },
        severity: { $in: ["HIGH", "CRITICAL"] },
      })
    ),
    VideoEvidenceMeta.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(8),
    getOrCreateVideoPolicy(organizationId),
  ]);

  const online = cameras.filter((c) => c.status === "ONLINE").length;
  const offline = cameras.filter((c) => c.status === "OFFLINE" || c.status === "DISABLED").length;
  const degraded = cameras.filter((c) => c.status === "ERROR" || c.status === "CONNECTING").length;
  const maintenance = cameras.filter((c) => c.status === "MAINTENANCE").length;

  return {
    summary: {
      total: cameras.length,
      online,
      offline,
      degraded,
      maintenance,
      aiEnabled: policy.enabledCameraIds.length || (policy.processingMode !== "DISABLED" ? cameras.length : 0),
      detections24h: detections,
      criticalVideoEvents24h: critical,
      processingMode: policy.processingMode,
      demoMode: policy.demoMode,
    },
    cameras: cameras.slice(0, 50).map((c) => ({
      id: c._id.toString(),
      cameraId: c.cameraId,
      name: c.name,
      status: mapStatusToDisplay(c.status),
      rawStatus: c.status,
      lastSeen: c.lastSeen?.toISOString() ?? null,
      floor: c.floor,
      buildingId: c.buildingId?.toString() ?? null,
    })),
    recentEvidence: evidence.map((e) => ({
      videoEvidenceId: e.videoEvidenceId,
      type: e.type,
      available: e.available,
      demo: e.demo,
      createdAt: e.createdAt.toISOString(),
    })),
    recentDetections: await VideoEvent.find(orgFilter(organizationId))
      .sort({ timestamp: -1 })
      .limit(12)
      .then((rows) =>
        rows.map((r) => ({
          videoEventId: r.videoEventId,
          eventType: r.eventType,
          confidence: r.confidence,
          severity: r.severity,
          status: r.status,
          timestamp: r.timestamp.toISOString(),
          demo: r.demo,
          cameraId: r.cameraId.toString(),
        }))
      ),
  };
}

export async function listVideoCameras(
  organizationId: string,
  params: {
    q?: string;
    status?: string;
    buildingId?: string;
    floor?: string;
    type?: string;
  }
) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (params.status && params.status !== "ALL") {
    const map: Record<string, string[]> = {
      ONLINE: ["ONLINE"],
      OFFLINE: ["OFFLINE", "DISABLED"],
      DEGRADED: ["ERROR", "CONNECTING"],
      MAINTENANCE: ["MAINTENANCE"],
    };
    filter.status = { $in: map[params.status] ?? [params.status] };
  }
  if (params.buildingId) filter.buildingId = params.buildingId;
  if (params.floor) filter.floor = Number(params.floor);
  if (params.type) filter.type = params.type;
  if (params.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { cameraId: { $regex: q, $options: "i" } },
    ];
  }
  const cameras = await Camera.find(orgFilter(organizationId, filter)).sort({ name: 1 }).limit(500);
  const buildings = await Building.find(orgFilter(organizationId)).select("name");
  const bmap = new Map(buildings.map((b) => [b._id.toString(), b.name]));

  return cameras.map((c) => ({
    id: c._id.toString(),
    cameraId: c.cameraId,
    name: c.name,
    type: c.type,
    status: mapStatusToDisplay(c.status),
    rawStatus: c.status,
    building: c.buildingId ? bmap.get(c.buildingId.toString()) ?? null : null,
    floor: c.floor,
    lastSeen: c.lastSeen?.toISOString() ?? null,
    mapHref: `/map?camera=${encodeURIComponent(c.cameraId)}&mode=CAMERA`,
    detailHref: `/video/cameras/${c.cameraId}`,
  }));
}

export async function getVideoCameraDetail(organizationId: string, cameraKey: string) {
  await connectDB();
  const camera = await Camera.findOne(
    orgFilter(organizationId, {
      $or: [
        { cameraId: cameraKey },
        ...(mongoose.Types.ObjectId.isValid(cameraKey) ? [{ _id: cameraKey }] : []),
      ],
    })
  );
  if (!camera) return null;

  const [building, room, healthLogs, events, privacyZones, policy] = await Promise.all([
    camera.buildingId ? Building.findById(camera.buildingId).select("name buildingId") : null,
    camera.roomId ? Room.findById(camera.roomId).select("name roomNumber") : null,
    CameraHealthLog.find(orgFilter(organizationId, { cameraId: camera._id }))
      .sort({ at: -1 })
      .limit(40),
    VideoEvent.find(orgFilter(organizationId, { cameraId: camera._id }))
      .sort({ timestamp: -1 })
      .limit(20),
    PrivacyZone.find(orgFilter(organizationId, { cameraId: camera._id, status: "ACTIVE" })),
    getOrCreateVideoPolicy(organizationId),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const weekLogs = await CameraHealthLog.find(
    orgFilter(organizationId, { cameraId: camera._id, at: { $gte: weekAgo } })
  );
  const offlineCount = weekLogs.filter((l) => l.status === "OFFLINE").length;
  const errorCount = weekLogs.filter((l) => l.health === "CRITICAL" || l.status === "ERROR").length;
  const latencies = weekLogs.map((l) => l.latencyMs).filter((n): n is number => n != null);
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
  const perf = computePerformanceScore({
    status: camera.status,
    offlineCount7d: offlineCount,
    avgLatency,
    errorCount7d: errorCount,
  });

  const provider = createCameraProvider(camera.connection.protocol, policy.demoMode);
  await provider.connect({
    protocol: camera.connection.protocol as never,
    streamUrl: camera.connection.streamUrl || "",
  });
  const healthCheck = await provider.healthCheck();
  const stream = await createStreamSession(organizationId, camera._id.toString());

  return {
    camera: {
      id: camera._id.toString(),
      cameraId: camera.cameraId,
      name: camera.name,
      type: camera.type,
      status: mapStatusToDisplay(camera.status),
      rawStatus: camera.status,
      lastSeen: camera.lastSeen?.toISOString() ?? null,
      lastTestAt: camera.lastTestAt?.toISOString() ?? null,
      lastTestSuccess: camera.lastTestSuccess,
      floor: camera.floor,
      areaLabel: camera.areaLabel,
      building: building?.name ?? null,
      buildingId: building?.buildingId ?? null,
      room: room ? `${room.roomNumber} — ${room.name}` : null,
      protocol: camera.connection.protocol,
      hasCredentials: Boolean(camera.connection.usernameEncrypted || camera.connection.passwordEncrypted),
      mapLocation: camera.mapLocation ?? null,
    },
    health: {
      ...perf,
      streamAvailability: camera.status === "ONLINE",
      latencyMs: avgLatency,
      aiProcessing: policy.processingMode,
      testResult: healthCheck,
    },
    stream: stream
      ? {
          ...stream,
          live: Boolean(stream.available && stream.type !== "NONE" && !policy.demoMode),
          demoLabel: policy.demoMode || stream.type === "NONE" ? "Not live / DEMO or gateway required" : null,
        }
      : null,
    timeline: healthLogs.map((l) => ({
      at: l.at.toISOString(),
      status: l.status,
      health: l.health,
      message: l.message,
    })),
    recentEvents: events.map((e) => ({
      videoEventId: e.videoEventId,
      eventType: e.eventType,
      confidence: e.confidence,
      status: e.status,
      severity: e.severity,
      timestamp: e.timestamp.toISOString(),
      demo: e.demo,
    })),
    privacyZones: privacyZones.map((z) => ({
      zoneId: z.zoneId,
      name: z.name,
      points: z.geometry.length,
    })),
    links: {
      map: `/map?camera=${encodeURIComponent(camera.cameraId)}&mode=CAMERA`,
      admin: `/admin/cameras`,
    },
  };
}

export async function getVideoAnalytics(organizationId: string) {
  await connectDB();
  const since = new Date(Date.now() - 30 * 864e5);
  const cameras = await Camera.find(orgFilter(organizationId));
  const events = await VideoEvent.find(orgFilter(organizationId, { timestamp: { $gte: since } }));
  const reviewed = events.filter((e) => ["CONFIRMED", "FALSE_POSITIVE", "IGNORED"].includes(e.status));
  const fp = events.filter((e) => e.status === "FALSE_POSITIVE").length;
  const usage = await VideoAIUsage.find(orgFilter(organizationId)).sort({ day: -1 }).limit(30);

  const byType: Record<string, number> = {};
  for (const e of events) byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;

  const byCamera = new Map<string, number>();
  for (const e of events) {
    const k = e.cameraId.toString();
    byCamera.set(k, (byCamera.get(k) ?? 0) + 1);
  }

  return {
    availabilityPct: cameras.length
      ? Math.round((cameras.filter((c) => c.status === "ONLINE").length / cameras.length) * 100)
      : null,
    detectionVolume30d: events.length,
    falsePositiveRate:
      reviewed.length > 0 ? Math.round((fp / reviewed.length) * 1000) / 10 : null,
    falsePositiveNote: reviewed.length < 5 ? "Insufficient review samples" : null,
    byType,
    topCameras: [...byCamera.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cameraId, count]) => ({ cameraId, count })),
    usage: usage.map((u) => ({
      day: u.day,
      aiRequests: u.aiRequests,
      framesProcessed: u.framesProcessed,
      estimatedCost: u.estimatedCost,
      errors: u.errorCount,
    })),
    modelMetricsNote: "Model metrics are separate from operational metrics.",
  };
}

export async function testCameraConnection(organizationId: string, cameraKey: string) {
  const detail = await getVideoCameraDetail(organizationId, cameraKey);
  if (!detail) return null;
  const result = detail.health.testResult;
  await recordCameraHealthTransition({
    organizationId,
    cameraId: detail.camera.id,
    status: detail.camera.rawStatus,
    health: result.result === "PASS" ? "HEALTHY" : result.result === "WARNING" ? "WARNING" : "CRITICAL",
    message: `Test: ${result.details}`,
  });
  return {
    result: result.result,
    details: result.details,
    cameraId: detail.camera.cameraId,
  };
}

export async function createMaintenanceTicket(
  organizationId: string,
  data: {
    cameraId: string;
    issue: string;
    priority?: string;
    assignedTeam?: string;
    recommendationOnly?: boolean;
    createdBy?: string;
  }
) {
  await connectDB();
  const camera = await Camera.findOne(
    orgFilter(organizationId, {
      $or: [
        { cameraId: data.cameraId },
        ...(mongoose.Types.ObjectId.isValid(data.cameraId) ? [{ _id: data.cameraId }] : []),
      ],
    })
  );
  if (!camera) throw new Error("Camera not found");
  return CameraMaintenance.create({
    ticketId: newVideoId("cmt"),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    cameraId: camera._id,
    issue: data.issue,
    priority: data.priority ?? "MEDIUM",
    assignedTeam: data.assignedTeam ?? "",
    recommendationOnly: Boolean(data.recommendationOnly),
    status: "OPEN",
    createdBy: data.createdBy ? new mongoose.Types.ObjectId(data.createdBy) : null,
  });
}

export async function suggestMaintenance(organizationId: string) {
  await connectDB();
  const cameras = await Camera.find(orgFilter(organizationId));
  const suggestions = [];
  for (const c of cameras) {
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const logs = await CameraHealthLog.find(
      orgFilter(organizationId, { cameraId: c._id, at: { $gte: weekAgo } })
    );
    const offline = logs.filter((l) => l.status === "OFFLINE").length;
    if (offline >= 3 || c.status === "ERROR") {
      suggestions.push({
        cameraId: c.cameraId,
        name: c.name,
        recommendation: "Repeated offline/errors — schedule inspection",
        evidenceBased: true,
        claim: "Recommendation only — does not confirm hardware failure",
      });
    }
  }
  return suggestions;
}
