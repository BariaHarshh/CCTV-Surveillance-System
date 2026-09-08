import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { REPORT_FORMATS, REPORT_STATUSES, REPORT_TYPES } from "@/lib/analytics/constants";

export interface IAnalyticsReport extends Document {
  _id: Types.ObjectId;
  reportId: string;
  organizationId: Types.ObjectId;
  type: (typeof REPORT_TYPES)[number];
  format: (typeof REPORT_FORMATS)[number];
  filters: Record<string, unknown>;
  generatedBy: Types.ObjectId | null;
  generatedByName: string;
  generatedAt: Date | null;
  version: number;
  status: (typeof REPORT_STATUSES)[number];
  storageReference: string | null;
  content: string | null;
  error: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsReportSchema = new Schema<IAnalyticsReport>(
  {
    reportId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: { type: String, enum: REPORT_TYPES, required: true },
    format: { type: String, enum: REPORT_FORMATS, default: "CSV" },
    filters: { type: Schema.Types.Mixed, default: {} },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    generatedByName: { type: String, default: "" },
    generatedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
    status: { type: String, enum: REPORT_STATUSES, default: "QUEUED", index: true },
    storageReference: { type: String, default: null },
    content: { type: String, default: null },
    error: { type: String, default: null },
    source: { type: String, default: "MANUAL" },
  },
  { timestamps: true }
);

AnalyticsReportSchema.index({ organizationId: 1, createdAt: -1 });

export const AnalyticsReport: Model<IAnalyticsReport> =
  mongoose.models.AnalyticsReport ?? mongoose.model<IAnalyticsReport>("AnalyticsReport", AnalyticsReportSchema);

export interface ISavedView extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  dashboard: string;
  filters: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SavedViewSchema = new Schema<ISavedView>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    dashboard: { type: String, required: true },
    filters: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

SavedViewSchema.index({ userId: 1, organizationId: 1, dashboard: 1 });

export const SavedView: Model<ISavedView> =
  mongoose.models.SavedView ?? mongoose.model<ISavedView>("SavedView", SavedViewSchema);

export interface ISafetyInsight extends Document {
  _id: Types.ObjectId;
  insightId: string;
  organizationId: Types.ObjectId;
  title: string;
  evidence: string[];
  change: string | null;
  affectedArea: string | null;
  suggestedReview: string | null;
  metrics: Record<string, unknown>;
  period: string;
  feedback: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const SafetyInsightSchema = new Schema<ISafetyInsight>(
  {
    insightId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true },
    evidence: [{ type: String }],
    change: { type: String, default: null },
    affectedArea: { type: String, default: null },
    suggestedReview: { type: String, default: null },
    metrics: { type: Schema.Types.Mixed, default: {} },
    period: { type: String, default: "" },
    feedback: { type: String, default: null },
    source: { type: String, default: "SYSTEM" },
  },
  { timestamps: true }
);

SafetyInsightSchema.index({ organizationId: 1, createdAt: -1 });

export const SafetyInsight: Model<ISafetyInsight> =
  mongoose.models.SafetyInsight ?? mongoose.model<ISafetyInsight>("SafetyInsight", SafetyInsightSchema);
