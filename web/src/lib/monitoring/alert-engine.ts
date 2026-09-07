import type { EventType, SeverityLevel } from "@/lib/monitoring/constants";

/** Events that should generate alerts when severity meets threshold */
const ALERT_EVENT_TYPES = new Set<EventType>([
  "UNAUTHORIZED_ENTRY",
  "AFTER_HOURS_ACTIVITY",
  "ABANDONED_OBJECT",
  "FIRE_DETECTED",
  "SMOKE_DETECTED",
  "UNUSUAL_ACTIVITY",
  "PPE_VIOLATION",
  "CAMERA_TAMPERED",
  "CAMERA_OFFLINE",
  "OCCUPANCY_HIGH",
]);

const SEVERITY_THRESHOLD: Record<SeverityLevel, boolean> = {
  LOW: false,
  MEDIUM: true,
  HIGH: true,
  CRITICAL: true,
};

export interface AlertRuleInput {
  eventType: EventType;
  severity: SeverityLevel;
  riskScore: number;
  source: string;
}

export class AlertEngine {
  shouldCreateAlert(input: AlertRuleInput): boolean {
    if (!ALERT_EVENT_TYPES.has(input.eventType)) {
      return false;
    }
    if (!SEVERITY_THRESHOLD[input.severity]) {
      return false;
    }
    if (input.riskScore < 25 && input.severity === "MEDIUM") {
      return input.eventType === "UNAUTHORIZED_ENTRY" || input.eventType === "CAMERA_OFFLINE";
    }
    return true;
  }

  buildTitle(eventType: EventType, locationLabel: string): string {
    const label = eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return locationLabel ? `${label} — ${locationLabel}` : label;
  }
}

export const alertEngine = new AlertEngine();
