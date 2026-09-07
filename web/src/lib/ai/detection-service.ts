import { connectDB } from "@/lib/db/connect";
import type { EventSource, EventType } from "@/lib/monitoring/constants";
import type { AIModuleType } from "@/lib/ai/constants";
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

  queueMetrics.detectionJobs++;
  const orgSettings = await getOrCreateOrgAISettings(input.organizationId);
  const cameraConfig = await getOrCreateCameraAIConfig(input.organizationId, input.cameraId);
  const moduleConfig = cameraConfig.modules[input.moduleType];

  if (!moduleConfig?.enabled && input.source !== "TEST") {
    return { skipped: true, reason: "Module disabled for camera" };
  }

  const detector = getDetector(input.moduleType);
  if (!detector?.isAvailable() && input.source !== "TEST") {
    return { skipped: true, reason: "Detection unavailable — provider not configured" };
  }

  const frame: DetectionFrame = {
    cameraId: input.cameraId,
    organizationId: input.organizationId,
    timestamp: input.detectedAt ?? new Date(),
    moduleType: input.moduleType,
    metadata: { confidence: input.confidence, ...input.metadata },
  };

  let output: DetectionOutput | null = null;
  if (input.source === "TEST" && input.metadata?.eventType) {
    output = {
      moduleType: input.moduleType,
      eventType: input.metadata.eventType as EventType,
      confidence: input.confidence ?? 0.85,
      metadata: input.metadata,
      simulated: true,
    };
  } else {
    output = await detector!.detect(frame);
  }

  if (!output) return { skipped: true, reason: "No detection output" };

  const minConfidence = moduleConfig?.confidenceThreshold ?? orgSettings.defaultConfidenceThreshold;
  if (output.confidence != null && output.confidence < minConfidence) {
    return { skipped: true, reason: "Below confidence threshold" };
  }

  const zones = input.moduleType === "RESTRICTED_ZONE"
    ? await getActiveZonesForCamera(input.organizationId, input.cameraId)
    : [];

  const ruleResult = await evaluateRules({
    organizationId: input.organizationId,
    cameraId: input.cameraId,
    moduleType: input.moduleType,
    detection: output,
    zones,
    scheduleId: moduleConfig?.scheduleId ?? null,
    occupancyCapacity: cameraConfig.occupancyCapacity,
    occupancyThresholds: orgSettings.occupancyThresholds,
    at: frame.timestamp,
  });

  if (!ruleResult) return { skipped: true, reason: "Rule engine suppressed event" };

  const cooldown = moduleConfig?.cooldownSeconds ?? orgSettings.eventCooldownSeconds;
  if (!input.skipDedup) {
    const dup = await isDuplicateEvent(
      {
        organizationId: input.organizationId,
        cameraId: input.cameraId,
        eventType: ruleResult.eventType,
        zoneId: ruleResult.metadata.zoneId as string | undefined,
      },
      cooldown
    );
    if (dup) return { skipped: true, reason: "Cooldown deduplication" };
  }

  const relatedIds = await findRelatedEvents(
    input.organizationId,
    input.cameraId,
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
    organizationId: input.organizationId,
    cameraId: input.cameraId,
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

  emitToOrganization(input.organizationId, SOCKET_EVENTS.DETECTION_CREATED, {
    moduleType: input.moduleType,
    eventId: result.event.eventId,
    cameraId: input.cameraId,
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
