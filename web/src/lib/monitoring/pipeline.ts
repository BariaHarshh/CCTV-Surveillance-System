/**
 * Monitoring pipeline — delegates to EventEngine (Step 7).
 */
import { eventEngine } from "@/lib/monitoring/event-engine";
import type { CreateEventInput } from "@/lib/monitoring/event-service";

export interface StreamProcessorInput {
  cameraId: string;
  organizationId: string;
  streamUrl: string;
  protocol: string;
}

export interface DetectionEventPayload {
  eventType: CreateEventInput["eventType"];
  confidence: number | null;
  cameraId: string;
  organizationId: string;
  source?: CreateEventInput["source"];
  metadata?: Record<string, unknown>;
}

export async function enqueueStreamForProcessing(_input: StreamProcessorInput): Promise<void> {
  // Future: connect stream processor worker queue
}

export async function publishDetectionEvent(payload: DetectionEventPayload): Promise<void> {
  await eventEngine.ingestDetection({
    organizationId: payload.organizationId,
    cameraId: payload.cameraId,
    eventType: payload.eventType,
    confidence: payload.confidence,
    source: payload.source ?? "DETECTION",
    metadata: payload.metadata,
  });
}

export { eventEngine };
