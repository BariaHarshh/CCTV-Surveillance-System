import type { EventType } from "@/lib/monitoring/constants";
import type { IRestrictedZone } from "@/models/RestrictedZone";
import { isAfterHours } from "@/lib/ai/schedule-service";
import { occupancyLevelFromPercent } from "@/lib/ai/constants";

export interface RuleEvaluationInput {
  organizationId: string;
  cameraId: string;
  moduleType: string;
  detection: {
    eventType?: EventType;
    confidence?: number | null;
    metadata?: Record<string, unknown>;
  };
  zones?: IRestrictedZone[];
  scheduleId?: string | null;
  occupancyCapacity?: number | null;
  occupancyThresholds?: { elevated: number; high: number; critical: number };
  at?: Date;
}

export interface RuleEvaluationResult {
  eventType: EventType;
  afterHours: boolean;
  restrictedZone: boolean;
  locationSensitive: boolean;
  occupancyLevel?: string;
  metadata: Record<string, unknown>;
}

export async function evaluateRules(input: RuleEvaluationInput): Promise<RuleEvaluationResult | null> {
  const at = input.at ?? new Date();
  const meta = { ...(input.detection.metadata ?? {}) };
  let eventType = input.detection.eventType;
  let afterHours = false;
  let restrictedZone = false;
  let locationSensitive = false;
  let occupancyLevel: string | undefined;

  if (input.moduleType === "AFTER_HOURS" && input.scheduleId) {
    afterHours = await isAfterHours(input.organizationId, input.scheduleId, at);
    if (afterHours) {
      eventType = "AFTER_HOURS_ACTIVITY";
      meta.afterHours = true;
    } else {
      return null;
    }
  }

  if (input.moduleType === "RESTRICTED_ZONE" && input.zones?.length) {
    const zoneId = meta.zoneId as string | undefined;
    const zone = input.zones.find((z) => z._id.toString() === zoneId || z.zoneId === zoneId);
    if (zone) {
      const violated = await isAfterHours(input.organizationId, zone.scheduleId?.toString() ?? null, at);
      if (violated || !zone.scheduleId) {
        restrictedZone = true;
        locationSensitive = true;
        eventType = "UNAUTHORIZED_ENTRY";
        meta.zoneId = zone._id.toString();
        meta.zoneName = zone.name;
        meta.ruleViolated = "Restricted area entry outside allowed schedule";
      }
    }
  }

  if (input.moduleType === "OCCUPANCY_DETECTION") {
    const count = Number(meta.currentCount ?? 0);
    const capacity = input.occupancyCapacity ?? Number(meta.capacity ?? 0);
    if (capacity <= 0) return null;
    const pct = Math.round((count / capacity) * 100);
    occupancyLevel = occupancyLevelFromPercent(pct, input.occupancyThresholds);
    meta.occupancyPercentage = pct;
    meta.currentCount = count;
    meta.capacity = capacity;
    if (occupancyLevel === "NORMAL") return null;
    eventType = "OCCUPANCY_HIGH";
  }

  if (!eventType) return null;

  return {
    eventType,
    afterHours,
    restrictedZone,
    locationSensitive,
    occupancyLevel,
    metadata: meta,
  };
}
