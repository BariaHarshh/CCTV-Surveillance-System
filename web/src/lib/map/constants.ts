export const MAP_MODES = [
  "STANDARD",
  "SATELLITE",
  "DARK",
  "EMERGENCY",
  "RISK",
  "CAMERA",
  "INCIDENT",
  "RESPONSE",
  "ASSET",
] as const;
export type MapMode = (typeof MAP_MODES)[number];

export const MAP_OBJECT_TYPES = [
  "ROOM",
  "CAMERA",
  "DOOR",
  "EXIT",
  "STAIR",
  "ELEVATOR",
  "MEDICAL",
  "SECURITY",
  "ASSEMBLY_AREA",
  "ASSET",
  "ENTRANCE",
  "PARKING",
  "OTHER",
] as const;
export type MapObjectType = (typeof MAP_OBJECT_TYPES)[number];

export const FLOOR_PLAN_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type FloorPlanStatus = (typeof FLOOR_PLAN_STATUSES)[number];

export const FLOOR_PLAN_MIME = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
] as const;

export const ZONE_TYPES = [
  "SECURITY",
  "RESTRICTED",
  "EMERGENCY",
  "PATROL",
  "HIGH_RISK",
  "CUSTOM",
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const EXIT_STATUSES = ["OPEN", "BLOCKED", "UNKNOWN", "MAINTENANCE"] as const;
export type ExitStatus = (typeof EXIT_STATUSES)[number];

export const ASSEMBLY_STATUSES = ["OPEN", "CLOSED", "UNKNOWN", "MAINTENANCE"] as const;

export const EQUIPMENT_TYPES = [
  "FIRE_EXTINGUISHER",
  "AED",
  "FIRST_AID",
  "EMERGENCY_PHONE",
  "ALARM",
  "SAFETY_EQUIPMENT",
] as const;

export const ASSET_TYPES = [
  "CAMERA",
  "ACCESS_POINT",
  "EMERGENCY_EQUIPMENT",
  "NETWORK_EQUIPMENT",
  "SECURITY_EQUIPMENT",
  "FACILITIES_EQUIPMENT",
  "OTHER",
] as const;

export const ASSET_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "UNKNOWN"] as const;

export const TEAM_MAP_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "RESPONDING",
  "ON_SCENE",
  "UNAVAILABLE",
] as const;

export const GEO_EVENT_TYPES = [
  "ENTER",
  "LEAVE",
  "MOVE",
  "UPDATE",
  "STALE",
] as const;

export const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL", "INSUFFICIENT_DATA"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const TIME_RANGES = ["TODAY", "7D", "30D", "90D", "CUSTOM"] as const;
export type TimeRangeKey = (typeof TIME_RANGES)[number];

export const DAY_PARTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;

export const AFFECTED_AREA_KINDS = ["POINT", "CIRCLE", "POLYGON"] as const;

export const MAP_LAYER_KEYS = [
  "campuses",
  "buildings",
  "cameras",
  "incidents",
  "alerts",
  "responseTeams",
  "emergencyPoints",
  "assets",
  "exits",
  "assemblyAreas",
  "zones",
  "coverage",
  "heatmap",
] as const;

export const MAP_PERMISSIONS = {
  view: ["map:view", "campus:view", "org:view"],
  edit: ["map:edit", "campus:edit", "org:edit"],
  floorPlan: ["map:floorplan", "campus:edit", "org:edit"],
  zones: ["map:zones", "campus:edit", "org:edit"],
  export: ["map:export", "analytics:export", "org:edit"],
  locationSensitive: ["map:location:sensitive", "org:edit"],
  teamLocation: ["map:team:location", "emergency:teams", "org:view"],
} as const;

export const LEGEND_ITEMS = [
  { key: "CAMERA", label: "Camera", color: "#38bdf8", icon: "camera" },
  { key: "INCIDENT", label: "Incident", color: "#f59e0b", icon: "alert" },
  { key: "CRITICAL_INCIDENT", label: "Critical Incident", color: "#ef4444", icon: "alert-critical" },
  { key: "EMERGENCY", label: "Emergency", color: "#dc2626", icon: "emergency" },
  { key: "RESPONSE_TEAM", label: "Response Team", color: "#a78bfa", icon: "users" },
  { key: "MEDICAL", label: "Medical", color: "#34d399", icon: "medical" },
  { key: "SECURITY", label: "Security", color: "#60a5fa", icon: "shield" },
  { key: "ENTRANCE", label: "Entrance", color: "#94a3b8", icon: "entrance" },
  { key: "EXIT", label: "Exit", color: "#f97316", icon: "exit" },
  { key: "ASSEMBLY_AREA", label: "Assembly Area", color: "#22d3ee", icon: "assembly" },
] as const;

/** Max objects returned per viewport query. */
export const MAP_VIEWPORT_LIMIT = 2000;

export const CLUSTER_PIXEL_THRESHOLD = 48;
