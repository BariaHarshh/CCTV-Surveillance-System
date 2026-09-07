import type { EventType, SeverityLevel } from "@/lib/monitoring/constants";

export interface SeverityInput {
  eventType: EventType;
  confidence: number | null;
  detectedAt: Date;
  locationSensitive?: boolean;
  afterHours?: boolean;
}

const TYPE_BASE: Partial<Record<EventType, SeverityLevel>> = {
  PERSON_DETECTED: "LOW",
  OCCUPANCY_HIGH: "MEDIUM",
  AFTER_HOURS_ACTIVITY: "MEDIUM",
  UNUSUAL_ACTIVITY: "MEDIUM",
  PPE_VIOLATION: "MEDIUM",
  ABANDONED_OBJECT: "HIGH",
  UNAUTHORIZED_ENTRY: "HIGH",
  CAMERA_TAMPERED: "HIGH",
  CAMERA_OFFLINE: "MEDIUM",
  FIRE_DETECTED: "CRITICAL",
  SMOKE_DETECTED: "CRITICAL",
  OTHER: "LOW",
};

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export class SeverityEngine {
  calculate(input: SeverityInput): SeverityLevel {
    let severity = TYPE_BASE[input.eventType] ?? "LOW";

    if (input.afterHours && SEVERITY_RANK[severity] < SEVERITY_RANK.MEDIUM) {
      severity = "MEDIUM";
    }

    if (input.locationSensitive && SEVERITY_RANK[severity] < SEVERITY_RANK.HIGH) {
      severity = "HIGH";
    }

    if (input.confidence != null) {
      if (input.confidence >= 0.9 && SEVERITY_RANK[severity] < SEVERITY_RANK.HIGH) {
        severity = "HIGH";
      } else if (input.confidence >= 0.75 && SEVERITY_RANK[severity] < SEVERITY_RANK.MEDIUM) {
        severity = "MEDIUM";
      }
    }

    return severity;
  }
}

export const severityEngine = new SeverityEngine();
