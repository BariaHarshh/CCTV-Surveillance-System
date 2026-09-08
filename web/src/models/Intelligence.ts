import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import crypto from "crypto";

export function hashOpaque(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export interface IAIConversation extends Document {
  conversationId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  createdAt: Date;
  updatedAt: Date;
}

const AIConversationSchema = new Schema<IAIConversation>(
  {
    conversationId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New chat" },
    status: { type: String, enum: ["ACTIVE", "ARCHIVED", "DELETED"], default: "ACTIVE", index: true },
  },
  { timestamps: true }
);
AIConversationSchema.index({ organizationId: 1, userId: 1, updatedAt: -1 });

export const AIConversation: Model<IAIConversation> =
  mongoose.models.AIConversation ?? mongoose.model<IAIConversation>("AIConversation", AIConversationSchema);

export interface IAIMessage extends Omit<Document, "model"> {
  messageId: string;
  conversationId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: "user" | "assistant" | "system" | "warning" | "action_confirm";
  content: string;
  blocks: unknown[];
  sources: unknown[];
  confidence: string | null;
  toolsUsed: string[];
  model: string | null;
  provider: string | null;
  pendingAction: unknown | null;
  feedback: "helpful" | "not_helpful" | null;
  createdAt: Date;
  updatedAt: Date;
}

const AIMessageSchema = new Schema<IAIMessage>(
  {
    messageId: { type: String, required: true, unique: true },
    conversationId: { type: String, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ["user", "assistant", "system", "warning", "action_confirm"], required: true },
    content: { type: String, default: "" },
    blocks: { type: [Schema.Types.Mixed], default: [] },
    sources: { type: [Schema.Types.Mixed], default: [] },
    confidence: { type: String, default: null },
    toolsUsed: { type: [String], default: [] },
    model: { type: String, default: null },
    provider: { type: String, default: null },
    pendingAction: { type: Schema.Types.Mixed, default: null },
    feedback: { type: String, enum: ["helpful", "not_helpful", null], default: null },
  },
  { timestamps: true }
);
AIMessageSchema.index({ organizationId: 1, conversationId: 1, createdAt: 1 });

export const AIMessage: Model<IAIMessage> =
  mongoose.models.AIMessage ?? mongoose.model<IAIMessage>("AIMessage", AIMessageSchema);

export interface IKnowledgeDocument extends Document {
  documentId: string;
  organizationId: Types.ObjectId;
  title: string;
  type: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  mimeType: string;
  storageRef: string;
  textContent: string;
  uploadedBy: Types.ObjectId;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeDocumentSchema = new Schema<IKnowledgeDocument>(
  {
    documentId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, default: "POLICY" },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "DRAFT", index: true },
    mimeType: { type: String, default: "text/plain" },
    storageRef: { type: String, default: "" },
    textContent: { type: String, default: "" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
KnowledgeDocumentSchema.index({ organizationId: 1, status: 1, title: 1 });

export const KnowledgeDocument: Model<IKnowledgeDocument> =
  mongoose.models.KnowledgeDocument ??
  mongoose.model<IKnowledgeDocument>("KnowledgeDocument", KnowledgeDocumentSchema);

export interface IKnowledgeChunk extends Document {
  chunkId: string;
  documentId: string;
  organizationId: Types.ObjectId;
  version: number;
  section: string;
  content: string;
  embedding: number[];
  tokenEstimate: number;
  createdAt: Date;
}

const KnowledgeChunkSchema = new Schema<IKnowledgeChunk>(
  {
    chunkId: { type: String, required: true, unique: true },
    documentId: { type: String, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, default: 1 },
    section: { type: String, default: "" },
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    tokenEstimate: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
KnowledgeChunkSchema.index({ organizationId: 1, documentId: 1 });

export const KnowledgeChunk: Model<IKnowledgeChunk> =
  mongoose.models.KnowledgeChunk ?? mongoose.model<IKnowledgeChunk>("KnowledgeChunk", KnowledgeChunkSchema);

export interface IAIPromptVersion extends Document {
  promptKey: string;
  version: number;
  content: string;
  status: "DRAFT" | "TESTING" | "PUBLISHED" | "ARCHIVED";
  createdBy: Types.ObjectId | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AIPromptVersionSchema = new Schema<IAIPromptVersion>(
  {
    promptKey: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ["DRAFT", "TESTING", "PUBLISHED", "ARCHIVED"], default: "DRAFT" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
AIPromptVersionSchema.index({ promptKey: 1, version: -1 }, { unique: true });

export const AIPromptVersion: Model<IAIPromptVersion> =
  mongoose.models.AIPromptVersion ?? mongoose.model<IAIPromptVersion>("AIPromptVersion", AIPromptVersionSchema);

export interface IAIUsageRecord extends Omit<Document, "model"> {
  organizationId: Types.ObjectId | null;
  userId: Types.ObjectId | null;
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  success: boolean;
  error: string | null;
  toolsUsed: string[];
  createdAt: Date;
}

const AIUsageRecordSchema = new Schema<IAIUsageRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, default: null, index: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    provider: { type: String, default: "NONE" },
    model: { type: String, default: "tools" },
    requests: { type: Number, default: 1 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    estimatedCostUsd: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    error: { type: String, default: null },
    toolsUsed: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
AIUsageRecordSchema.index({ organizationId: 1, createdAt: -1 });

export const AIUsageRecord: Model<IAIUsageRecord> =
  mongoose.models.AIUsageRecord ?? mongoose.model<IAIUsageRecord>("AIUsageRecord", AIUsageRecordSchema);

export interface IAIUnansweredQuestion extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId | null;
  question: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: Date;
  updatedAt: Date;
}

const AIUnansweredQuestionSchema = new Schema<IAIUnansweredQuestion>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    question: { type: String, required: true },
    status: { type: String, enum: ["OPEN", "RESOLVED", "DISMISSED"], default: "OPEN" },
  },
  { timestamps: true }
);

export const AIUnansweredQuestion: Model<IAIUnansweredQuestion> =
  mongoose.models.AIUnansweredQuestion ??
  mongoose.model<IAIUnansweredQuestion>("AIUnansweredQuestion", AIUnansweredQuestionSchema);

export interface IOrgAIPrivacySettings extends Document {
  organizationId: Types.ObjectId;
  aiEnabled: boolean;
  copilotEnabled: boolean;
  knowledgeBaseEnabled: boolean;
  allowExternalProviders: boolean;
  conversationRetentionDays: number;
  documentIndexingEnabled: boolean;
  trainingUsageAllowed: boolean;
  redactionEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrgAIPrivacySettingsSchema = new Schema<IOrgAIPrivacySettings>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, unique: true },
    aiEnabled: { type: Boolean, default: true },
    copilotEnabled: { type: Boolean, default: true },
    knowledgeBaseEnabled: { type: Boolean, default: true },
    allowExternalProviders: { type: Boolean, default: false },
    conversationRetentionDays: { type: Number, default: 90 },
    documentIndexingEnabled: { type: Boolean, default: true },
    trainingUsageAllowed: { type: Boolean, default: false },
    redactionEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const OrgAIPrivacySettings: Model<IOrgAIPrivacySettings> =
  mongoose.models.OrgAIPrivacySettings ??
  mongoose.model<IOrgAIPrivacySettings>("OrgAIPrivacySettings", OrgAIPrivacySettingsSchema);

export interface IPendingAIAction extends Document {
  actionId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: string;
  tool: string;
  args: Record<string, unknown>;
  risk: string;
  summary: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PendingAIActionSchema = new Schema<IPendingAIAction>(
  {
    actionId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    conversationId: { type: String, required: true },
    tool: { type: String, required: true },
    args: { type: Schema.Types.Mixed, default: {} },
    risk: { type: String, default: "HIGH" },
    summary: { type: String, default: "" },
    status: { type: String, enum: ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"], default: "PENDING" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const PendingAIAction: Model<IPendingAIAction> =
  mongoose.models.PendingAIAction ?? mongoose.model<IPendingAIAction>("PendingAIAction", PendingAIActionSchema);
