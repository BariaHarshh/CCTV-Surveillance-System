export const CAMPUS_EMERGENCY_MODES = [
  "NORMAL",
  "ELEVATED",
  "EMERGENCY",
  "LOCKDOWN",
  "EVACUATION",
] as const;
export type CampusEmergencyMode = (typeof CAMPUS_EMERGENCY_MODES)[number];

export const EMERGENCY_TYPES = [
  "FIRE",
  "MEDICAL",
  "SECURITY",
  "INTRUSION",
  "VIOLENCE",
  "NATURAL_DISASTER",
  "HAZARDOUS_MATERIAL",
  "MISSING_PERSON",
  "CAMPUS_THREAT",
  "OTHER",
] as const;
export type EmergencyType = (typeof EMERGENCY_TYPES)[number];

export const EMERGENCY_STATUSES = ["ACTIVE", "CONTAINED", "RESOLVED", "CANCELLED"] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

export const EMERGENCY_TRANSITIONS: Record<EmergencyStatus, EmergencyStatus[]> = {
  ACTIVE: ["CONTAINED", "RESOLVED", "CANCELLED"],
  CONTAINED: ["RESOLVED", "ACTIVE", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
};

export const ESCALATION_LEVELS = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"] as const;
export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

export const RESPONSE_TEAM_TYPES = [
  "SECURITY",
  "MEDICAL",
  "FIRE",
  "ADMINISTRATION",
  "TECHNICAL",
  "EMERGENCY",
  "OTHER",
] as const;
export type ResponseTeamType = (typeof RESPONSE_TEAM_TYPES)[number];

export const RESPONSE_TEAM_STATUSES = ["AVAILABLE", "BUSY", "OFFLINE", "ON_LEAVE"] as const;
export type ResponseTeamStatus = (typeof RESPONSE_TEAM_STATUSES)[number];

export const RESPONSE_TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;
export type ResponseTaskStatus = (typeof RESPONSE_TASK_STATUSES)[number];

export const RESPONSE_TASK_TRANSITIONS: Record<ResponseTaskStatus, ResponseTaskStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED", "REJECTED"],
  IN_PROGRESS: ["PAUSED", "COMPLETED", "CANCELLED", "REJECTED"],
  PAUSED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export const PLAYBOOK_CATEGORIES = [
  "FIRE",
  "MEDICAL",
  "SECURITY",
  "INTRUSION",
  "EVACUATION",
  "NATURAL_DISASTER",
  "OTHER",
] as const;
export type PlaybookCategory = (typeof PLAYBOOK_CATEGORIES)[number];

export const BUILDING_OPS_STATUSES = [
  "NORMAL",
  "MONITORING",
  "AFFECTED",
  "EVACUATING",
  "RESTRICTED",
  "EMERGENCY",
] as const;
export type BuildingOpsStatus = (typeof BUILDING_OPS_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const EMERGENCY_PERMISSIONS = {
  view: ["emergency:view"],
  activate: ["emergency:activate"],
  manage: ["emergency:manage"],
  resolve: ["emergency:resolve"],
  incidentEscalate: ["incident:escalate"],
  incidentAssign: ["incident:assign"],
  teamView: ["response_team:view"],
  teamManage: ["response_team:manage"],
  taskView: ["response_task:view"],
  taskManage: ["response_task:manage"],
  playbookView: ["playbook:view"],
  playbookManage: ["playbook:manage"],
  contactView: ["emergency_contact:view"],
  contactManage: ["emergency_contact:manage"],
  commandCenter: ["command_center:view"],
} as const;

export const DEFAULT_PLAYBOOKS: Array<{
  name: string;
  category: PlaybookCategory;
  description: string;
  steps: string[];
}> = [
  {
    name: "Fire Response",
    category: "FIRE",
    description: "Organization-approved fire response workflow.",
    steps: [
      "Verify affected location",
      "Check nearby cameras",
      "Notify security",
      "Begin evacuation procedure",
      "Assign response team",
      "Record status",
      "Confirm area status",
    ],
  },
  {
    name: "Security Incident Response",
    category: "SECURITY",
    description: "Organization-approved security incident workflow.",
    steps: [
      "Verify alert",
      "Identify affected area",
      "Assign security team",
      "Restrict affected zone if configured",
      "Monitor cameras",
      "Record response",
      "Resolve incident",
    ],
  },
  {
    name: "Medical Response",
    category: "MEDICAL",
    description: "Organization-approved medical response workflow.",
    steps: [
      "Verify location and nature of medical need",
      "Dispatch medical response team",
      "Secure access routes for responders",
      "Monitor area via cameras",
      "Coordinate with campus administration",
      "Record response actions",
      "Confirm scene status",
    ],
  },
];

export const DEFAULT_ESCALATION_RULES = [
  {
    name: "Critical immediate",
    severity: "CRITICAL" as const,
    levels: ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"] as EscalationLevel[],
    timeoutMinutes: 5,
    eventTypes: [] as string[],
  },
  {
    name: "High priority",
    severity: "HIGH" as const,
    levels: ["LEVEL_1", "LEVEL_2", "LEVEL_3"] as EscalationLevel[],
    timeoutMinutes: 10,
    eventTypes: [] as string[],
  },
];
