/** Step 11 — Production platform constants (single source of truth). */

export const PLAN_IDS = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const WEBHOOK_EVENTS = [
  "alert.created",
  "alert.updated",
  "incident.created",
  "incident.resolved",
  "emergency.created",
  "emergency.resolved",
  "camera.offline",
  "camera.online",
  "report.completed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_DELIVERY_STATUSES = ["SUCCESS", "FAILED", "RETRYING", "DISABLED"] as const;

export const FEATURE_KEYS = [
  "basic_analytics",
  "advanced_analytics",
  "ai_detection",
  "advanced_ai",
  "api_access",
  "multiple_campuses",
  "custom_retention",
  "webhooks",
  "executive_dashboard",
  "sso",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const DEFAULT_PLAN_LIMITS: Record<
  PlanId,
  {
    maxUsers: number;
    maxCampuses: number;
    maxBuildings: number;
    maxRooms: number;
    maxCameras: number;
    maxAiEventsPerMonth: number;
    maxStorageMb: number;
    maxReportsPerMonth: number;
    maxApiCallsPerDay: number;
    maxRetentionDays: number;
    features: FeatureKey[];
  }
> = {
  FREE: {
    maxUsers: 5,
    maxCampuses: 1,
    maxBuildings: 3,
    maxRooms: 20,
    maxCameras: 10,
    maxAiEventsPerMonth: 1000,
    maxStorageMb: 1024,
    maxReportsPerMonth: 5,
    maxApiCallsPerDay: 100,
    maxRetentionDays: 30,
    features: ["basic_analytics", "ai_detection"],
  },
  STARTER: {
    maxUsers: 25,
    maxCampuses: 1,
    maxBuildings: 10,
    maxRooms: 100,
    maxCameras: 50,
    maxAiEventsPerMonth: 25000,
    maxStorageMb: 10240,
    maxReportsPerMonth: 50,
    maxApiCallsPerDay: 2000,
    maxRetentionDays: 90,
    features: ["basic_analytics", "advanced_analytics", "ai_detection", "executive_dashboard"],
  },
  PROFESSIONAL: {
    maxUsers: 100,
    maxCampuses: 3,
    maxBuildings: 50,
    maxRooms: 500,
    maxCameras: 250,
    maxAiEventsPerMonth: 250000,
    maxStorageMb: 102400,
    maxReportsPerMonth: 500,
    maxApiCallsPerDay: 20000,
    maxRetentionDays: 365,
    features: [
      "basic_analytics",
      "advanced_analytics",
      "ai_detection",
      "advanced_ai",
      "api_access",
      "webhooks",
      "executive_dashboard",
      "custom_retention",
    ],
  },
  ENTERPRISE: {
    maxUsers: 10000,
    maxCampuses: 100,
    maxBuildings: 1000,
    maxRooms: 10000,
    maxCameras: 10000,
    maxAiEventsPerMonth: 10000000,
    maxStorageMb: 1048576,
    maxReportsPerMonth: 10000,
    maxApiCallsPerDay: 1000000,
    maxRetentionDays: 2555,
    features: [...FEATURE_KEYS],
  },
};

export const PLATFORM_ERROR_CODES = [
  "AUTH_REQUIRED",
  "PERMISSION_DENIED",
  "RESOURCE_NOT_FOUND",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "PLAN_LIMIT_REACHED",
  "FEATURE_NOT_AVAILABLE",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
  "MAINTENANCE_MODE",
] as const;

export const ANNOUNCEMENT_TYPES = [
  "MAINTENANCE",
  "NEW_FEATURE",
  "IMPORTANT_NOTICE",
  "SECURITY_NOTICE",
] as const;

export const PLATFORM_INCIDENT_TYPES = [
  "AUTHENTICATION_ATTACK",
  "DATA_BREACH",
  "SERVICE_OUTAGE",
  "API_ABUSE",
  "MALWARE",
  "CONFIGURATION_ERROR",
  "THIRD_PARTY_FAILURE",
  "OTHER",
] as const;

export const MFA_RECOVERY_CODE_COUNT = 10;
export const DEFAULT_TRIAL_DAYS = 14;
