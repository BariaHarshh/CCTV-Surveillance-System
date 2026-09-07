import type { EventType, SeverityLevel } from "@/lib/monitoring/constants";

export interface DetectionFrame {
  cameraId: string;
  organizationId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface DetectionResult {
  eventType: EventType;
  confidence: number | null;
  metadata?: Record<string, unknown>;
  simulated?: boolean;
}

export interface DetectionProvider {
  detect(frame: DetectionFrame): Promise<DetectionResult | null>;
}

export class MockDetectionProvider implements DetectionProvider {
  async detect(frame: DetectionFrame): Promise<DetectionResult | null> {
    // No automatic detections — only explicit test mode triggers events
    void frame;
    return null;
  }
}

export class ComputerVisionProvider implements DetectionProvider {
  async detect(_frame: DetectionFrame): Promise<DetectionResult | null> {
    // Placeholder for Step 8 AI modules
    return null;
  }
}

export const mockDetectionProvider = new MockDetectionProvider();
export const computerVisionProvider = new ComputerVisionProvider();
