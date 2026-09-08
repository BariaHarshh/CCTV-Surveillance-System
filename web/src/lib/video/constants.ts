export const VIDEO_CAMERA_HEALTH = ["HEALTHY", "WARNING", "CRITICAL", "UNKNOWN"] as const;
export type VideoCameraHealth = (typeof VIDEO_CAMERA_HEALTH)[number];

export const VIDEO_AI_MODES = ["DISABLED", "ON_DEMAND", "SCHEDULED", "CONTINUOUS"] as const;
export type VideoAIMode = (typeof VIDEO_AI_MODES)[number];

export const VIDEO_DETECTION_CATEGORIES = [
  "PERSON_DETECTED",
  "CROWD_DETECTED",
  "RESTRICTED_AREA_ACTIVITY",
  "UNUSUAL_ACTIVITY",
  "OBJECT_DETECTED",
  "CAMERA_TAMPERING",
  "MOTION_EVENT",
] as const;

/** Sensitive categories — off by default */
export const VIDEO_SENSITIVE_CATEGORIES = ["PERSON_DETECTED", "CROWD_DETECTED"] as const;

export const VIDEO_EVENT_STATUSES = [
  "OPEN",
  "NEEDS_REVIEW",
  "CONFIRMED",
  "FALSE_POSITIVE",
  "IGNORED",
  "LINKED_INCIDENT",
] as const;

export const VIDEO_EVIDENCE_TYPES = ["SNAPSHOT", "VIDEO_CLIP", "METADATA", "PACKAGE"] as const;

export const VIDEO_EVIDENCE_ACTIONS = [
  "CREATED",
  "VIEWED",
  "DOWNLOADED",
  "SHARED",
  "ATTACHED_TO_INCIDENT",
  "ARCHIVED",
  "DELETED",
  "EXPORTED",
] as const;

export const VIDEO_MODEL_LIFECYCLE = [
  "DRAFT",
  "TESTING",
  "APPROVED",
  "DEPLOYED",
  "DISABLED",
  "ARCHIVED",
] as const;

export const VIDEO_GRID_LAYOUTS = [1, 2, 4, 6, 9, 16] as const;

export const VIDEO_WALL_PRESETS = [
  "MORNING",
  "NIGHT",
  "EMERGENCY",
  "PARKING",
  "ENTRANCE",
  "CRITICAL_AREAS",
  "CUSTOM",
] as const;

export const VIDEO_JOB_TYPES = [
  "VIDEO_AI_PROCESS",
  "VIDEO_CLIP_GENERATE",
  "VIDEO_EVIDENCE_PROCESS",
  "VIDEO_THUMBNAIL",
  "VIDEO_HEALTH_CHECK",
  "CAMERA_OFFLINE_CHECK",
] as const;

export const VIDEO_PERMISSIONS = {
  view: ["video:view", "camera:view", "monitoring:view"],
  live: ["video:live", "camera:view", "monitoring:view"],
  evidence: ["video:evidence", "incident:view", "org:view"],
  evidenceDownload: ["video:evidence:download", "org:edit"],
  configure: ["video:configure", "camera:edit", "org:edit"],
  review: ["video:review", "detection:review", "event:feedback", "org:edit"],
  aiConfigure: ["video:ai:configure", "camera:ai:configure", "ai:configure", "org:edit"],
} as const;

export const DEFAULT_DETECTION_COOLDOWN_SEC = 60;
export const DEFAULT_DEDUPE_WINDOW_SEC = 120;

export const VIDEO_RETENTION_PRESETS = [7, 30, 90] as const;
