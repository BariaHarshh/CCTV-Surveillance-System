import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import crypto from "crypto";

export function newEnterpriseId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/* ─── Automation ─── */
export interface IAutomation extends Document {
  automationId: string;
  organizationId: Types.ObjectId;
  name: string;
  description: string;
  status: string;
  version: number;
  trigger: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  templateKey: string | null;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationSchema = new Schema<IAutomation>(
  {
    automationId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "DRAFT", index: true },
    version: { type: Number, default: 1 },
    trigger: { type: Schema.Types.Mixed, default: {} },
    conditions: { type: Schema.Types.Mixed, default: [] },
    actions: { type: Schema.Types.Mixed, default: [] },
    templateKey: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
AutomationSchema.index({ organizationId: 1, status: 1 });

export const Automation: Model<IAutomation> =
  mongoose.models.Automation ?? mongoose.model<IAutomation>("Automation", AutomationSchema);

export interface IAutomationVersion extends Document {
  automationId: string;
  organizationId: Types.ObjectId;
  version: number;
  snapshot: Record<string, unknown>;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
}

const AutomationVersionSchema = new Schema<IAutomationVersion>(
  {
    automationId: { type: String, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
AutomationVersionSchema.index({ automationId: 1, version: -1 }, { unique: true });

export const AutomationVersion: Model<IAutomationVersion> =
  mongoose.models.AutomationVersion ??
  mongoose.model<IAutomationVersion>("AutomationVersion", AutomationVersionSchema);

/* ─── Workflow runs ─── */
export interface IWorkflowRun extends Document {
  runId: string;
  organizationId: Types.ObjectId;
  automationId: string;
  status: string;
  trigger: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  dryRun: boolean;
  error: string | null;
  correlationId: string;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    runId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    automationId: { type: String, required: true, index: true },
    status: { type: String, default: "RUNNING", index: true },
    trigger: { type: Schema.Types.Mixed, default: {} },
    steps: { type: Schema.Types.Mixed, default: [] },
    dryRun: { type: Boolean, default: false },
    error: { type: String, default: null },
    correlationId: { type: String, required: true, index: true },
    startedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
WorkflowRunSchema.index({ organizationId: 1, createdAt: -1 });

export const WorkflowRun: Model<IWorkflowRun> =
  mongoose.models.WorkflowRun ?? mongoose.model<IWorkflowRun>("WorkflowRun", WorkflowRunSchema);

/* ─── Approvals ─── */
export interface IApprovalRequest extends Document {
  approvalId: string;
  organizationId: Types.ObjectId;
  requestedBy: Types.ObjectId | null;
  requestedByType: "USER" | "AI" | "AUTOMATION" | "SYSTEM";
  action: string;
  resourceType: string;
  resourceId: string | null;
  riskLevel: string;
  reason: string;
  status: string;
  mode: "ONE" | "TWO" | "ANY" | "ALL";
  requiredApprovers: Types.ObjectId[];
  decisions: Array<{ approverId: Types.ObjectId; decision: string; at: Date; note?: string }>;
  expiresAt: Date;
  approvedAt: Date | null;
  correlationId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalRequestSchema = new Schema<IApprovalRequest>(
  {
    approvalId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, default: null },
    requestedByType: { type: String, enum: ["USER", "AI", "AUTOMATION", "SYSTEM"], default: "USER" },
    action: { type: String, required: true },
    resourceType: { type: String, default: "GENERIC" },
    resourceId: { type: String, default: null },
    riskLevel: { type: String, default: "MEDIUM" },
    reason: { type: String, default: "" },
    status: { type: String, default: "PENDING", index: true },
    mode: { type: String, enum: ["ONE", "TWO", "ANY", "ALL"], default: "ONE" },
    requiredApprovers: { type: [Schema.Types.ObjectId], default: [] },
    decisions: { type: Schema.Types.Mixed, default: [] },
    expiresAt: { type: Date, required: true },
    approvedAt: { type: Date, default: null },
    correlationId: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
ApprovalRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const ApprovalRequest: Model<IApprovalRequest> =
  mongoose.models.ApprovalRequest ??
  mongoose.model<IApprovalRequest>("ApprovalRequest", ApprovalRequestSchema);

/* ─── Policies ─── */
export interface IEnterprisePolicy extends Document {
  policyId: string;
  organizationId: Types.ObjectId | null; // null = platform-wide
  name: string;
  description: string;
  scope: string;
  subject: Record<string, unknown>;
  action: string;
  resource: Record<string, unknown>;
  condition: Record<string, unknown>;
  effect: string;
  priority: number;
  status: "DRAFT" | "ACTIVE" | "DISABLED";
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const EnterprisePolicySchema = new Schema<IEnterprisePolicy>(
  {
    policyId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, default: null, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    scope: { type: String, default: "ORGANIZATION" },
    subject: { type: Schema.Types.Mixed, default: {} },
    action: { type: String, required: true, index: true },
    resource: { type: Schema.Types.Mixed, default: {} },
    condition: { type: Schema.Types.Mixed, default: {} },
    effect: { type: String, required: true },
    priority: { type: Number, default: 100 },
    status: { type: String, enum: ["DRAFT", "ACTIVE", "DISABLED"], default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);
EnterprisePolicySchema.index({ organizationId: 1, status: 1, priority: 1 });

export const EnterprisePolicy: Model<IEnterprisePolicy> =
  mongoose.models.EnterprisePolicy ??
  mongoose.model<IEnterprisePolicy>("EnterprisePolicy", EnterprisePolicySchema);

/* ─── Agents ─── */
export interface IAgentRegistry extends Omit<Document, "model"> {
  agentId: string;
  name: string;
  description: string;
  type: string;
  version: string;
  status: "DRAFT" | "ACTIVE" | "DISABLED" | "TESTING";
  riskLevel: string;
  organizationScope: "ALL" | "SPECIFIC";
  organizationIds: Types.ObjectId[];
  model: string;
  tools: string[];
  permissions: string[];
  actionMode: string;
  disabledReason: string | null;
  disabledBy: Types.ObjectId | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AgentRegistrySchema = new Schema<IAgentRegistry>(
  {
    agentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, required: true },
    version: { type: String, default: "1.0.0" },
    status: { type: String, enum: ["DRAFT", "ACTIVE", "DISABLED", "TESTING"], default: "ACTIVE" },
    riskLevel: { type: String, default: "LOW" },
    organizationScope: { type: String, enum: ["ALL", "SPECIFIC"], default: "ALL" },
    organizationIds: { type: [Schema.Types.ObjectId], default: [] },
    model: { type: String, default: "tools" },
    tools: { type: [String], default: [] },
    permissions: { type: [String], default: [] },
    actionMode: { type: String, default: "RECOMMEND" },
    disabledReason: { type: String, default: null },
    disabledBy: { type: Schema.Types.ObjectId, default: null },
    disabledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const AgentRegistry: Model<IAgentRegistry> =
  mongoose.models.AgentRegistry ?? mongoose.model<IAgentRegistry>("AgentRegistry", AgentRegistrySchema);

export interface IAgentTrace extends Omit<Document, "model"> {
  traceId: string;
  organizationId: Types.ObjectId | null;
  userId: Types.ObjectId | null;
  agentId: string;
  requestSummary: string;
  intent: string | null;
  model: string | null;
  tool: string | null;
  argumentsHash: string | null;
  policyDecision: string | null;
  approvalId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  result: string;
  outcome: "SUCCESS" | "DENIED" | "FAILED" | "WAITING_APPROVAL";
  correlationId: string;
  requestId: string | null;
  safeReasoning: string | null;
  createdAt: Date;
}

const AgentTraceSchema = new Schema<IAgentTrace>(
  {
    traceId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, default: null, index: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    agentId: { type: String, required: true, index: true },
    requestSummary: { type: String, default: "" },
    intent: { type: String, default: null },
    model: { type: String, default: null },
    tool: { type: String, default: null },
    argumentsHash: { type: String, default: null },
    policyDecision: { type: String, default: null },
    approvalId: { type: String, default: null },
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },
    result: { type: String, default: "" },
    outcome: { type: String, enum: ["SUCCESS", "DENIED", "FAILED", "WAITING_APPROVAL"], default: "SUCCESS" },
    correlationId: { type: String, required: true, index: true },
    requestId: { type: String, default: null },
    safeReasoning: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AgentTrace: Model<IAgentTrace> =
  mongoose.models.AgentTrace ?? mongoose.model<IAgentTrace>("AgentTrace", AgentTraceSchema);

/* ─── Jobs / DLQ ─── */
export interface IBackgroundJob extends Document {
  jobId: string;
  organizationId: Types.ObjectId | null;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  runAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BackgroundJobSchema = new Schema<IBackgroundJob>(
  {
    jobId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, default: null, index: true },
    type: { type: String, required: true, index: true },
    status: { type: String, default: "QUEUED", index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    error: { type: String, default: null },
    idempotencyKey: { type: String, default: null, index: true },
    correlationId: { type: String, default: null },
    runAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
BackgroundJobSchema.index({ status: 1, runAt: 1 });

export const BackgroundJob: Model<IBackgroundJob> =
  mongoose.models.BackgroundJob ?? mongoose.model<IBackgroundJob>("BackgroundJob", BackgroundJobSchema);

/* ─── Event bus ─── */
export interface IEnterpriseEvent extends Document {
  eventId: string;
  organizationId: Types.ObjectId | null;
  type: string;
  source: string;
  resourceType: string | null;
  resourceId: string | null;
  payloadReference: Record<string, unknown>;
  requestId: string | null;
  correlationId: string | null;
  version: number;
  createdAt: Date;
}

const EnterpriseEventSchema = new Schema<IEnterpriseEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, default: null, index: true },
    type: { type: String, required: true, index: true },
    source: { type: String, default: "system" },
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },
    payloadReference: { type: Schema.Types.Mixed, default: {} },
    requestId: { type: String, default: null },
    correlationId: { type: String, default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
EnterpriseEventSchema.index({ organizationId: 1, type: 1, createdAt: -1 });

export const EnterpriseEvent: Model<IEnterpriseEvent> =
  mongoose.models.EnterpriseEvent ??
  mongoose.model<IEnterpriseEvent>("EnterpriseEvent", EnterpriseEventSchema);

/* ─── Support ─── */
export interface ISupportTicket extends Document {
  ticketId: string;
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  category: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  assignedTo: Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    category: { type: String, default: "GENERAL" },
    priority: { type: String, default: "MEDIUM" },
    status: { type: String, default: "OPEN", index: true },
    subject: { type: String, required: true },
    description: { type: String, default: "" },
    assignedTo: { type: Schema.Types.ObjectId, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ?? mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);

/* ─── Org AI autonomy + kill switches ─── */
export interface IOrgAutonomySettings extends Document {
  organizationId: Types.ObjectId;
  defaultMode: string;
  agentModes: Record<string, string>;
  aiWriteActionsEnabled: boolean;
  aiExternalCommunicationEnabled: boolean;
  aiAnalysisEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrgAutonomySettingsSchema = new Schema<IOrgAutonomySettings>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, unique: true },
    defaultMode: { type: String, default: "RECOMMEND" },
    agentModes: { type: Schema.Types.Mixed, default: {} },
    aiWriteActionsEnabled: { type: Boolean, default: false },
    aiExternalCommunicationEnabled: { type: Boolean, default: false },
    aiAnalysisEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const OrgAutonomySettings: Model<IOrgAutonomySettings> =
  mongoose.models.OrgAutonomySettings ??
  mongoose.model<IOrgAutonomySettings>("OrgAutonomySettings", OrgAutonomySettingsSchema);

/* ─── Dashboard layout / saved searches ─── */
export interface IDashboardLayout extends Document {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  dashboard: string;
  layout: unknown[];
  widgets: string[];
  updatedAt: Date;
}

const DashboardLayoutSchema = new Schema<IDashboardLayout>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    organizationId: { type: Schema.Types.ObjectId, required: true },
    dashboard: { type: String, default: "admin" },
    layout: { type: Schema.Types.Mixed, default: [] },
    widgets: { type: [String], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);
DashboardLayoutSchema.index({ userId: 1, organizationId: 1, dashboard: 1 }, { unique: true });

export const DashboardLayout: Model<IDashboardLayout> =
  mongoose.models.DashboardLayout ??
  mongoose.model<IDashboardLayout>("DashboardLayout", DashboardLayoutSchema);

export interface ISavedSearch extends Document {
  searchId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SavedSearchSchema = new Schema<ISavedSearch>(
  {
    searchId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    query: { type: String, default: "" },
    filters: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const SavedSearch: Model<ISavedSearch> =
  mongoose.models.SavedSearch ?? mongoose.model<ISavedSearch>("SavedSearch", SavedSearchSchema);

/* ─── Training / drills ─── */
export interface ITrainingDrill extends Document {
  drillId: string;
  organizationId: Types.ObjectId;
  name: string;
  type: string;
  date: Date;
  location: string;
  participants: string[];
  objective: string;
  result: string;
  notes: string;
  responseTimeMinutes: number | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingDrillSchema = new Schema<ITrainingDrill>(
  {
    drillId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: "SAFETY_DRILL" },
    date: { type: Date, required: true },
    location: { type: String, default: "" },
    participants: { type: [String], default: [] },
    objective: { type: String, default: "" },
    result: { type: String, default: "" },
    notes: { type: String, default: "" },
    responseTimeMinutes: { type: Number, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const TrainingDrill: Model<ITrainingDrill> =
  mongoose.models.TrainingDrill ?? mongoose.model<ITrainingDrill>("TrainingDrill", TrainingDrillSchema);

/* ─── Postmortem ─── */
export interface IPostmortem extends Document {
  postmortemId: string;
  platformIncidentId: string;
  summary: string;
  impact: string;
  rootCause: string;
  rootCauseVerified: boolean;
  timeline: Array<Record<string, unknown>>;
  resolution: string;
  preventiveActions: string[];
  owner: Types.ObjectId | null;
  completedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PostmortemSchema = new Schema<IPostmortem>(
  {
    postmortemId: { type: String, required: true, unique: true },
    platformIncidentId: { type: String, required: true, index: true },
    summary: { type: String, default: "" },
    impact: { type: String, default: "" },
    rootCause: { type: String, default: "" },
    rootCauseVerified: { type: Boolean, default: false },
    timeline: { type: Schema.Types.Mixed, default: [] },
    resolution: { type: String, default: "" },
    preventiveActions: { type: [String], default: [] },
    owner: { type: Schema.Types.ObjectId, default: null },
    completedDate: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Postmortem: Model<IPostmortem> =
  mongoose.models.Postmortem ?? mongoose.model<IPostmortem>("Postmortem", PostmortemSchema);

/* ─── Export jobs ─── */
export interface IExportJob extends Document {
  exportId: string;
  organizationId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  type: string;
  status: string;
  storageRef: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExportJobSchema = new Schema<IExportJob>(
  {
    exportId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, required: true },
    status: { type: String, default: "PENDING" },
    storageRef: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const ExportJob: Model<IExportJob> =
  mongoose.models.ExportJob ?? mongoose.model<IExportJob>("ExportJob", ExportJobSchema);

/* ─── Data deletion requests ─── */
export interface IDataDeletionRequest extends Document {
  requestId: string;
  organizationId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  scope: string;
  status: string;
  legalHoldChecked: boolean;
  approvalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DataDeletionRequestSchema = new Schema<IDataDeletionRequest>(
  {
    requestId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, required: true },
    scope: { type: String, default: "EXPORT_ONLY" },
    status: { type: String, default: "REQUESTED" },
    legalHoldChecked: { type: Boolean, default: false },
    approvalId: { type: String, default: null },
  },
  { timestamps: true }
);

export const DataDeletionRequest: Model<IDataDeletionRequest> =
  mongoose.models.DataDeletionRequest ??
  mongoose.model<IDataDeletionRequest>("DataDeletionRequest", DataDeletionRequestSchema);
