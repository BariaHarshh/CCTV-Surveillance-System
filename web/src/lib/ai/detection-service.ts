import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Camera } from "@/models/Camera";
import type { EventSource, EventType } from "@/lib/monitoring/constants";
import { MODULE_TO_EVENT, type AIModuleType } from "@/lib/ai/constants";
import { getOrCreateOrgAISettings, getOrCreateCameraAIConfig, seedDefaultModels } from "@/lib/ai/config-service";
import { isDuplicateEvent } from "@/lib/ai/deduplication";
import { evaluateRules } from "@/lib/ai/rule-engine";
import { getActiveZonesForCamera } from "@/lib/ai/zone-service";
import { getDetector, type DetectionFrame, type DetectionOutput } from "@/lib/ai/detection/providers";
import { findRelatedEvents } from "@/lib/ai/correlation-service";
import { riskEngine } from "@/lib/ai/risk-engine";
import { severityEngine } from "@/lib/monitoring/severity-engine";
import { createEventRecord } from "@/lib/ai/event-pipeline";
import { detectionQueue, eventQueue, queueMetrics } from "@/lib/ai/queue";
import { emitToOrganization } from "@/lib/monitoring/socket-emitter";
import { SOCKET_EVENTS } from "@/lib/monitoring/constants";

export interface ProcessDetectionInput {
  organizationId: string;
  cameraId: string;
  moduleType: AIModuleType;
  source?: EventSource;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
  detectedAt?: Date;
  skipDedup?: boolean;
}

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await seedDefaultModels();
    initialized = true;
  }
}

export async function processDetection(input: ProcessDetectionInput) {
  await ensureInit();
  await connectDB();

  // If input.cameraId is a human-readable ID (e.g. "CAM-000002"), resolve camera & organization
  const isCameraMongoId = mongoose.Types.ObjectId.isValid(input.cameraId);
  const cameraQuery = isCameraMongoId
    ? { $or: [{ _id: input.cameraId }, { cameraId: input.cameraId }] }
    : { cameraId: input.cameraId };
  const cameraDoc = await Camera.findOne(cameraQuery);
  const effectiveOrgId = cameraDoc?.organizationId ? cameraDoc.organizationId.toString() : input.organizationId;
  const effectiveCameraId = cameraDoc ? cameraDoc._id.toString() : input.cameraId;

  queueMetrics.detectionJobs++;
  const orgSettings = await getOrCreateOrgAISettings(effectiveOrgId);
  const cameraConfig = await getOrCreateCameraAIConfig(effectiveOrgId, effectiveCameraId);
  const moduleConfig = cameraConfig.modules[input.moduleType];

  const isPythonDetection = input.source === "DETECTION";
  const isTest = input.source === "TEST";

  const detector = getDetector(input.moduleType);
  if (!isPythonDetection && !isTest && !detector?.isAvailable()) {
    return { skipped: true, reason: "Detection unavailable — provider not configured" };
  }

  const frame: DetectionFrame = {
    cameraId: effectiveCameraId,
    organizationId: effectiveOrgId,
    timestamp: input.detectedAt ?? new Date(),
    moduleType: input.moduleType,
    metadata: { confidence: input.confidence, ...input.metadata },
  };

  let output: DetectionOutput | null = null;
  if ((isTest || isPythonDetection) && input.metadata) {
    const defaultEvent = (MODULE_TO_EVENT[input.moduleType] as EventType) || "PERSON_DETECTED";
    const evtType = (input.metadata.eventType as EventType) || defaultEvent;
    output = {
      moduleType: input.moduleType,
      eventType: evtType,
      confidence: input.confidence ?? 0.85,
      metadata: input.metadata,
      simulated: isTest,
    };
  } else if (detector?.isAvailable()) {
    output = await detector.detect(frame);
  }

  if (!output) return { skipped: true, reason: "No detection output" };

  const minConfidence = moduleConfig?.confidenceThreshold ?? orgSettings.defaultConfidenceThreshold;
  if (output.confidence != null && output.confidence < minConfidence) {
    return { skipped: true, reason: "Below confidence threshold" };
  }

  let ruleResult = null;
  if (isPythonDetection && output) {
    ruleResult = {
      eventType: output.eventType,
      afterHours: false,
      locationSensitive: false,
      restrictedZone: input.moduleType === "RESTRICTED_ZONE",
      occupancyLevel: (input.metadata?.crowdState as string) || "NORMAL",
      metadata: input.metadata || {},
    };
  } else {
    const zones = input.moduleType === "RESTRICTED_ZONE"
      ? await getActiveZonesForCamera(effectiveOrgId, effectiveCameraId)
      : [];

    ruleResult = await evaluateRules({
      organizationId: effectiveOrgId,
      cameraId: effectiveCameraId,
      moduleType: input.moduleType,
      detection: output,
      zones,
      scheduleId: moduleConfig?.scheduleId ?? null,
      occupancyCapacity: cameraConfig.occupancyCapacity,
      occupancyThresholds: orgSettings.occupancyThresholds,
      at: frame.timestamp,
    });
  }

  if (!ruleResult) return { skipped: true, reason: "Rule engine suppressed event" };

  const cooldown = moduleConfig?.cooldownSeconds ?? orgSettings.eventCooldownSeconds;
  if (!input.skipDedup) {
    const dup = await isDuplicateEvent(
      {
        organizationId: effectiveOrgId,
        cameraId: effectiveCameraId,
        eventType: ruleResult.eventType,
        zoneId: ruleResult.metadata.zoneId as string | undefined,
      },
      cooldown
    );
    if (dup) return { skipped: true, reason: "Cooldown deduplication" };
  }

  const relatedIds = await findRelatedEvents(
    effectiveOrgId,
    effectiveCameraId,
    ruleResult.eventType,
    frame.timestamp
  );

  const severity = severityEngine.calculate({
    eventType: ruleResult.eventType,
    confidence: output.confidence,
    detectedAt: frame.timestamp,
    afterHours: ruleResult.afterHours,
    locationSensitive: ruleResult.locationSensitive,
  });

  const risk = riskEngine.calculate({
    eventType: ruleResult.eventType,
    confidence: output.confidence,
    severity,
    afterHours: ruleResult.afterHours,
    restrictedZone: ruleResult.restrictedZone,
    occupancyLevel: ruleResult.occupancyLevel,
    relatedEventsCount: relatedIds.length,
    locationSensitive: ruleResult.locationSensitive,
  });

  const result = await createEventRecord({
    organizationId: effectiveOrgId,
    cameraId: effectiveCameraId,
    eventType: ruleResult.eventType,
    confidence: output.confidence,
    source: input.source ?? (output.simulated ? "TEST" : "DETECTION"),
    detectedAt: frame.timestamp,
    afterHours: ruleResult.afterHours,
    locationSensitive: ruleResult.locationSensitive,
    metadata: {
      ...ruleResult.metadata,
      moduleType: input.moduleType,
      boundingBox: output.boundingBox,
      riskFactors: risk.riskFactors,
      simulated: output.simulated ?? false,
    },
    severity,
    risk,
    relatedEventCount: relatedIds.length,
  });

  queueMetrics.eventJobs++;
  queueMetrics.lastProcessedAt = new Date();

  emitToOrganization(effectiveOrgId, SOCKET_EVENTS.DETECTION_CREATED, {
    moduleType: input.moduleType,
    eventId: result.event.eventId,
    cameraId: cameraDoc?.cameraId ?? input.cameraId,
    id: effectiveCameraId,
    metadata: result.event.metadata,
  });

  return result;
}

export function enqueueDetection(input: ProcessDetectionInput): Promise<string> {
  return detectionQueue.enqueue("detection", input as unknown as Record<string, unknown>);
}

detectionQueue.register("detection", async (job) => {
  await processDetection(job.payload as unknown as ProcessDetectionInput);
});

eventQueue.register("risk", async (job) => {
  void job;
});
