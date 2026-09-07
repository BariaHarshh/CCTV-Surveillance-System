export const ORGANIZATION_TYPES = [
  "University",
  "College",
  "School",
  "Institute",
  "Training Center",
  "Other",
] as const;

export const CAMPUS_TYPES = [
  "Main Campus",
  "Branch Campus",
  "Residential Campus",
  "Urban Campus",
  "Rural Campus",
  "Multi-Campus Organization",
] as const;

export const USE_CASES = [
  "Campus Security",
  "School Safety",
  "University Security",
  "Classroom Monitoring",
  "Laboratory Safety",
  "Access Monitoring",
  "CCTV Intelligence",
  "Emergency Monitoring",
  "Other",
] as const;

export const SAFETY_PRIORITIES = [
  "Unauthorized Access",
  "After-Hours Activity",
  "Classroom Occupancy",
  "Abandoned Objects",
  "Fire / Smoke",
  "Faculty Presence",
  "PPE Compliance",
  "Unusual Activity",
  "Emergency Response",
] as const;

export const JOB_TITLES = [
  "Campus Administrator",
  "Security Administrator",
  "IT Administrator",
  "Operations Administrator",
  "HOD",
  "Other",
] as const;

export const ADMIN_PERMISSIONS = {
  organization: [
    "org:view",
    "org:edit",
    "org:settings:view",
  ],
  staff: [
    "staff:create",
    "staff:view",
    "staff:edit",
    "staff:suspend",
    "staff:activate",
    "staff:reset-password",
  ],
  monitoring: [
    "monitoring:dashboard",
    "monitoring:cameras",
    "monitoring:alerts",
    "monitoring:events",
  ],
  reports: ["reports:view", "reports:export"],
  security: ["security:activity", "security:sessions"],
} as const;

export const ALL_ADMIN_PERMISSIONS = Object.values(ADMIN_PERMISSIONS).flat();

export const DEFAULT_ADMIN_PERMISSIONS = [
  "org:view",
  "org:settings:view",
  "staff:view",
  "monitoring:dashboard",
  "monitoring:cameras",
  "monitoring:alerts",
  "monitoring:events",
  "reports:view",
  "security:activity",
];
