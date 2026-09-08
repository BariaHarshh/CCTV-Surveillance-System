/**
 * Step 13 — Enterprise control layer constants
 */

export const AUTOMATION_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "DISABLED", "ERROR"] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const WORKFLOW_RUN_STATUSES = [
  "DRAFT",
  "RUNNING",
  "WAITING_APPROVAL",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "PAUSED",
  "TIMEOUT",
] as const;
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];

export const TRIGGER_TYPES = [
  "EVENT",
  "ALERT",
  "INCIDENT",
  "EMERGENCY",
  "CAMERA",
  "TASK",
  "SCHEDULE",
  "USER",
  "REPORT",
  "AI",
  "SYSTEM",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const POLICY_EFFECTS = ["ALLOW", "DENY", "REQUIRE_APPROVAL", "AUDIT_ONLY"] as const;
export type PolicyEffect = (typeof POLICY_EFFECTS)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const AGENT_TYPES = [
  "COPILOT",
  "SAFETY_ANALYSIS",
  "INCIDENT_ANALYSIS",
  "REPORT",
  "RISK",
  "CAMERA_HEALTH",
  "NOTIFICATION",
  "WORKFLOW",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_RISK = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type AgentRisk = (typeof AGENT_RISK)[number];

export const AI_ACTION_MODES = ["OBSERVE", "RECOMMEND", "DRAFT", "APPROVAL", "AUTONOMOUS"] as const;
export type AIActionMode = (typeof AI_ACTION_MODES)[number];

export const JOB_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "RETRYING", "DEAD"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ENTERPRISE_EVENT_TYPES = [
  "USER_CREATED",
  "CAMERA_OFFLINE",
  "ALERT_CREATED",
  "INCIDENT_CREATED",
  "EMERGENCY_CREATED",
  "TASK_OVERDUE",
  "REPORT_CREATED",
  "PAYMENT_FAILED",
  "AUTOMATION_FAILED",
  "APPROVAL_REQUESTED",
  "APPROVAL_DECIDED",
  "AGENT_DISABLED",
] as const;

export const HIGH_IMPACT_ACTIONS = [
  "DELETE_INCIDENT",
  "DELETE_ORGANIZATION",
  "BULK_USER_OPERATION",
  "DATA_DELETION",
  "BILLING_CHANGE",
  "API_KEY_CREATE",
  "EXTERNAL_COMMUNICATION",
  "PERMISSION_CHANGE",
  "DISABLE_ALL_CAMERAS",
  "MASS_NOTIFICATION",
] as const;

export const AUTOMATION_TEMPLATES = [
  {
    key: "camera_offline_response",
    name: "Camera Offline Response",
    description: "When a camera goes offline, create alert, notify security, open maintenance task.",
    risk: "MEDIUM",
    trigger: { type: "CAMERA", event: "CAMERA_OFFLINE" },
    actions: ["CREATE_ALERT", "NOTIFY_TEAM", "CREATE_TASK", "AUDIT"],
  },
  {
    key: "critical_alert_escalation",
    name: "Critical Alert Escalation",
    description: "Escalate critical alerts to supervisors and request acknowledgment.",
    risk: "HIGH",
    trigger: { type: "ALERT", event: "ALERT_CREATED" },
    actions: ["NOTIFY_SUPERVISOR", "REQUIRE_APPROVAL", "ESCALATE"],
  },
  {
    key: "daily_safety_briefing",
    name: "Daily Safety Briefing",
    description: "Schedule morning safety briefing generation.",
    risk: "LOW",
    trigger: { type: "SCHEDULE", cron: "0 8 * * *" },
    actions: ["RUN_AI_ANALYSIS", "NOTIFY_ADMIN"],
  },
  {
    key: "weekly_safety_report",
    name: "Weekly Safety Report",
    description: "Generate weekly safety report every Monday.",
    risk: "LOW",
    trigger: { type: "SCHEDULE", cron: "0 9 * * 1" },
    actions: ["GENERATE_REPORT", "NOTIFY_ADMIN"],
  },
  {
    key: "overdue_task_reminder",
    name: "Overdue Task Reminder",
    description: "Remind owners and escalate overdue tasks.",
    risk: "MEDIUM",
    trigger: { type: "TASK", event: "TASK_OVERDUE" },
    actions: ["NOTIFY_USER", "NOTIFY_SUPERVISOR", "AUDIT"],
  },
  {
    key: "incident_follow_up",
    name: "Incident Follow-up",
    description: "After incident creation, assign follow-up and track.",
    risk: "MEDIUM",
    trigger: { type: "INCIDENT", event: "INCIDENT_CREATED" },
    actions: ["CREATE_TASK", "NOTIFY_TEAM", "AUDIT"],
  },
] as const;

/** Unsafe automations — hard-blocked regardless of config. */
export const FORBIDDEN_AUTOMATION_ACTIONS = [
  "DELETE_EVERYTHING",
  "CHANGE_ALL_PERMISSIONS",
  "DISABLE_ALL_CAMERAS",
  "UNCONTROLLED_MASS_COMMUNICATION",
  "PHYSICAL_HARDWARE_CONTROL",
  "CONTACT_EMERGENCY_SERVICES",
] as const;
