import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { DEFAULT_ORG_AI_SETTINGS } from "@/lib/ai/constants";

export interface IOrganizationAISettings extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  defaultConfidenceThreshold: number;
  eventCooldownSeconds: number;
  occupancyThresholds: { elevated: number; high: number; critical: number };
  abandonedObjectThresholdSeconds: number;
  afterHoursSeverity: string;
  notificationRules: Record<string, string>;
  dataRetention: {
    eventsDays: number;
    snapshotsDays: number;
    incidentsDays: number;
    auditDays: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationAISettingsSchema = new Schema<IOrganizationAISettings>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    defaultConfidenceThreshold: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.defaultConfidenceThreshold },
    eventCooldownSeconds: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.eventCooldownSeconds },
    occupancyThresholds: {
      elevated: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.occupancyThresholds.elevated },
      high: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.occupancyThresholds.high },
      critical: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.occupancyThresholds.critical },
    },
    abandonedObjectThresholdSeconds: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.abandonedObjectThresholdSeconds },
    afterHoursSeverity: { type: String, default: "MEDIUM" },
    notificationRules: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_ORG_AI_SETTINGS.notificationRules }) },
    dataRetention: {
      eventsDays: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.dataRetention.eventsDays },
      snapshotsDays: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.dataRetention.snapshotsDays },
      incidentsDays: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.dataRetention.incidentsDays },
      auditDays: { type: Number, default: DEFAULT_ORG_AI_SETTINGS.dataRetention.auditDays },
    },
  },
  { timestamps: true }
);

export const OrganizationAISettings: Model<IOrganizationAISettings> =
  mongoose.models.OrganizationAISettings ??
  mongoose.model<IOrganizationAISettings>("OrganizationAISettings", OrganizationAISettingsSchema);
