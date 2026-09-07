export const SAFETY_SCORE_LEVELS = [
  { min: 90, max: 100, label: "EXCELLENT" },
  { min: 75, max: 89, label: "GOOD" },
  { min: 60, max: 74, label: "ATTENTION" },
  { min: 40, max: 59, label: "HIGH_RISK" },
  { min: 0, max: 39, label: "CRITICAL" },
] as const;

export type SafetyScoreLabel = (typeof SAFETY_SCORE_LEVELS)[number]["label"];

export const TREND_DIRECTIONS = ["INCREASING", "DECREASING", "STABLE", "INSUFFICIENT_DATA"] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

export const PATTERN_TYPES = [
  "TIME_PATTERN",
  "LOCATION_PATTERN",
  "EVENT_PATTERN",
  "CAMERA_PATTERN",
  "OCCUPANCY_PATTERN",
  "AFTER_HOURS_PATTERN",
  "REPEATED_INCIDENT_PATTERN",
] as const;
export type PatternType = (typeof PATTERN_TYPES)[number];

export const PATTERN_STATUSES = ["ACTIVE", "RESOLVED", "DISMISSED", "MONITORING"] as const;
export type PatternStatus = (typeof PATTERN_STATUSES)[number];

export const ACTION_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const REPORT_TYPES = [
  "INCIDENT",
  "ALERT",
  "EMERGENCY",
  "CAMERA_HEALTH",
  "AI_PERFORMANCE",
  "RISK",
  "RESPONSE",
  "EXECUTIVE",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_STATUSES = ["QUEUED", "GENERATING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_FORMATS = ["PDF", "CSV", "EXCEL"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const INSIGHT_FEEDBACK = ["USEFUL", "NOT_USEFUL", "INCORRECT"] as const;
export type InsightFeedback = (typeof INSIGHT_FEEDBACK)[number];

export const ANALYTICS_PERMISSIONS = {
  view: ["analytics:view"],
  export: ["analytics:export"],
  reports: ["reports:view", "reports:generate"],
  executive: ["executive:view"],
  actions: ["actions:view", "actions:manage"],
  insights: ["insights:view"],
} as const;

export const MIN_SAMPLES_FOR_TREND = 3;
export const MIN_SAMPLES_FOR_ANOMALY = 7;
export const MIN_FEEDBACK_FOR_PRECISION = 10;

export function safetyScoreLabel(score: number): SafetyScoreLabel {
  for (const level of SAFETY_SCORE_LEVELS) {
    if (score >= level.min && score <= level.max) return level.label;
  }
  return "CRITICAL";
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function trendFromChange(change: number | null, sampleCount: number): TrendDirection {
  if (sampleCount < MIN_SAMPLES_FOR_TREND || change == null) return "INSUFFICIENT_DATA";
  if (Math.abs(change) < 5) return "STABLE";
  return change > 0 ? "INCREASING" : "DECREASING";
}
