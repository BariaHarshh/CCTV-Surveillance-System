export const EVENT_TYPES = [
  "PERSON_DETECTED",
  "UNAUTHORIZED_ENTRY",
  "AFTER_HOURS_ACTIVITY",
  "OCCUPANCY_HIGH",
  "ABANDONED_OBJECT",
  "FIRE_DETECTED",
  "SMOKE_DETECTED",
  "UNUSUAL_ACTIVITY",
  "PPE_VIOLATION",
  "CAMERA_TAMPERED",
  "CAMERA_OFFLINE",
  "OTHER",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const EVENT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED", "FALSE_POSITIVE"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const ALERT_STATUSES = ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "DISMISSED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const EVENT_SOURCES = ["DETECTION", "SYSTEM", "TEST", "MANUAL"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const NOTIFICATION_TYPES = [
  "ALERT",
  "EVENT",
  "SYSTEM",
  "SECURITY",
  "TASK",
  "INCIDENT",
  "EMERGENCY",
  "ANNOUNCEMENT",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MONITORING_PERMISSIONS = {
  view: ["monitoring:view", "monitoring:cameras", "monitoring:dashboard"],
  events: ["monitoring:events", "event:view"],
  alerts: ["monitoring:alerts", "alert:view"],
  alertAck: ["alert:acknowledge"],
  alertInvestigate: ["alert:investigate"],
  alertResolve: ["alert:resolve"],
  alertDismiss: ["alert:dismiss"],
  notifications: ["notifications:view"],
} as const;

export const SOCKET_EVENTS = {
  CAMERA_STATUS: "camera:status",
  EVENT_CREATED: "event:created",
  EVENT_UPDATED: "event:updated",
  ALERT_CREATED: "alert:created",
  ALERT_UPDATED: "alert:updated",
  NOTIFICATION_CREATED: "notification:created",
  INCIDENT_UPDATED: "incident:updated",
  DETECTION_CREATED: "detection:created",
  EMERGENCY_CREATED: "emergency:created",
  EMERGENCY_UPDATED: "emergency:updated",
  EMERGENCY_RESOLVED: "emergency:resolved",
  INCIDENT_ASSIGNED: "incident:assigned",
  INCIDENT_TASK_CREATED: "incident:task-created",
  INCIDENT_TASK_UPDATED: "incident:task-updated",
  ESCALATION_TRIGGERED: "escalation:triggered",
} as const;

export function orgChannel(organizationId: string): string {
  return `organization:${organizationId}`;
}

export function riskLevelFromScore(score: number): SeverityLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}
