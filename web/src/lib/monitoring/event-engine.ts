import { createEvent, type CreateEventInput } from "@/lib/monitoring/event-service";
import type { DetectionProvider } from "@/lib/monitoring/detection/providers";
import { mockDetectionProvider } from "@/lib/monitoring/detection/providers";

/** Orchestrates detection → event → severity → risk → alert pipeline */
export class EventEngine {
  constructor(private readonly provider: DetectionProvider = mockDetectionProvider) {}

  async ingestDetection(input: CreateEventInput) {
    return createEvent(input);
  }

  async processFrame(frame: Parameters<DetectionProvider["detect"]>[0]) {
    const detection = await this.provider.detect(frame);
    if (!detection) return null;
    return createEvent({
      organizationId: frame.organizationId,
      cameraId: frame.cameraId,
      eventType: detection.eventType,
      confidence: detection.confidence,
      source: detection.simulated ? "TEST" : "DETECTION",
      metadata: detection.metadata,
    });
  }
}

export const eventEngine = new EventEngine();
