export const AI_MODULE_TYPES = [
  "PERSON_DETECTION",
  "OCCUPANCY_DETECTION",
  "RESTRICTED_ZONE",
  "AFTER_HOURS",
  "ABANDONED_OBJECT",
  "FIRE_DETECTION",
  "SMOKE_DETECTION",
  "PPE_DETECTION",
  "CAMERA_TAMPER",
] as const;

export type AIModuleType = (typeof AI_MODULE_TYPES)[number];

export const AI_MODULE_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "CONFIGURATION_REQUIRED",
  "ERROR",
  "MAINTENANCE",
] as const;

export type AIModuleStatus = (typeof AI_MODULE_STATUSES)[number];

export const AI_HEALTH_STATUSES = ["HEALTHY", "DEGRADED", "ERROR", "OFFLINE"] as const;
export type AIHealthStatus = (typeof AI_HEALTH_STATUSES)[number];

export const OCCUPANCY_LEVELS = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"] as const;
export type OccupancyLevel = (typeof OCCUPANCY_LEVELS)[number];

export const INCIDENT_STATUSES = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "DISMISSED"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const FEEDBACK_TYPES = [
  "CORRECT",
  "FALSE_POSITIVE",
  "INCORRECT_EVENT_TYPE",
  "INCORRECT_SEVERITY",
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const AI_PERMISSIONS = {
  view: ["ai:view"],
  configure: ["ai:configure"],
  detectionView: ["detection:view"],
  detectionConfigure: ["detection:configure"],
  incidentView: ["incident:view"],
  incidentManage: ["incident:manage"],
  riskView: ["risk:view"],
  eventFeedback: ["event:feedback"],
  cameraAiConfigure: ["camera:ai:configure"],
} as const;

export const DEFAULT_ORG_AI_SETTINGS = {
  defaultConfidenceThreshold: 0.7,
  eventCooldownSeconds: 30,
  occupancyThresholds: { elevated: 80, high: 90, critical: 100 },
  abandonedObjectThresholdSeconds: 120,
  afterHoursSeverity: "MEDIUM" as const,
  notificationRules: {
    critical: "IMMEDIATE",
    high: "IMMEDIATE",
    medium: "DASHBOARD",
    low: "TIMELINE",
  },
  dataRetention: {
    eventsDays: 90,
    snapshotsDays: 30,
    incidentsDays: 365,
    auditDays: 730,
  },
};

export const AI_MODULE_LABELS: Record<AIModuleType, string> = {
  PERSON_DETECTION: "Person Detection",
  OCCUPANCY_DETECTION: "Occupancy Detection",
  RESTRICTED_ZONE: "Restricted Area Detection",
  AFTER_HOURS: "After-Hours Detection",
  ABANDONED_OBJECT: "Abandoned Object Detection",
  FIRE_DETECTION: "Fire Detection",
  SMOKE_DETECTION: "Smoke Detection",
  PPE_DETECTION: "PPE Detection",
  CAMERA_TAMPER: "Camera Tampering",
};

export const MODULE_TO_EVENT: Partial<Record<AIModuleType, string>> = {
  PERSON_DETECTION: "PERSON_DETECTED",
  OCCUPANCY_DETECTION: "OCCUPANCY_HIGH",
  RESTRICTED_ZONE: "UNAUTHORIZED_ENTRY",
  AFTER_HOURS: "AFTER_HOURS_ACTIVITY",
  ABANDONED_OBJECT: "ABANDONED_OBJECT",
  FIRE_DETECTION: "FIRE_DETECTED",
  SMOKE_DETECTION: "SMOKE_DETECTED",
  PPE_DETECTION: "PPE_VIOLATION",
  CAMERA_TAMPER: "CAMERA_TAMPERED",
};

export function occupancyLevelFromPercent(
  pct: number,
  thresholds = DEFAULT_ORG_AI_SETTINGS.occupancyThresholds
): OccupancyLevel {
  if (pct >= thresholds.critical) return "CRITICAL";
  if (pct >= thresholds.high) return "HIGH";
  if (pct >= thresholds.elevated) return "ELEVATED";
  return "NORMAL";
}
