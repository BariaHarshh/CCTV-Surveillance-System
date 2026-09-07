import crypto from "crypto";
import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  ANNOUNCEMENT_TYPES,
  FEATURE_KEYS,
  PLAN_IDS,
  PLATFORM_INCIDENT_TYPES,
  SUBSCRIPTION_STATUSES,
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_EVENTS,
  type FeatureKey,
  type PlanId,
  type SubscriptionStatus,
} from "@/lib/platform/constants";
import { INVITATION_STATUSES, type InvitationStatus } from "@/lib/platform/constants";

/* ─── Organization Profile / Branding ─── */
export interface IOrganizationProfile extends Document {
  organizationId: Types.ObjectId;
  timezone: string;
  language: string;
  currency: string;
  dateFormat: string;
  branding: {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    emailLogo: string;
    reportLogo: string;
  };
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
    expiryDays: number | null;
    historyCount: number;
  };
  sessionPolicy: {
    idleMinutes: number;
    absoluteHours: number;
    maxConcurrent: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationProfileSchema = new Schema<IOrganizationProfile>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    timezone: { type: String, default: "UTC" },
    language: { type: String, default: "en" },
    currency: { type: String, default: "USD" },
    dateFormat: { type: String, default: "YYYY-MM-DD" },
    branding: {
      logo: { type: String, default: "" },
      favicon: { type: String, default: "" },
      primaryColor: { type: String, default: "#38bdf8" },
      secondaryColor: { type: String, default: "#0f172a" },
      emailLogo: { type: String, default: "" },
      reportLogo: { type: String, default: "" },
    },
    passwordPolicy: {
      minLength: { type: Number, default: 10 },
      requireUppercase: { type: Boolean, default: true },
      requireLowercase: { type: Boolean, default: true },
      requireNumber: { type: Boolean, default: true },
      requireSpecial: { type: Boolean, default: true },
      expiryDays: { type: Number, default: null },
      historyCount: { type: Number, default: 3 },
    },
    sessionPolicy: {
      idleMinutes: { type: Number, default: 60 },
      absoluteHours: { type: Number, default: 12 },
      maxConcurrent: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

export const OrganizationProfile: Model<IOrganizationProfile> =
  mongoose.models.OrganizationProfile ??
  mongoose.model<IOrganizationProfile>("OrganizationProfile", OrganizationProfileSchema);

/* ─── Plan / Subscription / Invoice / Usage ─── */
export interface IPlan extends Document {
  planId: PlanId;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingInterval: "month" | "year";
  limits: Record<string, number>;
  features: FeatureKey[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    planId: { type: String, enum: PLAN_IDS, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    billingInterval: { type: String, enum: ["month", "year"], default: "month" },
    limits: { type: Schema.Types.Mixed, default: {} },
    features: [{ type: String, enum: FEATURE_KEYS }],
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Plan: Model<IPlan> = mongoose.models.Plan ?? mongoose.model<IPlan>("Plan", PlanSchema);

export interface ISubscription extends Document {
  subscriptionId: string;
  organizationId: Types.ObjectId;
  planId: PlanId;
  status: SubscriptionStatus;
  startedAt: Date;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
  provider: string;
  providerSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    subscriptionId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    planId: { type: String, enum: PLAN_IDS, required: true },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, required: true, index: true },
    startedAt: { type: Date, required: true },
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelledAt: { type: Date, default: null },
    provider: { type: String, default: "INTERNAL" },
    providerSubscriptionId: { type: String, default: null },
  },
  { timestamps: true }
);

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ?? mongoose.model<ISubscription>("Subscription", SubscriptionSchema);

export interface IInvoice extends Document {
  invoiceNumber: string;
  organizationId: Types.ObjectId;
  amount: number;
  currency: string;
  status: "DRAFT" | "OPEN" | "PAID" | "FAILED" | "VOID";
  periodStart: Date;
  periodEnd: Date;
  paidAt: Date | null;
  storageReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["DRAFT", "OPEN", "PAID", "FAILED", "VOID"], default: "OPEN", index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    storageReference: { type: String, default: null },
  },
  { timestamps: true }
);

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice ?? mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export interface IUsageRecord extends Document {
  organizationId: Types.ObjectId;
  period: string;
  users: number;
  cameras: number;
  aiEvents: number;
  storageMb: number;
  reports: number;
  apiRequests: number;
  notifications: number;
  updatedAt: Date;
  createdAt: Date;
}

const UsageRecordSchema = new Schema<IUsageRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    period: { type: String, required: true },
    users: { type: Number, default: 0 },
    cameras: { type: Number, default: 0 },
    aiEvents: { type: Number, default: 0 },
    storageMb: { type: Number, default: 0 },
    reports: { type: Number, default: 0 },
    apiRequests: { type: Number, default: 0 },
    notifications: { type: Number, default: 0 },
  },
  { timestamps: true }
);
UsageRecordSchema.index({ organizationId: 1, period: 1 }, { unique: true });

export const UsageRecord: Model<IUsageRecord> =
  mongoose.models.UsageRecord ?? mongoose.model<IUsageRecord>("UsageRecord", UsageRecordSchema);

/* ─── API Key / Webhook ─── */
export interface IApiKey extends Document {
  keyId: string;
  organizationId: Types.ObjectId;
  name: string;
  keyHash: string;
  prefix: string;
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: Types.ObjectId;
  createdByName: string;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    keyId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true },
    prefix: { type: String, required: true },
    permissions: [{ type: String }],
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, default: "" },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey ?? mongoose.model<IApiKey>("ApiKey", ApiKeySchema);

export interface IWebhookEndpoint extends Document {
  webhookId: string;
  organizationId: Types.ObjectId;
  url: string;
  secretHash: string;
  secretPrefix: string;
  events: string[];
  enabled: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEndpointSchema = new Schema<IWebhookEndpoint>(
  {
    webhookId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    url: { type: String, required: true },
    secretHash: { type: String, required: true },
    secretPrefix: { type: String, required: true },
    events: [{ type: String, enum: WEBHOOK_EVENTS }],
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const WebhookEndpoint: Model<IWebhookEndpoint> =
  mongoose.models.WebhookEndpoint ??
  mongoose.model<IWebhookEndpoint>("WebhookEndpoint", WebhookEndpointSchema);

export interface IWebhookDelivery extends Document {
  organizationId: Types.ObjectId;
  webhookId: string;
  event: string;
  endpoint: string;
  status: (typeof WEBHOOK_DELIVERY_STATUSES)[number];
  httpCode: number | null;
  attempt: number;
  durationMs: number | null;
  error: string | null;
  createdAt: Date;
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    webhookId: { type: String, required: true, index: true },
    event: { type: String, required: true },
    endpoint: { type: String, required: true },
    status: { type: String, enum: WEBHOOK_DELIVERY_STATUSES, required: true },
    httpCode: { type: Number, default: null },
    attempt: { type: Number, default: 1 },
    durationMs: { type: Number, default: null },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const WebhookDelivery: Model<IWebhookDelivery> =
  mongoose.models.WebhookDelivery ??
  mongoose.model<IWebhookDelivery>("WebhookDelivery", WebhookDeliverySchema);

/* ─── Invitation / Department / Custom Role ─── */
export interface IInvitation extends Document {
  invitationId: string;
  organizationId: Types.ObjectId;
  email: string;
  role: "ADMIN" | "STAFF";
  department: string;
  campusId: string | null;
  permissions: string[];
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedBy: Types.ObjectId;
  invitedByName: string;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    invitationId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ["ADMIN", "STAFF"], required: true },
    department: { type: String, default: "" },
    campusId: { type: String, default: null },
    permissions: [{ type: String }],
    tokenHash: { type: String, required: true },
    status: { type: String, enum: INVITATION_STATUSES, default: "PENDING", index: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invitedByName: { type: String, default: "" },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Invitation: Model<IInvitation> =
  mongoose.models.Invitation ?? mongoose.model<IInvitation>("Invitation", InvitationSchema);

export interface IDepartment extends Document {
  departmentId: string;
  organizationId: Types.ObjectId;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    departmentId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);
DepartmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Department: Model<IDepartment> =
  mongoose.models.Department ?? mongoose.model<IDepartment>("Department", DepartmentSchema);

export interface ICustomRole extends Document {
  roleId: string;
  organizationId: Types.ObjectId;
  name: string;
  description: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CustomRoleSchema = new Schema<ICustomRole>(
  {
    roleId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

export const CustomRole: Model<ICustomRole> =
  mongoose.models.CustomRole ?? mongoose.model<ICustomRole>("CustomRole", CustomRoleSchema);

/* ─── MFA ─── */
export interface IUserMfa extends Document {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId | null;
  enabled: boolean;
  secretEncrypted: string;
  recoveryCodeHashes: string[];
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserMfaSchema = new Schema<IUserMfa>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    enabled: { type: Boolean, default: false },
    secretEncrypted: { type: String, default: "" },
    recoveryCodeHashes: [{ type: String }],
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const UserMfa: Model<IUserMfa> =
  mongoose.models.UserMfa ?? mongoose.model<IUserMfa>("UserMfa", UserMfaSchema);

/* ─── Notification Preferences ─── */
export interface INotificationPreference extends Document {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  categories: Record<string, { inApp: boolean; email: boolean; push: boolean; sms: boolean }>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    categories: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
NotificationPreferenceSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const NotificationPreference: Model<INotificationPreference> =
  mongoose.models.NotificationPreference ??
  mongoose.model<INotificationPreference>("NotificationPreference", NotificationPreferenceSchema);

/* ─── Feature flags / Announcements / Platform incidents / Maintenance ─── */
export interface IFeatureFlag extends Document {
  key: string;
  enabled: boolean;
  environment: string;
  organizationIds: Types.ObjectId[];
  rolloutPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    environment: { type: String, default: "all" },
    organizationIds: [{ type: Schema.Types.ObjectId, ref: "Organization" }],
    rolloutPercentage: { type: Number, default: 100, min: 0, max: 100 },
  },
  { timestamps: true }
);

export const FeatureFlag: Model<IFeatureFlag> =
  mongoose.models.FeatureFlag ?? mongoose.model<IFeatureFlag>("FeatureFlag", FeatureFlagSchema);

export interface IAnnouncement extends Document {
  announcementId: string;
  type: (typeof ANNOUNCEMENT_TYPES)[number];
  title: string;
  message: string;
  target: "ALL" | "ADMINS" | "SPECIFIC";
  organizationIds: Types.ObjectId[];
  startsAt: Date;
  endsAt: Date | null;
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    announcementId: { type: String, required: true, unique: true },
    type: { type: String, enum: ANNOUNCEMENT_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    target: { type: String, enum: ["ALL", "ADMINS", "SPECIFIC"], default: "ALL" },
    organizationIds: [{ type: Schema.Types.ObjectId }],
    startsAt: { type: Date, default: () => new Date() },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ?? mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);

export interface IPlatformIncident extends Document {
  incidentId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  type: (typeof PLATFORM_INCIDENT_TYPES)[number];
  status: "OPEN" | "INVESTIGATING" | "RESOLVED";
  affectedServices: string[];
  description: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformIncidentSchema = new Schema<IPlatformIncident>(
  {
    incidentId: { type: String, required: true, unique: true },
    severity: { type: String, enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"], required: true },
    type: { type: String, enum: PLATFORM_INCIDENT_TYPES, required: true },
    status: { type: String, enum: ["OPEN", "INVESTIGATING", "RESOLVED"], default: "OPEN", index: true },
    affectedServices: [{ type: String }],
    description: { type: String, required: true },
    detectedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date, default: null },
    owner: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PlatformIncident: Model<IPlatformIncident> =
  mongoose.models.PlatformIncident ??
  mongoose.model<IPlatformIncident>("PlatformIncident", PlatformIncidentSchema);

export interface IMaintenanceMode extends Document {
  enabled: boolean;
  message: string;
  startTime: Date | null;
  expectedEnd: Date | null;
  affectedServices: string[];
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceModeSchema = new Schema<IMaintenanceMode>(
  {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: "System maintenance in progress." },
    startTime: { type: Date, default: null },
    expectedEnd: { type: Date, default: null },
    affectedServices: [{ type: String }],
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const MaintenanceMode: Model<IMaintenanceMode> =
  mongoose.models.MaintenanceMode ??
  mongoose.model<IMaintenanceMode>("MaintenanceMode", MaintenanceModeSchema);

/* ─── Evidence / Retention / Backup / Consent / Onboarding ─── */
export interface IEvidence extends Document {
  evidenceId: string;
  organizationId: Types.ObjectId;
  incidentId: Types.ObjectId | null;
  type: string;
  storageReference: string;
  hash: string;
  size: number;
  uploadedBy: Types.ObjectId | null;
  legalHold: boolean;
  retentionUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema = new Schema<IEvidence>(
  {
    evidenceId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", default: null, index: true },
    type: { type: String, default: "SNAPSHOT" },
    storageReference: { type: String, required: true },
    hash: { type: String, required: true },
    size: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    legalHold: { type: Boolean, default: false, index: true },
    retentionUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Evidence: Model<IEvidence> =
  mongoose.models.Evidence ?? mongoose.model<IEvidence>("Evidence", EvidenceSchema);

export interface IRetentionPolicy extends Document {
  organizationId: Types.ObjectId;
  eventsDays: number;
  alertsDays: number;
  incidentsDays: number;
  emergenciesDays: number;
  cameraMetadataDays: number;
  aiResultsDays: number;
  auditDays: number;
  reportsDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const RetentionPolicySchema = new Schema<IRetentionPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    eventsDays: { type: Number, default: 90 },
    alertsDays: { type: Number, default: 180 },
    incidentsDays: { type: Number, default: 365 },
    emergenciesDays: { type: Number, default: 730 },
    cameraMetadataDays: { type: Number, default: 90 },
    aiResultsDays: { type: Number, default: 90 },
    auditDays: { type: Number, default: 730 },
    reportsDays: { type: Number, default: 365 },
  },
  { timestamps: true }
);

export const RetentionPolicy: Model<IRetentionPolicy> =
  mongoose.models.RetentionPolicy ??
  mongoose.model<IRetentionPolicy>("RetentionPolicy", RetentionPolicySchema);

export interface IBackupRecord extends Document {
  backupId: string;
  type: "DATABASE" | "OBJECT_STORAGE" | "CONFIGURATION" | "FULL";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  encrypted: boolean;
  sizeBytes: number | null;
  storageReference: string | null;
  error: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BackupRecordSchema = new Schema<IBackupRecord>(
  {
    backupId: { type: String, required: true, unique: true },
    type: { type: String, enum: ["DATABASE", "OBJECT_STORAGE", "CONFIGURATION", "FULL"], required: true },
    status: { type: String, enum: ["QUEUED", "RUNNING", "COMPLETED", "FAILED"], default: "QUEUED" },
    encrypted: { type: Boolean, default: true },
    sizeBytes: { type: Number, default: null },
    storageReference: { type: String, default: null },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const BackupRecord: Model<IBackupRecord> =
  mongoose.models.BackupRecord ?? mongoose.model<IBackupRecord>("BackupRecord", BackupRecordSchema);

export interface IConsentRecord extends Document {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId | null;
  policyVersion: string;
  type: string;
  acceptedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

const ConsentRecordSchema = new Schema<IConsentRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    policyVersion: { type: String, required: true },
    type: { type: String, required: true },
    acceptedAt: { type: Date, default: () => new Date() },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ConsentRecord: Model<IConsentRecord> =
  mongoose.models.ConsentRecord ?? mongoose.model<IConsentRecord>("ConsentRecord", ConsentRecordSchema);

export interface IOnboardingProgress extends Document {
  organizationId: Types.ObjectId;
  steps: Record<string, boolean>;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingProgressSchema = new Schema<IOnboardingProgress>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    steps: { type: Schema.Types.Mixed, default: {} },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const OnboardingProgress: Model<IOnboardingProgress> =
  mongoose.models.OnboardingProgress ??
  mongoose.model<IOnboardingProgress>("OnboardingProgress", OnboardingProgressSchema);

/* ─── Global platform settings (singleton) ─── */
export interface IPlatformSettings extends Document {
  key: string;
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
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    platformName: { type: String, default: "AI Campus Guardian" },
    supportEmail: { type: String, default: "" },
    supportUrl: { type: String, default: "" },
    defaultTimezone: { type: String, default: "UTC" },
    defaultTheme: { type: String, enum: ["day", "night", "system"], default: "night" },
    allowOrganizationSelfService: { type: Boolean, default: false },
    requireMfaForAdmins: { type: Boolean, default: false },
    requireMfaForStaff: { type: Boolean, default: false },
    sessionIdleMinutes: { type: Number, default: 60, min: 5, max: 1440 },
    sessionAbsoluteHours: { type: Number, default: 12, min: 1, max: 168 },
    maxConcurrentSessions: { type: Number, default: 5, min: 1, max: 50 },
    defaultAuditRetentionDays: { type: Number, default: 365, min: 30, max: 3650 },
    defaultEvidenceRetentionDays: { type: Number, default: 90, min: 7, max: 3650 },
    allowAiFeatures: { type: Boolean, default: true },
    allowVideoAi: { type: Boolean, default: true },
    allowAdvancedAnalytics: { type: Boolean, default: true },
    statusPageMessage: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PlatformSettings: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ??
  mongoose.model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
