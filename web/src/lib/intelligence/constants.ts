/**
 * Step 12 — AI Intelligence Layer constants (separate from detection AI in src/lib/ai).
 */

export const INTEL_FEATURE_FLAGS = [
  "ai-copilot",
  "ai-predictive-risk",
  "ai-voice",
  "ai-smart-search",
  "ai-report-generator",
  "ai-camera-maintenance",
] as const;
export type IntelFeatureFlag = (typeof INTEL_FEATURE_FLAGS)[number];

export const AI_TOOL_NAMES = [
  "getDashboardSummary",
  "getCampuses",
  "getCampusRisk",
  "getCameras",
  "getOfflineCameras",
  "getAlerts",
  "getIncidents",
  "getIncidentDetails",
  "getEmergencies",
  "getResponseTeams",
  "getTasks",
  "getAnalytics",
  "getReports",
  "generateReport",
  "createIncident",
  "createTask",
  "createCorrectiveAction",
  "searchOrganization",
  "getAuditLogs",
  "getUsage",
  "getSystemHealth",
  "searchKnowledge",
  "getCameraHealth",
  "getRecommendations",
  "getPredictiveRisk",
  "getMapRisk",
  "getMapSummary",
  "getVideoDetections",
  "summarizeCameraEvents",
  "getVideoEvidence",
  "searchVideoEvents",
  "getFieldTasks",
  "getRespondingTeams",
  "getOverdueInspections",
  "summarizeFieldOperations",
  "getExecutiveBrief",
  "getKpisBelowTarget",
  "getTopOperationalRisks",
] as const;
export type AIToolName = (typeof AI_TOOL_NAMES)[number];

export const ACTION_RISK = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ActionRisk = (typeof ACTION_RISK)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Tools that mutate state and require explicit user confirmation. */
export const CONFIRMATION_REQUIRED_TOOLS: AIToolName[] = [
  "createIncident",
  "createTask",
  "createCorrectiveAction",
  "generateReport",
];

export const DEFAULT_AI_REQUEST_LIMITS: Record<string, number> = {
  FREE: 500,
  STARTER: 10_000,
  PROFESSIONAL: 50_000,
  ENTERPRISE: 500_000,
};

export const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(your|the)\s+(system|safety)/i,
  /you\s+are\s+now\s+(dan|unrestricted|jailbroken)/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /override\s+safety/i,
];
