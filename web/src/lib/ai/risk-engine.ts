import type { EventType, SeverityLevel } from "@/lib/monitoring/constants";
import { riskLevelFromScore } from "@/lib/monitoring/constants";

export interface RiskEngineInput {
  eventType: EventType;
  confidence: number | null;
  severity: SeverityLevel;
  afterHours?: boolean;
  restrictedZone?: boolean;
  occupancyLevel?: string;
  cameraStatus?: string;
  relatedEventsCount?: number;
  locationSensitive?: boolean;
}

export interface RiskEngineResult {
  riskScore: number;
  riskLevel: SeverityLevel;
  riskFactors: string[];
}

const TYPE_BASE: Partial<Record<EventType, number>> = {
  PERSON_DETECTED: 10,
  OCCUPANCY_HIGH: 25,
  AFTER_HOURS_ACTIVITY: 35,
  UNUSUAL_ACTIVITY: 40,
  PPE_VIOLATION: 45,
  ABANDONED_OBJECT: 55,
  UNAUTHORIZED_ENTRY: 70,
  CAMERA_TAMPERED: 60,
  CAMERA_OFFLINE: 30,
  FIRE_DETECTED: 95,
  SMOKE_DETECTED: 90,
  OTHER: 15,
};

const SEVERITY_BOOST: Record<SeverityLevel, number> = {
  LOW: 0,
  MEDIUM: 10,
  HIGH: 20,
  CRITICAL: 30,
};

export class RiskEngine {
  calculate(input: RiskEngineInput): RiskEngineResult {
    const factors: string[] = [];
    let score = TYPE_BASE[input.eventType] ?? 15;
    factors.push(`Event type: ${input.eventType}`);

    score += SEVERITY_BOOST[input.severity];
    factors.push(`Severity: ${input.severity}`);

    if (input.confidence != null) {
      score += Math.round(input.confidence * 15);
      if (input.confidence >= 0.85) factors.push("High confidence");
      else factors.push(`Confidence: ${Math.round(input.confidence * 100)}%`);
    } else {
      factors.push("Confidence unavailable");
    }

    if (input.afterHours) {
      score += 12;
      factors.push("After-hours activity");
    }

    if (input.restrictedZone) {
      score += 18;
      factors.push("Restricted zone");
    }

    if (input.locationSensitive) {
      score += 8;
      factors.push("Critical location");
    }

    if (input.occupancyLevel === "CRITICAL") {
      score += 15;
      factors.push("Critical occupancy");
    } else if (input.occupancyLevel === "HIGH") {
      score += 10;
      factors.push("High occupancy");
    }

    if (input.relatedEventsCount && input.relatedEventsCount > 0) {
      const boost = Math.min(input.relatedEventsCount * 5, 20);
      score += boost;
      factors.push(`Related events: ${input.relatedEventsCount}`);
    }

    if (input.cameraStatus === "ERROR") {
      score += 5;
      factors.push("Camera error state");
    }

    score = Math.max(0, Math.min(100, score));
    return {
      riskScore: score,
      riskLevel: riskLevelFromScore(score),
      riskFactors: factors,
    };
  }
}

export const riskEngine = new RiskEngine();
