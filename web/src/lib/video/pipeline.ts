import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { Camera } from "@/models/Camera";
import {
  CameraHealthLog,
  VideoAIPolicy,
  VideoAIUsage,
  VideoDetectionRule,
  VideoEvent,
  VideoEventGroup,
  newVideoId,
} from "@/models/Video";
import {
  DEFAULT_DEDUPE_WINDOW_SEC,
  VIDEO_DETECTION_CATEGORIES,
  VIDEO_SENSITIVE_CATEGORIES,
} from "@/lib/video/constants";
import { createEventRecord } from "@/lib/ai/event-pipeline";
import type { EventType, SeverityLevel } from "@/lib/monitoring/constants";
import { riskEngine } from "@/lib/ai/risk-engine";
import { enqueueJob } from "@/lib/enterprise/job-queue";

export async function getOrCreateVideoPolicy(organizationId: string) {
  await connectDB();
  let policy = await VideoAIPolicy.findOne({
    organizationId: new mongoose.Types.ObjectId(organizationId),
  });
  if (!policy) {
    policy = await VideoAIPolicy.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
  }
  return policy;
}

export function fingerprintVideoEvent(opts: {
  cameraId: string;
  eventType: string;
  zoneId?: string | null;
  windowSec: number;
  at: Date;
}) {
  const bucket = Math.floor(opts.at.getTime() / (opts.windowSec * 1000));
  return crypto
    .createHash("sha256")
    .update(`${opts.cameraId}|${opts.eventType}|${opts.zoneId ?? ""}|${bucket}`)
    .digest("hex")
    .slice(0, 32);
}

async function checkRateLimits(organizationId: string, cameraId: string, policy: Awaited<ReturnType<typeof getOrCreateVideoPolicy>>) {
  const day = new Date().toISOString().slice(0, 10);
  const orgUsage = await VideoAIUsage.findOne({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    day,
    cameraId: null,
  });
  if (orgUsage && orgUsage.aiRequests >= policy.dailyAiCallLimit) {
    return { ok: false as const, reason: "Organization daily AI call limit reached" };
  }
  const camUsage = await VideoAIUsage.findOne({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    day,
    cameraId: new mongoose.Types.ObjectId(cameraId),
  });
  if (camUsage && camUsage.aiRequests >= policy.perCameraDailyLimit) {
    return { ok: false as const, reason: "Per-camera daily AI call limit reached" };
  }
  return { ok: true as const };
}

async function bumpUsage(
  organizationId: string,
  cameraId: string,
  opts: { frames?: number; requests?: number; ms?: number; cost?: number; error?: boolean }
) {
  const day = new Date().toISOString().slice(0, 10);
  const oid = new mongoose.Types.ObjectId(organizationId);
  const camOid = new mongoose.Types.ObjectId(cameraId);
  const inc = {
    framesProcessed: opts.frames ?? 0,
    aiRequests: opts.requests ?? 0,
    processingMs: opts.ms ?? 0,
    estimatedCost: opts.cost ?? 0,
    errorCount: opts.error ? 1 : 0,
  };
  await VideoAIUsage.findOneAndUpdate(
    { organizationId: oid, day, cameraId: null },
    { $inc: inc, $setOnInsert: { organizationId: oid, day, cameraId: null } },
    { upsert: true }
  );
  await VideoAIUsage.findOneAndUpdate(
    { organizationId: oid, day, cameraId: camOid },
    { $inc: inc, $setOnInsert: { organizationId: oid, day, cameraId: camOid } },
    { upsert: true }
  );
}

function mapCategoryToEventType(category: string): EventType {
  const map: Record<string, EventType> = {
    PERSON_DETECTED: "PERSON_DETECTED",
    CROWD_DETECTED: "OCCUPANCY_HIGH",
    RESTRICTED_AREA_ACTIVITY: "UNAUTHORIZED_ENTRY",
    UNUSUAL_ACTIVITY: "UNUSUAL_ACTIVITY",
    OBJECT_DETECTED: "ABANDONED_OBJECT",
    CAMERA_TAMPERING: "CAMERA_TAMPERED",
    MOTION_EVENT: "OTHER",
  };
  return map[category] ?? "OTHER";
}

/**
 * Video AI pipeline entry.
 * Integrates with existing Event → Alert → Incident path.
 * Does not fabricate detections — caller must supply a real/demo-labeled signal.
 */
export async function processVideoDetection(input: {
  organizationId: string;
  cameraId: string;
  eventType: string;
  confidence: number;
  timestamp?: Date;
  zoneId?: string | null;
  demo?: boolean;
  modelId?: string;
  modelVersion?: string;
  metadata?: Record<string, unknown>;
}) {
  await connectDB();
  const policy = await getOrCreateVideoPolicy(input.organizationId);

  if (policy.processingMode === "DISABLED") {
    return { ok: false, reason: "AI processing DISABLED for organization" };
  }

  if (input.demo && !policy.demoMode) {
    return { ok: false, reason: "Demo detections blocked — enable demoMode on video AI policy" };
  }
  if (!input.demo && policy.demoMode) {
    // allow real when not exclusively demo; demoMode only labels/allows synthetic
  }

  if (!(VIDEO_DETECTION_CATEGORIES as readonly string[]).includes(input.eventType)) {
    return { ok: false, reason: "Unknown detection category" };
  }
  if ((VIDEO_SENSITIVE_CATEGORIES as readonly string[]).includes(input.eventType)) {
    if (!policy.allowedCategories.includes(input.eventType)) {
      return { ok: false, reason: "Sensitive detection category not enabled by policy" };
    }
  } else if (policy.allowedCategories.length && !policy.allowedCategories.includes(input.eventType)) {
    return { ok: false, reason: "Detection category not allowed by policy" };
  }

  const camera = await Camera.findOne(orgFilter(input.organizationId, { _id: input.cameraId }));
  if (!camera) return { ok: false, reason: "Camera not found" };

  if (policy.enabledCameraIds.length > 0) {
    const enabled = policy.enabledCameraIds.some((id) => id.equals(camera._id));
    if (!enabled) return { ok: false, reason: "AI not enabled for this camera" };
  }

  const limits = await checkRateLimits(input.organizationId, camera._id.toString(), policy);
  if (!limits.ok) return { ok: false, reason: limits.reason };

  const at = input.timestamp ?? new Date();
  const rules = await VideoDetectionRule.find(
    orgFilter(input.organizationId, { enabled: true, detectionType: input.eventType })
  );
  const matchingRule = rules.find(
    (r) =>
      (!r.cameraIds.length || r.cameraIds.some((id) => id.equals(camera._id))) &&
      input.confidence >= r.confidenceThreshold
  );
  const threshold = matchingRule?.confidenceThreshold ?? 0.7;
  if (input.confidence < threshold) {
    await bumpUsage(input.organizationId, camera._id.toString(), { requests: 1, frames: 1 });
    return { ok: false, reason: "Below confidence threshold", threshold };
  }

  const cooldown = matchingRule?.cooldownSec ?? DEFAULT_DEDUPE_WINDOW_SEC;
  const fp = fingerprintVideoEvent({
    cameraId: camera._id.toString(),
    eventType: input.eventType,
    zoneId: input.zoneId,
    windowSec: cooldown,
    at,
  });

  const recent = await VideoEvent.findOne(
    orgFilter(input.organizationId, {
      fingerprint: fp,
      timestamp: { $gte: new Date(at.getTime() - cooldown * 1000) },
    })
  );
  if (recent) {
    return {
      ok: true,
      deduplicated: true,
      videoEventId: recent.videoEventId,
      message: "Event deduplicated within cooldown window",
    };
  }

  const severity = (matchingRule?.severity ??
    (input.confidence >= 0.9 ? "HIGH" : input.confidence >= 0.75 ? "MEDIUM" : "LOW")) as SeverityLevel;

  const eventType = mapCategoryToEventType(input.eventType);
  const risk = riskEngine.calculate({
    eventType,
    confidence: input.confidence,
    severity,
    afterHours: Boolean(input.metadata?.afterHours),
  });

  // Existing Event → Alert → Incident pipeline
  const created = await createEventRecord({
    organizationId: input.organizationId,
    cameraId: camera._id.toString(),
    eventType,
    confidence: input.confidence,
    source: input.demo ? "TEST" : "DETECTION",
    detectedAt: at,
    severity,
    risk,
    metadata: {
      ...input.metadata,
      videoPipeline: true,
      modelId: input.modelId ?? null,
      modelVersion: input.modelVersion ?? null,
      demo: Boolean(input.demo),
      language: "AI detected — confidence is not confirmation",
    },
  });

  const linkedEventOid =
    created.event?.id && mongoose.Types.ObjectId.isValid(created.event.id)
      ? new mongoose.Types.ObjectId(created.event.id)
      : null;
  const linkedAlertOid =
    created.alert && typeof created.alert === "object" && "id" in created.alert
      ? new mongoose.Types.ObjectId(String((created.alert as { id: string }).id))
      : null;
  const linkedIncidentOid =
    created.incident && typeof created.incident === "object" && "id" in created.incident
      ? new mongoose.Types.ObjectId(String((created.incident as { id: string }).id))
      : null;

  const videoEvent = await VideoEvent.create({
    videoEventId: newVideoId("ve"),
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    cameraId: camera._id,
    campusId: camera.campusId,
    buildingId: camera.buildingId,
    floorId: camera.floor != null ? String(camera.floor) : null,
    zoneId: input.zoneId ?? null,
    eventType: input.eventType,
    confidence: input.confidence,
    timestamp: at,
    status: matchingRule?.action === "REVIEW" || !matchingRule ? "NEEDS_REVIEW" : "OPEN",
    severity,
    evidenceReference: null,
    linkedEventId: linkedEventOid,
    linkedAlertId: linkedAlertOid,
    linkedIncidentId: linkedIncidentOid,
    fingerprint: fp,
    modelId: input.modelId ?? null,
    modelVersion: input.modelVersion ?? null,
    demo: Boolean(input.demo),
    metadata: input.metadata ?? {},
  });

  // Correlate nearby cameras (spatiotemporal only — no identity claim)
  await maybeCorrelate(input.organizationId, videoEvent);

  await bumpUsage(input.organizationId, camera._id.toString(), {
    requests: 1,
    frames: 1,
    ms: 50,
    cost: 0.001,
  });

  await enqueueJob({
    type: "VIDEO_EVIDENCE_PROCESS",
    organizationId: input.organizationId,
    payload: { videoEventId: videoEvent.videoEventId },
    idempotencyKey: `ve_ev_${videoEvent.videoEventId}`,
  });

  return {
    ok: true,
    videoEventId: videoEvent.videoEventId,
    confidence: input.confidence,
    message: `AI detected ${input.eventType.replace(/_/g, " ").toLowerCase()} (confidence ${(input.confidence * 100).toFixed(0)}%) — not a confirmation`,
    linkedEvent: created.event?.eventId ?? null,
  };
}

async function maybeCorrelate(organizationId: string, videoEvent: InstanceType<typeof VideoEvent>) {
  const windowMs = 10_000;
  const nearby = await VideoEvent.find(
    orgFilter(organizationId, {
      videoEventId: { $ne: videoEvent.videoEventId },
      buildingId: videoEvent.buildingId,
      timestamp: {
        $gte: new Date(videoEvent.timestamp.getTime() - windowMs),
        $lte: new Date(videoEvent.timestamp.getTime() + windowMs),
      },
      cameraId: { $ne: videoEvent.cameraId },
    })
  ).limit(5);

  if (!nearby.length || !videoEvent.buildingId) return;

  const groupId = nearby.find((n) => n.eventGroupId)?.eventGroupId ?? newVideoId("evg");
  const ids = [videoEvent.videoEventId, ...nearby.map((n) => n.videoEventId)];
  const camIds = [videoEvent.cameraId, ...nearby.map((n) => n.cameraId)];

  await VideoEventGroup.findOneAndUpdate(
    orgFilter(organizationId, { groupId }),
    {
      $set: {
        label: `Related Event Group`,
        startedAt: videoEvent.timestamp,
        note: "Related by location/time — identity not assumed.",
        identityClaim: "RELATED_SPATIOTEMPORAL",
      },
      $addToSet: {
        videoEventIds: { $each: ids },
        cameraIds: { $each: camIds },
      },
      $setOnInsert: {
        groupId,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      },
    },
    { upsert: true }
  );

  await VideoEvent.updateMany(
    orgFilter(organizationId, { videoEventId: { $in: ids } }),
    { $set: { eventGroupId: groupId } }
  );
}

export async function recordCameraHealthTransition(opts: {
  organizationId: string;
  cameraId: string;
  status: string;
  health: string;
  message?: string;
  latencyMs?: number | null;
}) {
  await connectDB();
  await CameraHealthLog.create({
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    cameraId: new mongoose.Types.ObjectId(opts.cameraId),
    status: opts.status,
    health: opts.health,
    latencyMs: opts.latencyMs ?? null,
    frameRate: null,
    resolution: null,
    message: opts.message ?? "",
    at: new Date(),
  });
}

/**
 * When camera goes offline — emit CAMERA_OFFLINE into existing alert path.
 */
export async function handleCameraOffline(organizationId: string, cameraDbId: string) {
  await connectDB();
  const camera = await Camera.findOne(orgFilter(organizationId, { _id: cameraDbId }));
  if (!camera) return null;

  const prev = camera.status;
  if (prev === "OFFLINE") return { skipped: true };

  camera.status = "OFFLINE";
  camera.lastSeen = camera.lastSeen ?? new Date();
  await camera.save();

  await recordCameraHealthTransition({
    organizationId,
    cameraId: camera._id.toString(),
    status: "OFFLINE",
    health: "CRITICAL",
    message: "Camera offline",
  });

  const risk = {
    riskScore: 70,
    riskLevel: "HIGH" as const,
    riskFactors: ["Camera offline"],
  };

  const created = await createEventRecord({
    organizationId,
    cameraId: camera._id.toString(),
    eventType: "CAMERA_OFFLINE" as EventType,
    confidence: 1,
    source: "SYSTEM",
    severity: "HIGH",
    risk,
    metadata: { previousStatus: prev },
  });

  await enqueueJob({
    type: "WORKFLOW_EVENT",
    organizationId,
    payload: {
      eventType: "CAMERA_OFFLINE",
      eventId: created.event?.eventId ?? camera.cameraId,
      resourceId: camera.cameraId,
    },
    correlationId: `cam_off_${camera.cameraId}_${Date.now()}`,
  });

  return created;
}
