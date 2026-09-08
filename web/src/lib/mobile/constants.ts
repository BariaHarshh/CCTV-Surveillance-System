/**
 * Step 16 — Mobile / Field Operations constants.
 * Extends ResponseTask / ResponseTeam / Notification — does not replace them.
 */

export const FIELD_STAFF_STATUSES = [
  "AVAILABLE",
  "BUSY",
  "RESPONDING",
  "ON_SCENE",
  "OFF_DUTY",
  "UNAVAILABLE",
] as const;
export type FieldStaffStatus = (typeof FIELD_STAFF_STATUSES)[number];

export const CONNECTION_STATES = ["ONLINE", "OFFLINE", "SYNCING"] as const;

export const OFFLINE_OPS = ["CREATE", "UPDATE", "COMPLETE", "UPLOAD"] as const;

export const SYNC_CONFLICT_RESOLUTIONS = [
  "KEEP_SERVER",
  "KEEP_LOCAL",
  "REVIEW",
] as const;

export const CHECKIN_STATUSES = ["I_AM_SAFE", "I_NEED_ASSISTANCE", "ON_SCENE"] as const;

export const MESSAGE_CHANNEL_KINDS = ["INCIDENT", "EMERGENCY", "TEAM", "TASK"] as const;

export const MESSAGE_STATUSES = ["VISIBLE", "EDITED", "SOFT_DELETED"] as const;

export const ANNOUNCEMENT_KINDS = [
  "GENERAL",
  "CAMPUS",
  "DEPARTMENT",
  "EMERGENCY",
  "MAINTENANCE",
] as const;

export const INSPECTION_RESULT_STATUSES = ["PASS", "FAIL", "WARNING", "NOT_APPLICABLE"] as const;

export const INSPECTION_RUN_STATUSES = ["SCHEDULED", "ACTIVE", "COMPLETED", "OVERDUE"] as const;

export const PATROL_RUN_STATUSES = [
  "SCHEDULED",
  "STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "MISSED",
] as const;

export const EQUIPMENT_STATUSES = [
  "AVAILABLE",
  "CHECKED_OUT",
  "MAINTENANCE",
  "RETIRED",
] as const;

export const CERT_STATUSES = ["VALID", "EXPIRING", "EXPIRED", "UNKNOWN"] as const;

export const PUSH_DELIVERY_STATES = [
  "CREATED",
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
] as const;

export const NOTIFICATION_UI_CATEGORIES = [
  "ALERTS",
  "TASKS",
  "INCIDENTS",
  "EMERGENCY",
  "SYSTEM",
  "ANNOUNCEMENTS",
] as const;

export const MOBILE_PERMISSIONS = {
  fieldView: "response_task:view",
  fieldManage: "response_task:manage",
  teamView: "response_team:view",
  teamManage: "response_team:manage",
  emergencyView: "emergency:view",
  emergencyManage: "emergency:manage",
  incidentManage: "incident:manage",
} as const;

export function newMobileId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
