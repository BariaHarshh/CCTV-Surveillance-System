import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import crypto from "crypto";
import {
  VIDEO_AI_MODES,
  VIDEO_DETECTION_CATEGORIES,
  VIDEO_EVENT_STATUSES,
  VIDEO_EVIDENCE_ACTIONS,
  VIDEO_EVIDENCE_TYPES,
  VIDEO_MODEL_LIFECYCLE,
  VIDEO_WALL_PRESETS,
} from "@/lib/video/constants";

export function newVideoId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/* ─── VideoEvent (video intelligence layer; links to existing Event) ─── */
export interface IVideoEvent extends Document {
  videoEventId: string;
  organizationId: Types.ObjectId;
  cameraId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  buildingId: Types.ObjectId | null;
  floorId: string | null;
  zoneId: string | null;
  eventType: string;
  confidence: number | null;
  timestamp: Date;
  status: (typeof VIDEO_EVENT_STATUSES)[number];
  severity: string;
  evidenceReference: string | null;
  linkedEventId: Types.ObjectId | null;
  linkedAlertId: Types.ObjectId | null;
  linkedIncidentId: Types.ObjectId | null;
  eventGroupId: string | null;
  fingerprint: string;
  modelId: string | null;
  modelVersion: string | null;
  demo: boolean;
  metadata: Record<string, unknown>;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  reviewNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoEventSchema = new Schema<IVideoEvent>(
  {
    videoEventId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, default: null },
    buildingId: { type: Schema.Types.ObjectId, default: null },
    floorId: { type: String, default: null },
    zoneId: { type: String, default: null },
    eventType: { type: String, required: true, index: true },
    confidence: { type: Number, default: null },
    timestamp: { type: Date, required: true, index: true },
    status: { type: String, enum: VIDEO_EVENT_STATUSES, default: "NEEDS_REVIEW", index: true },
    severity: { type: String, default: "LOW" },
    evidenceReference: { type: String, default: null },
    linkedEventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    linkedAlertId: { type: Schema.Types.ObjectId, ref: "Alert", default: null },
    linkedIncidentId: { type: Schema.Types.ObjectId, ref: "Incident", default: null },
    eventGroupId: { type: String, default: null, index: true },
    fingerprint: { type: String, required: true, index: true },
    modelId: { type: String, default: null },
    modelVersion: { type: String, default: null },
    demo: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    reviewedBy: { type: Schema.Types.ObjectId, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true }
);
VideoEventSchema.index({ organizationId: 1, timestamp: -1 });
VideoEventSchema.index({ organizationId: 1, fingerprint: 1, timestamp: -1 });
VideoEventSchema.index({ organizationId: 1, status: 1, timestamp: -1 });

export const VideoEvent: Model<IVideoEvent> =
  mongoose.models.VideoEvent ?? mongoose.model<IVideoEvent>("VideoEvent", VideoEventSchema);

/* ─── Event group (multi-camera correlation) ─── */
export interface IVideoEventGroup extends Document {
  groupId: string;
  organizationId: Types.ObjectId;
  label: string;
  videoEventIds: string[];
  cameraIds: Types.ObjectId[];
  startedAt: Date;
  endedAt: Date | null;
  note: string;
  /** Never claim same person/object without validated basis */
  identityClaim: "NONE" | "RELATED_SPATIOTEMPORAL";
  createdAt: Date;
  updatedAt: Date;
}

const VideoEventGroupSchema = new Schema<IVideoEventGroup>(
  {
    groupId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    label: { type: String, default: "" },
    videoEventIds: { type: [String], default: [] },
    cameraIds: { type: [Schema.Types.ObjectId], default: [] },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    note: { type: String, default: "Related by location/time/zone — identity not assumed." },
    identityClaim: { type: String, enum: ["NONE", "RELATED_SPATIOTEMPORAL"], default: "RELATED_SPATIOTEMPORAL" },
  },
  { timestamps: true }
);

export const VideoEventGroup: Model<IVideoEventGroup> =
  mongoose.models.VideoEventGroup ??
  mongoose.model<IVideoEventGroup>("VideoEventGroup", VideoEventGroupSchema);

/* ─── Privacy mask zones (camera-frame) ─── */
export interface IPrivacyZone extends Document {
  zoneId: string;
  organizationId: Types.ObjectId;
  cameraId: Types.ObjectId;
  name: string;
  geometry: Array<{ x: number; y: number }>;
  status: "ACTIVE" | "INACTIVE";
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PrivacyZoneSchema = new Schema<IPrivacyZone>(
  {
    zoneId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    geometry: { type: [{ x: Number, y: Number }], default: [] },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const PrivacyZone: Model<IPrivacyZone> =
  mongoose.models.PrivacyZone ?? mongoose.model<IPrivacyZone>("PrivacyZone", PrivacyZoneSchema);

/* ─── Detection rules ─── */
export interface IVideoDetectionRule extends Document {
  ruleId: string;
  organizationId: Types.ObjectId;
  name: string;
  detectionType: string;
  cameraIds: Types.ObjectId[];
  groupId: string | null;
  zoneId: string | null;
  schedule: { afterHoursOnly: boolean; days: number[]; startHour: number; endHour: number } | null;
  confidenceThreshold: number;
  cooldownSec: number;
  severity: string;
  action: "ALERT" | "INCIDENT" | "REVIEW" | "NONE";
  enabled: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoDetectionRuleSchema = new Schema<IVideoDetectionRule>(
  {
    ruleId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    detectionType: { type: String, required: true },
    cameraIds: { type: [Schema.Types.ObjectId], default: [] },
    groupId: { type: String, default: null },
    zoneId: { type: String, default: null },
    schedule: { type: Schema.Types.Mixed, default: null },
    confidenceThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
    cooldownSec: { type: Number, default: 60 },
    severity: { type: String, default: "MEDIUM" },
    action: { type: String, enum: ["ALERT", "INCIDENT", "REVIEW", "NONE"], default: "REVIEW" },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const VideoDetectionRule: Model<IVideoDetectionRule> =
  mongoose.models.VideoDetectionRule ??
  mongoose.model<IVideoDetectionRule>("VideoDetectionRule", VideoDetectionRuleSchema);

/* ─── Org video AI policy ─── */
export interface IVideoAIPolicy extends Document {
  organizationId: Types.ObjectId;
  processingMode: (typeof VIDEO_AI_MODES)[number];
  allowedCategories: string[];
  enabledCameraIds: Types.ObjectId[];
  dailyAiCallLimit: number;
  perCameraDailyLimit: number;
  framesPerSecondLimit: number;
  eventsPerMinuteLimit: number;
  evidenceRetentionDays: number;
  recordingRetentionDays: number;
  snapshotRetentionDays: number;
  requireApprovalForSensitiveEvidence: boolean;
  demoMode: boolean;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoAIPolicySchema = new Schema<IVideoAIPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, unique: true },
    processingMode: { type: String, enum: VIDEO_AI_MODES, default: "ON_DEMAND" },
    allowedCategories: {
      type: [String],
      default: () =>
        VIDEO_DETECTION_CATEGORIES.filter(
          (c) => c !== "PERSON_DETECTED" && c !== "CROWD_DETECTED"
        ),
    },
    enabledCameraIds: { type: [Schema.Types.ObjectId], default: [] },
    dailyAiCallLimit: { type: Number, default: 10_000 },
    perCameraDailyLimit: { type: Number, default: 500 },
    framesPerSecondLimit: { type: Number, default: 2 },
    eventsPerMinuteLimit: { type: Number, default: 30 },
    evidenceRetentionDays: { type: Number, default: 30 },
    recordingRetentionDays: { type: Number, default: 7 },
    snapshotRetentionDays: { type: Number, default: 30 },
    requireApprovalForSensitiveEvidence: { type: Boolean, default: true },
    demoMode: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const VideoAIPolicy: Model<IVideoAIPolicy> =
  mongoose.models.VideoAIPolicy ?? mongoose.model<IVideoAIPolicy>("VideoAIPolicy", VideoAIPolicySchema);

/* ─── Camera groups ─── */
export interface ICameraGroup extends Document {
  groupId: string;
  organizationId: Types.ObjectId;
  name: string;
  kind: string;
  cameraIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CameraGroupSchema = new Schema<ICameraGroup>(
  {
    groupId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    kind: { type: String, default: "CUSTOM" },
    cameraIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

export const CameraGroup: Model<ICameraGroup> =
  mongoose.models.CameraGroup ?? mongoose.model<ICameraGroup>("CameraGroup", CameraGroupSchema);

/* ─── Camera health log ─── */
export interface ICameraHealthLog extends Document {
  organizationId: Types.ObjectId;
  cameraId: Types.ObjectId;
  status: string;
  health: string;
  latencyMs: number | null;
  frameRate: number | null;
  resolution: string | null;
  message: string;
  at: Date;
  createdAt: Date;
}

const CameraHealthLogSchema = new Schema<ICameraHealthLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: { type: String, required: true },
    health: { type: String, default: "UNKNOWN" },
    latencyMs: { type: Number, default: null },
    frameRate: { type: Number, default: null },
    resolution: { type: String, default: null },
    message: { type: String, default: "" },
    at: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
CameraHealthLogSchema.index({ organizationId: 1, cameraId: 1, at: -1 });

export const CameraHealthLog: Model<ICameraHealthLog> =
  mongoose.models.CameraHealthLog ??
  mongoose.model<ICameraHealthLog>("CameraHealthLog", CameraHealthLogSchema);

/* ─── Video evidence access / package (uses Platform Evidence for blobs) ─── */
export interface IVideoEvidenceMeta extends Document {
  videoEvidenceId: string;
  organizationId: Types.ObjectId;
  evidenceId: string;
  cameraId: Types.ObjectId | null;
  videoEventId: string | null;
  incidentId: Types.ObjectId | null;
  type: (typeof VIDEO_EVIDENCE_TYPES)[number];
  hash: string;
  sourceCameraId: string | null;
  clipStart: Date | null;
  clipEnd: Date | null;
  available: boolean;
  unavailableReason: string | null;
  demo: boolean;
  retentionUntil: Date | null;
  legalHold: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoEvidenceMetaSchema = new Schema<IVideoEvidenceMeta>(
  {
    videoEvidenceId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    evidenceId: { type: String, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, default: null },
    videoEventId: { type: String, default: null },
    incidentId: { type: Schema.Types.ObjectId, default: null },
    type: { type: String, enum: VIDEO_EVIDENCE_TYPES, default: "SNAPSHOT" },
    hash: { type: String, required: true },
    sourceCameraId: { type: String, default: null },
    clipStart: { type: Date, default: null },
    clipEnd: { type: Date, default: null },
    available: { type: Boolean, default: true },
    unavailableReason: { type: String, default: null },
    demo: { type: Boolean, default: false },
    retentionUntil: { type: Date, default: null },
    legalHold: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

VideoEvidenceMetaSchema.index({ organizationId: 1, createdAt: -1 });

export const VideoEvidenceMeta: Model<IVideoEvidenceMeta> =
  mongoose.models.VideoEvidenceMeta ??
  mongoose.model<IVideoEvidenceMeta>("VideoEvidenceMeta", VideoEvidenceMetaSchema);

export interface IVideoEvidenceAccessLog extends Document {
  organizationId: Types.ObjectId;
  videoEvidenceId: string;
  action: (typeof VIDEO_EVIDENCE_ACTIONS)[number];
  actorId: Types.ObjectId | null;
  actorName: string;
  purpose: string;
  recipient: string | null;
  expiresAt: Date | null;
  /** SHA-256 of one-time download/share token — never store raw token */
  tokenHash: string | null;
  consumedAt: Date | null;
  createdAt: Date;
}

const VideoEvidenceAccessLogSchema = new Schema<IVideoEvidenceAccessLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    videoEvidenceId: { type: String, required: true, index: true },
    action: { type: String, enum: VIDEO_EVIDENCE_ACTIONS, required: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    actorName: { type: String, default: "System" },
    purpose: { type: String, default: "" },
    recipient: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    tokenHash: { type: String, default: null, index: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const VideoEvidenceAccessLog: Model<IVideoEvidenceAccessLog> =
  mongoose.models.VideoEvidenceAccessLog ??
  mongoose.model<IVideoEvidenceAccessLog>("VideoEvidenceAccessLog", VideoEvidenceAccessLogSchema);

/* ─── Legal hold foundation ─── */
export interface IVideoLegalHold extends Document {
  holdId: string;
  organizationId: Types.ObjectId;
  resourceType: string;
  resourceId: string;
  reason: string;
  status: "ACTIVE" | "RELEASED";
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoLegalHoldSchema = new Schema<IVideoLegalHold>(
  {
    holdId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "RELEASED"], default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const VideoLegalHold: Model<IVideoLegalHold> =
  mongoose.models.VideoLegalHold ??
  mongoose.model<IVideoLegalHold>("VideoLegalHold", VideoLegalHoldSchema);

/* ─── Model deployment lifecycle (extends registry) ─── */
export interface IVideoModelDeployment extends Document {
  deploymentId: string;
  organizationId: Types.ObjectId | null;
  modelId: string;
  version: string;
  lifecycle: (typeof VIDEO_MODEL_LIFECYCLE)[number];
  purpose: string;
  metrics: {
    precision: number | null;
    recall: number | null;
    falsePositiveRate: number | null;
    falseNegativeRate: number | null;
    latencyMs: number | null;
    resourceUsage: string | null;
  };
  evaluatedAt: Date | null;
  deployedAt: Date | null;
  previousDeploymentId: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoModelDeploymentSchema = new Schema<IVideoModelDeployment>(
  {
    deploymentId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, default: null, index: true },
    modelId: { type: String, required: true, index: true },
    version: { type: String, required: true },
    lifecycle: { type: String, enum: VIDEO_MODEL_LIFECYCLE, default: "DRAFT", index: true },
    purpose: { type: String, default: "" },
    metrics: {
      precision: { type: Number, default: null },
      recall: { type: Number, default: null },
      falsePositiveRate: { type: Number, default: null },
      falseNegativeRate: { type: Number, default: null },
      latencyMs: { type: Number, default: null },
      resourceUsage: { type: String, default: null },
    },
    evaluatedAt: { type: Date, default: null },
    deployedAt: { type: Date, default: null },
    previousDeploymentId: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const VideoModelDeployment: Model<IVideoModelDeployment> =
  mongoose.models.VideoModelDeployment ??
  mongoose.model<IVideoModelDeployment>("VideoModelDeployment", VideoModelDeploymentSchema);

/* ─── AI processing usage / cost ─── */
export interface IVideoAIUsage extends Document {
  organizationId: Types.ObjectId;
  cameraId: Types.ObjectId | null;
  day: string;
  framesProcessed: number;
  aiRequests: number;
  processingMs: number;
  estimatedCost: number;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const VideoAIUsageSchema = new Schema<IVideoAIUsage>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, default: null },
    day: { type: String, required: true },
    framesProcessed: { type: Number, default: 0 },
    aiRequests: { type: Number, default: 0 },
    processingMs: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
VideoAIUsageSchema.index({ organizationId: 1, day: 1, cameraId: 1 }, { unique: true });

export const VideoAIUsage: Model<IVideoAIUsage> =
  mongoose.models.VideoAIUsage ?? mongoose.model<IVideoAIUsage>("VideoAIUsage", VideoAIUsageSchema);

/* ─── Video wall presets ─── */
export interface IVideoWallPreset extends Document {
  presetId: string;
  organizationId: Types.ObjectId;
  name: string;
  kind: (typeof VIDEO_WALL_PRESETS)[number];
  cameraIds: Types.ObjectId[];
  layout: number;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoWallPresetSchema = new Schema<IVideoWallPreset>(
  {
    presetId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    kind: { type: String, enum: VIDEO_WALL_PRESETS, default: "CUSTOM" },
    cameraIds: { type: [Schema.Types.ObjectId], default: [] },
    layout: { type: Number, default: 4 },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const VideoWallPreset: Model<IVideoWallPreset> =
  mongoose.models.VideoWallPreset ??
  mongoose.model<IVideoWallPreset>("VideoWallPreset", VideoWallPresetSchema);

/* ─── Camera maintenance (links to tasks) ─── */
export interface ICameraMaintenance extends Document {
  ticketId: string;
  organizationId: Types.ObjectId;
  cameraId: Types.ObjectId;
  issue: string;
  priority: string;
  assignedTeam: string;
  dueAt: Date | null;
  status: string;
  resolution: string;
  linkedTaskId: string | null;
  recommendationOnly: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CameraMaintenanceSchema = new Schema<ICameraMaintenance>(
  {
    ticketId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, required: true, index: true },
    issue: { type: String, required: true },
    priority: { type: String, default: "MEDIUM" },
    assignedTeam: { type: String, default: "" },
    dueAt: { type: Date, default: null },
    status: { type: String, default: "OPEN", index: true },
    resolution: { type: String, default: "" },
    linkedTaskId: { type: String, default: null },
    recommendationOnly: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const CameraMaintenance: Model<ICameraMaintenance> =
  mongoose.models.CameraMaintenance ??
  mongoose.model<ICameraMaintenance>("CameraMaintenance", CameraMaintenanceSchema);
