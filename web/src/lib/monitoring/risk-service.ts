import type { EventType, SeverityLevel } from "@/lib/monitoring/constants";
import { riskLevelFromScore } from "@/lib/monitoring/constants";

export interface RiskInput {
  eventType: EventType;
  severity: SeverityLevel;
  confidence: number | null;
  afterHours?: boolean;
  relatedEventsCount?: number;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: SeverityLevel;
  riskFactors: string[];
}

const TYPE_SCORE: Partial<Record<EventType, number>> = {
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

export class RiskService {
  calculate(input: RiskInput): RiskResult {
    const factors: string[] = [];
    let score = TYPE_SCORE[input.eventType] ?? 15;
    factors.push(`Event type: ${input.eventType}`);

    score += SEVERITY_BOOST[input.severity];
    factors.push(`Severity: ${input.severity}`);

    if (input.confidence != null) {
      score += Math.round(input.confidence * 15);
      factors.push(`Confidence: ${Math.round(input.confidence * 100)}%`);
    } else {
      factors.push("Confidence unavailable");
    }

    if (input.afterHours) {
      score += 10;
      factors.push("After-hours activity");
    }

    if (input.relatedEventsCount && input.relatedEventsCount > 0) {
      score += Math.min(input.relatedEventsCount * 5, 15);
      factors.push(`Related events: ${input.relatedEventsCount}`);
    }

    score = Math.max(0, Math.min(100, score));
    return {
      riskScore: score,
      riskLevel: riskLevelFromScore(score),
      riskFactors: factors,
    };
  }
}

export const riskService = new RiskService();
