import type { EventType } from "@/lib/monitoring/constants";
import type { AIModuleType } from "@/lib/ai/constants";

export interface DetectionFrame {
  cameraId: string;
  organizationId: string;
  timestamp: Date;
  moduleType: AIModuleType;
  metadata?: Record<string, unknown>;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectionOutput {
  moduleType: AIModuleType;
  eventType: EventType;
  confidence: number | null;
  boundingBox?: BoundingBox;
  metadata?: Record<string, unknown>;
  simulated?: boolean;
}

export interface ModuleDetector {
  readonly moduleType: AIModuleType;
  isAvailable(): boolean;
  detect(frame: DetectionFrame): Promise<DetectionOutput | null>;
}

export class PersonDetectionProvider implements ModuleDetector {
  readonly moduleType = "PERSON_DETECTION" as const;
  isAvailable() { return true; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    if (frame.metadata?.personDetected === false) return null;
    return {
      moduleType: "PERSON_DETECTION",
      eventType: "PERSON_DETECTED",
      confidence: typeof frame.metadata?.confidence === "number" ? frame.metadata.confidence : null,
      boundingBox: frame.metadata?.boundingBox as BoundingBox | undefined,
      metadata: { label: "person", ...frame.metadata },
    };
  }
}

export class OccupancyDetectionProvider implements ModuleDetector {
  readonly moduleType = "OCCUPANCY_DETECTION" as const;
  isAvailable() { return true; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    const count = frame.metadata?.currentCount;
    if (count == null) return null;
    return {
      moduleType: "OCCUPANCY_DETECTION",
      eventType: "OCCUPANCY_HIGH",
      confidence: null,
      metadata: { currentCount: count, capacity: frame.metadata?.capacity },
    };
  }
}

export class ZoneDetectionProvider implements ModuleDetector {
  readonly moduleType = "RESTRICTED_ZONE" as const;
  isAvailable() { return true; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    if (!frame.metadata?.zoneId) return null;
    return {
      moduleType: "RESTRICTED_ZONE",
      eventType: "UNAUTHORIZED_ENTRY",
      confidence: typeof frame.metadata?.confidence === "number" ? frame.metadata.confidence : 0.85,
      metadata: frame.metadata,
    };
  }
}

export class ActivityDetectionProvider implements ModuleDetector {
  readonly moduleType = "AFTER_HOURS" as const;
  isAvailable() { return true; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    return {
      moduleType: "AFTER_HOURS",
      eventType: "AFTER_HOURS_ACTIVITY",
      confidence: typeof frame.metadata?.confidence === "number" ? frame.metadata.confidence : 0.75,
      metadata: frame.metadata,
    };
  }
}

export class ObjectDetectionProvider implements ModuleDetector {
  readonly moduleType = "ABANDONED_OBJECT" as const;
  isAvailable() { return true; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    if (!frame.metadata?.objectType) return null;
    return {
      moduleType: "ABANDONED_OBJECT",
      eventType: "ABANDONED_OBJECT",
      confidence: typeof frame.metadata?.confidence === "number" ? frame.metadata.confidence : 0.7,
      metadata: frame.metadata,
    };
  }
}

export class FireSmokeDetectionProvider implements ModuleDetector {
  readonly moduleType: AIModuleType;
  private available: boolean;
  constructor(type: "FIRE_DETECTION" | "SMOKE_DETECTION", available = false) {
    this.moduleType = type;
    this.available = available;
  }
  isAvailable() { return this.available; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    if (!this.available) return null;
    return {
      moduleType: this.moduleType,
      eventType: this.moduleType === "FIRE_DETECTION" ? "FIRE_DETECTED" : "SMOKE_DETECTED",
      confidence: typeof frame.metadata?.confidence === "number" ? frame.metadata.confidence : null,
      metadata: frame.metadata,
    };
  }
}

export class PPEDetectionProvider implements ModuleDetector {
  readonly moduleType = "PPE_DETECTION" as const;
  isAvailable() { return true; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    if (!frame.metadata?.missingEquipment) return null;
    return {
      moduleType: "PPE_DETECTION",
      eventType: "PPE_VIOLATION",
      confidence: typeof frame.metadata?.confidence === "number" ? frame.metadata.confidence : 0.8,
      metadata: frame.metadata,
    };
  }
}

export class CameraTamperDetector implements ModuleDetector {
  readonly moduleType = "CAMERA_TAMPER" as const;
  isAvailable() { return true; }
  async detect(frame: DetectionFrame): Promise<DetectionOutput | null> {
    if (!frame.metadata?.tamperType) return null;
    return {
      moduleType: "CAMERA_TAMPER",
      eventType: "CAMERA_TAMPERED",
      confidence: typeof frame.metadata?.confidence === "number" ? frame.metadata.confidence : 0.9,
      metadata: frame.metadata,
    };
  }
}

export const detectors: ModuleDetector[] = [
  new PersonDetectionProvider(),
  new OccupancyDetectionProvider(),
  new ZoneDetectionProvider(),
  new ActivityDetectionProvider(),
  new ObjectDetectionProvider(),
  new FireSmokeDetectionProvider("FIRE_DETECTION", false),
  new FireSmokeDetectionProvider("SMOKE_DETECTION", false),
  new PPEDetectionProvider(),
  new CameraTamperDetector(),
];

export function getDetector(moduleType: AIModuleType): ModuleDetector | undefined {
  return detectors.find((d) => d.moduleType === moduleType);
}
