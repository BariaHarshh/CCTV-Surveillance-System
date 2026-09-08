import { PlatformSettings, type IPlatformSettings } from "@/models/Platform";
import { connectDB } from "@/lib/db/connect";

export type PlatformSettingsPublic = {
  platformName: string;
  supportEmail: string;
  supportUrl: string;
  defaultTimezone: string;
  defaultTheme: "day" | "night" | "system";
  allowOrganizationSelfService: boolean;
  requireMfaForAdmins: boolean;
  requireMfaForStaff: boolean;
  sessionIdleMinutes: number;
  sessionAbsoluteHours: number;
  maxConcurrentSessions: number;
  defaultAuditRetentionDays: number;
  defaultEvidenceRetentionDays: number;
  allowAiFeatures: boolean;
  allowVideoAi: boolean;
  allowAdvancedAnalytics: boolean;
  statusPageMessage: string;
  updatedBy: string;
  updatedAt: string | null;
};

export function toPlatformSettingsPublic(doc: IPlatformSettings): PlatformSettingsPublic {
  return {
    platformName: doc.platformName,
    supportEmail: doc.supportEmail,
    supportUrl: doc.supportUrl,
    defaultTimezone: doc.defaultTimezone,
    defaultTheme: doc.defaultTheme,
    allowOrganizationSelfService: doc.allowOrganizationSelfService,
    requireMfaForAdmins: doc.requireMfaForAdmins,
    requireMfaForStaff: doc.requireMfaForStaff,
    sessionIdleMinutes: doc.sessionIdleMinutes,
    sessionAbsoluteHours: doc.sessionAbsoluteHours,
    maxConcurrentSessions: doc.maxConcurrentSessions,
    defaultAuditRetentionDays: doc.defaultAuditRetentionDays,
    defaultEvidenceRetentionDays: doc.defaultEvidenceRetentionDays,
    allowAiFeatures: doc.allowAiFeatures,
    allowVideoAi: doc.allowVideoAi,
    allowAdvancedAnalytics: doc.allowAdvancedAnalytics,
    statusPageMessage: doc.statusPageMessage,
    updatedBy: doc.updatedBy,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

export async function getOrCreatePlatformSettings() {
  await connectDB();
  let doc = await PlatformSettings.findOne({ key: "default" });
  if (!doc) {
    doc = await PlatformSettings.create({ key: "default" });
  }
  return doc;
}

export type PlatformSettingsUpdate = Partial<
  Omit<PlatformSettingsPublic, "updatedBy" | "updatedAt">
>;

function clamp(n: number, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export async function updatePlatformSettings(patch: PlatformSettingsUpdate, updatedBy: string) {
  await connectDB();
  const doc = await getOrCreatePlatformSettings();

  if (typeof patch.platformName === "string") {
    doc.platformName = patch.platformName.trim().slice(0, 120) || "AI Campus Guardian";
  }
  if (typeof patch.supportEmail === "string") {
    doc.supportEmail = patch.supportEmail.trim().slice(0, 200);
  }
  if (typeof patch.supportUrl === "string") {
    doc.supportUrl = patch.supportUrl.trim().slice(0, 400);
  }
  if (typeof patch.defaultTimezone === "string" && patch.defaultTimezone.trim()) {
    doc.defaultTimezone = patch.defaultTimezone.trim().slice(0, 64);
  }
  if (patch.defaultTheme === "day" || patch.defaultTheme === "night" || patch.defaultTheme === "system") {
    doc.defaultTheme = patch.defaultTheme;
  }
  if (typeof patch.allowOrganizationSelfService === "boolean") {
    doc.allowOrganizationSelfService = patch.allowOrganizationSelfService;
  }
  if (typeof patch.requireMfaForAdmins === "boolean") {
    doc.requireMfaForAdmins = patch.requireMfaForAdmins;
  }
  if (typeof patch.requireMfaForStaff === "boolean") {
    doc.requireMfaForStaff = patch.requireMfaForStaff;
  }
  if (patch.sessionIdleMinutes != null) {
    doc.sessionIdleMinutes = clamp(patch.sessionIdleMinutes, 5, 1440, 60);
  }
  if (patch.sessionAbsoluteHours != null) {
    doc.sessionAbsoluteHours = clamp(patch.sessionAbsoluteHours, 1, 168, 12);
  }
  if (patch.maxConcurrentSessions != null) {
    doc.maxConcurrentSessions = clamp(patch.maxConcurrentSessions, 1, 50, 5);
  }
  if (patch.defaultAuditRetentionDays != null) {
    doc.defaultAuditRetentionDays = clamp(patch.defaultAuditRetentionDays, 30, 3650, 365);
  }
  if (patch.defaultEvidenceRetentionDays != null) {
    doc.defaultEvidenceRetentionDays = clamp(patch.defaultEvidenceRetentionDays, 7, 3650, 90);
  }
  if (typeof patch.allowAiFeatures === "boolean") {
    doc.allowAiFeatures = patch.allowAiFeatures;
  }
  if (typeof patch.allowVideoAi === "boolean") {
    doc.allowVideoAi = patch.allowVideoAi;
  }
  if (typeof patch.allowAdvancedAnalytics === "boolean") {
    doc.allowAdvancedAnalytics = patch.allowAdvancedAnalytics;
  }
  if (typeof patch.statusPageMessage === "string") {
    doc.statusPageMessage = patch.statusPageMessage.trim().slice(0, 500);
  }

  doc.updatedBy = updatedBy;
  await doc.save();
  return doc;
}

/** Non-secret runtime status for the settings console */
export function getPlatformRuntimeStatus() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    aiProvider: process.env.AI_PROVIDER ?? "NONE",
    emailProvider: process.env.EMAIL_PROVIDER ?? "CONSOLE",
    pushProvider: process.env.PUSH_PROVIDER || "UNSET",
    paymentProvider: process.env.PAYMENT_PROVIDER ?? "INTERNAL",
    mongodbConfigured: Boolean(process.env.MONGODB_URI),
    cameraEncryptionConfigured: Boolean(
      process.env.CAMERA_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
    ),
    webhookSecretConfigured: Boolean(
      process.env.PAYMENT_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET
    ),
    internalEventsKeyConfigured: Boolean(process.env.INTERNAL_EVENTS_API_KEY),
  };
}
