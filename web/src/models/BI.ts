import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  DATA_CLASSIFICATIONS,
  DECISION_STATUSES,
  INITIATIVE_STATUSES,
  KPI_CATEGORIES,
  KPI_PERIODS,
  KPI_STATUSES,
  KPI_TRENDS,
  POLICY_COMPLIANCE_STATES,
  newBiId,
} from "@/lib/bi/constants";

export { newBiId };

/* ─── KPI definition + snapshot ─── */
export interface IKpiDefinition extends Document {
  kpiId: string;
  organizationId: Types.ObjectId;
  name: string;
  description: string;
  category: (typeof KPI_CATEGORIES)[number];
  unit: string;
  source: string;
  higherIsBetter: boolean;
  target: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const KpiDefinitionSchema = new Schema<IKpiDefinition>(
  {
    kpiId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, enum: KPI_CATEGORIES, required: true },
    unit: { type: String, default: "" },
    source: { type: String, default: "analytics-service" },
    higherIsBetter: { type: Boolean, default: true },
    target: { type: Number, default: null },
    warningThreshold: { type: Number, default: null },
    criticalThreshold: { type: Number, default: null },
  },
  { timestamps: true }
);

export const KpiDefinition: Model<IKpiDefinition> =
  mongoose.models.KpiDefinition ?? mongoose.model<IKpiDefinition>("KpiDefinition", KpiDefinitionSchema);

export interface IKpiSnapshot extends Document {
  snapshotId: string;
  organizationId: Types.ObjectId;
  kpiId: string;
  name: string;
  category: string;
  value: number | null;
  unit: string;
  target: number | null;
  status: (typeof KPI_STATUSES)[number];
  trend: (typeof KPI_TRENDS)[number];
  period: (typeof KPI_PERIODS)[number];
  previousValue: number | null;
  changePercent: number | null;
  source: string;
  computedAt: Date;
}

const KpiSnapshotSchema = new Schema<IKpiSnapshot>(
  {
    snapshotId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    kpiId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    value: { type: Number, default: null },
    unit: { type: String, default: "" },
    target: { type: Number, default: null },
    status: { type: String, enum: KPI_STATUSES, default: "NO_DATA" },
    trend: { type: String, enum: KPI_TRENDS, default: "INSUFFICIENT_DATA" },
    period: { type: String, enum: KPI_PERIODS, default: "30D" },
    previousValue: { type: Number, default: null },
    changePercent: { type: Number, default: null },
    source: { type: String, default: "" },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
KpiSnapshotSchema.index({ organizationId: 1, computedAt: -1 });

export const KpiSnapshot: Model<IKpiSnapshot> =
  mongoose.models.KpiSnapshot ?? mongoose.model<IKpiSnapshot>("KpiSnapshot", KpiSnapshotSchema);

/* ─── Strategic initiatives ─── */
export interface IStrategicInitiative extends Document {
  initiativeId: string;
  organizationId: Types.ObjectId;
  title: string;
  description: string;
  ownerName: string;
  ownerId: Types.ObjectId | null;
  deadline: Date | null;
  status: (typeof INITIATIVE_STATUSES)[number];
  progress: number;
  relatedKpiIds: string[];
  relatedTaskIds: string[];
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const StrategicInitiativeSchema = new Schema<IStrategicInitiative>(
  {
    initiativeId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    ownerName: { type: String, default: "" },
    ownerId: { type: Schema.Types.ObjectId, default: null },
    deadline: { type: Date, default: null },
    status: { type: String, enum: INITIATIVE_STATUSES, default: "NOT_STARTED" },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    relatedKpiIds: { type: [String], default: [] },
    relatedTaskIds: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const StrategicInitiative: Model<IStrategicInitiative> =
  mongoose.models.StrategicInitiative ??
  mongoose.model<IStrategicInitiative>("StrategicInitiative", StrategicInitiativeSchema);

/* ─── Decision log ─── */
export interface IExecutiveDecision extends Document {
  decisionId: string;
  organizationId: Types.ObjectId;
  title: string;
  reason: string;
  ownerName: string;
  ownerId: Types.ObjectId | null;
  relatedData: string;
  relatedIncidentId: string | null;
  status: (typeof DECISION_STATUSES)[number];
  decidedAt: Date;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExecutiveDecisionSchema = new Schema<IExecutiveDecision>(
  {
    decisionId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    reason: { type: String, default: "" },
    ownerName: { type: String, default: "" },
    ownerId: { type: Schema.Types.ObjectId, default: null },
    relatedData: { type: String, default: "" },
    relatedIncidentId: { type: String, default: null },
    status: { type: String, enum: DECISION_STATUSES, default: "OPEN" },
    decidedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const ExecutiveDecision: Model<IExecutiveDecision> =
  mongoose.models.ExecutiveDecision ??
  mongoose.model<IExecutiveDecision>("ExecutiveDecision", ExecutiveDecisionSchema);

/* ─── Policy exception ─── */
export interface IPolicyException extends Document {
  exceptionId: string;
  organizationId: Types.ObjectId;
  policyId: string;
  reason: string;
  ownerName: string;
  ownerId: Types.ObjectId | null;
  startsAt: Date;
  expiresAt: Date;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  approvedBy: Types.ObjectId | null;
  createdAt: Date;
}

const PolicyExceptionSchema = new Schema<IPolicyException>(
  {
    exceptionId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    policyId: { type: String, required: true },
    reason: { type: String, required: true },
    ownerName: { type: String, default: "" },
    ownerId: { type: Schema.Types.ObjectId, default: null },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["ACTIVE", "EXPIRED", "REVOKED"], default: "ACTIVE" },
    approvedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const PolicyException: Model<IPolicyException> =
  mongoose.models.PolicyException ??
  mongoose.model<IPolicyException>("PolicyException", PolicyExceptionSchema);

/* ─── Data governance registry ─── */
export interface IDataCategory extends Document {
  categoryId: string;
  organizationId: Types.ObjectId;
  name: string;
  classification: (typeof DATA_CLASSIFICATIONS)[number];
  ownerName: string;
  retentionDays: number | null;
  accessNotes: string;
  createdAt: Date;
}

const DataCategorySchema = new Schema<IDataCategory>(
  {
    categoryId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    classification: { type: String, enum: DATA_CLASSIFICATIONS, default: "INTERNAL" },
    ownerName: { type: String, default: "" },
    retentionDays: { type: Number, default: null },
    accessNotes: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const DataCategory: Model<IDataCategory> =
  mongoose.models.DataCategory ?? mongoose.model<IDataCategory>("DataCategory", DataCategorySchema);

/* ─── After-action / lessons learned ─── */
export interface IAfterActionReview extends Document {
  reviewId: string;
  organizationId: Types.ObjectId;
  incidentId: string | null;
  emergencyId: string | null;
  title: string;
  whatHappened: string;
  timelineSummary: string;
  responseSummary: string;
  whatWorked: string;
  whatFailed: string;
  rootCause: string | null;
  rootCauseVerified: boolean;
  lessons: Array<{ lesson: string; category: string; owner: string; action: string; status: string }>;
  status: "DRAFT" | "FINAL";
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AfterActionReviewSchema = new Schema<IAfterActionReview>(
  {
    reviewId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    incidentId: { type: String, default: null },
    emergencyId: { type: String, default: null },
    title: { type: String, required: true },
    whatHappened: { type: String, default: "" },
    timelineSummary: { type: String, default: "" },
    responseSummary: { type: String, default: "" },
    whatWorked: { type: String, default: "" },
    whatFailed: { type: String, default: "" },
    rootCause: { type: String, default: null },
    rootCauseVerified: { type: Boolean, default: false },
    lessons: {
      type: [
        {
          lesson: String,
          category: String,
          owner: String,
          action: String,
          status: { type: String, default: "OPEN" },
        },
      ],
      default: [],
    },
    status: { type: String, enum: ["DRAFT", "FINAL"], default: "DRAFT" },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const AfterActionReview: Model<IAfterActionReview> =
  mongoose.models.AfterActionReview ??
  mongoose.model<IAfterActionReview>("AfterActionReview", AfterActionReviewSchema);

/* ─── Dashboard preferences ─── */
export interface IExecutiveDashboardPref extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  widgets: string[];
  period: string;
  campusId: string | null;
  updatedAt: Date;
}

const ExecutiveDashboardPrefSchema = new Schema<IExecutiveDashboardPref>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    widgets: { type: [String], default: ["safety", "incidents", "cameras", "risk", "sla", "ai"] },
    period: { type: String, default: "30D" },
    campusId: { type: String, default: null },
  },
  { timestamps: true }
);
ExecutiveDashboardPrefSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const ExecutiveDashboardPref: Model<IExecutiveDashboardPref> =
  mongoose.models.ExecutiveDashboardPref ??
  mongoose.model<IExecutiveDashboardPref>("ExecutiveDashboardPref", ExecutiveDashboardPrefSchema);

/* ─── Report schedule ─── */
export interface IReportSchedule extends Document {
  scheduleId: string;
  organizationId: Types.ObjectId;
  reportType: string;
  cadence: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  format: "PDF" | "CSV" | "EXCEL";
  enabled: boolean;
  lastRunAt: Date | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
}

const ReportScheduleSchema = new Schema<IReportSchedule>(
  {
    scheduleId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    reportType: { type: String, default: "EXECUTIVE" },
    cadence: { type: String, enum: ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"], default: "WEEKLY" },
    format: { type: String, enum: ["PDF", "CSV", "EXCEL"], default: "PDF" },
    enabled: { type: Boolean, default: true },
    lastRunAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const ReportSchedule: Model<IReportSchedule> =
  mongoose.models.ReportSchedule ?? mongoose.model<IReportSchedule>("ReportSchedule", ReportScheduleSchema);

export type PolicyComplianceState = (typeof POLICY_COMPLIANCE_STATES)[number];
