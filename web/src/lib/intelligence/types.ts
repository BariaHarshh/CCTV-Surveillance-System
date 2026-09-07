import type { Types } from "mongoose";
import type { ActionRisk, AIToolName, ConfidenceLevel } from "./constants";

export type AIMessageRole = "user" | "assistant" | "system" | "warning" | "action_confirm";

export interface AISourceRef {
  type: "document" | "incident" | "alert" | "camera" | "campus" | "report" | "tool";
  id: string;
  title: string;
  section?: string;
  version?: string;
  href?: string;
}

export interface AIResponseBlock {
  type: "text" | "table" | "stats" | "card" | "timeline" | "alerts" | "recommendations" | "links" | "chart";
  title?: string;
  content?: string;
  rows?: Array<Record<string, string | number | null>>;
  columns?: string[];
  items?: Array<{ label: string; value: string | number; href?: string; severity?: string }>;
  links?: Array<{ label: string; href: string }>;
  chart?: { labels: string[]; values: number[]; seriesName?: string };
}

export interface PendingAction {
  actionId: string;
  tool: AIToolName;
  args: Record<string, unknown>;
  risk: ActionRisk;
  summary: string;
}

export interface OrchestratorResult {
  conversationId: string;
  messageId: string;
  role: AIMessageRole;
  content: string;
  blocks: AIResponseBlock[];
  sources: AISourceRef[];
  confidence: ConfidenceLevel;
  pendingAction?: PendingAction | null;
  model: string;
  provider: string;
  latencyMs: number;
  toolsUsed: string[];
  mode: "llm" | "tools" | "unavailable";
  warning?: string | null;
}

export interface AIContextSnapshot {
  userId: string;
  organizationId: string | null;
  role: string;
  permissions: string[];
  page?: string | null;
  campusId?: string | null;
  buildingId?: string | null;
  incidentId?: string | null;
  nowIso: string;
}

export interface ToolExecutionContext {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  user: { _id: Types.ObjectId | string; role: string; permissions?: string[]; organizationId?: Types.ObjectId | string | null };
}
