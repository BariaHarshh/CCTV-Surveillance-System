import type { IUser } from "@/models/User";

/** Map spec dot-notation to internal colon keys */
const PERMISSION_ALIASES: Record<string, string> = {
  "campus.view": "campus:view",
  "campus.edit": "campus:edit",
  "building.view": "building:view",
  "building.create": "building:create",
  "building.edit": "building:edit",
  "room.view": "room:view",
  "room.create": "room:create",
  "room.edit": "room:edit",
  "camera.view": "camera:view",
  "camera.create": "camera:create",
  "camera.edit": "camera:edit",
  "camera.test": "camera:test",
  "camera.delete": "camera:delete",
  "event.view": "monitoring:events",
  "alert.view": "monitoring:alerts",
  "monitoring.view": "monitoring:view",
  "alert.acknowledge": "alert:acknowledge",
  "alert.investigate": "alert:investigate",
  "alert.resolve": "alert:resolve",
  "alert.dismiss": "alert:dismiss",
  "ai.view": "ai:view",
  "ai.configure": "ai:configure",
  "detection.view": "detection:view",
  "detection.configure": "detection:configure",
  "incident.view": "incident:view",
  "incident.manage": "incident:manage",
  "incident.escalate": "incident:escalate",
  "incident.assign": "incident:assign",
  "risk.view": "risk:view",
  "event.feedback": "event:feedback",
  "camera.ai.configure": "camera:ai:configure",
  "emergency.view": "emergency:view",
  "emergency.activate": "emergency:activate",
  "emergency.manage": "emergency:manage",
  "emergency.resolve": "emergency:resolve",
  "response_team.view": "response_team:view",
  "response_team.manage": "response_team:manage",
  "response_task.view": "response_task:view",
  "response_task.manage": "response_task:manage",
  "playbook.view": "playbook:view",
  "playbook.manage": "playbook:manage",
  "emergency_contact.view": "emergency_contact:view",
  "emergency_contact.manage": "emergency_contact:manage",
  "command_center.view": "command_center:view",
  "analytics.view": "analytics:view",
  "analytics.export": "analytics:export",
  "reports.view": "reports:view",
  "reports.generate": "reports:generate",
  "executive.view": "executive:view",
  "actions.view": "actions:view",
  "actions.manage": "actions:manage",
  "insights.view": "insights:view",
  "report.view": "reports:view",
  "dashboard.view": "dashboard:view",
};

const LEGACY_ALIASES: Record<string, string[]> = {
  "camera:view": ["monitoring:cameras"],
  "campus:view": ["org:view"],
  "event.view": ["monitoring:events"],
  "alert.view": ["monitoring:alerts"],
};

export function normalizePermission(permission: string): string {
  return PERMISSION_ALIASES[permission] ?? permission;
}

export function can(user: Pick<IUser, "role" | "permissions"> | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;

  const normalized = normalizePermission(permission);
  const perms = user.permissions ?? [];

  if (perms.includes(normalized)) return true;

  const legacy = LEGACY_ALIASES[normalized];
  if (legacy?.some((p) => perms.includes(p))) return true;

  // Admin org:edit can edit campus
  if (normalized === "campus:edit" && perms.includes("org:edit")) return true;

  if (user.role === "ADMIN") {
    const adminLegacy: Record<string, string[]> = {
      "campus:view": ["org:view"],
      "campus:edit": ["org:edit"],
      "building:view": ["org:view", "monitoring:cameras"],
      "building:create": ["org:edit"],
      "building:edit": ["org:edit"],
      "building:status": ["org:edit"],
      "room:view": ["org:view"],
      "room:create": ["org:edit"],
      "room:edit": ["org:edit"],
      "room:status": ["org:edit"],
      "camera:view": ["monitoring:cameras", "monitoring:view"],
      "camera:create": ["org:edit"],
      "camera:edit": ["org:edit"],
      "camera:test": ["org:edit", "monitoring:cameras"],
      "camera:delete": ["org:edit"],
      "camera:status": ["org:edit"],
      "monitoring:view": ["monitoring:dashboard", "monitoring:cameras"],
      "alert:acknowledge": ["org:edit"],
      "alert:investigate": ["org:edit"],
      "alert:resolve": ["org:edit"],
      "alert:dismiss": ["org:edit"],
      "ai:view": ["org:view", "monitoring:view"],
      "ai:configure": ["org:edit"],
      "detection:view": ["monitoring:events", "monitoring:view"],
      "detection:configure": ["org:edit"],
      "incident:view": ["monitoring:events", "monitoring:alerts"],
      "incident:manage": ["org:edit"],
      "incident:escalate": ["org:edit"],
      "incident:assign": ["org:edit", "monitoring:alerts"],
      "risk:view": ["monitoring:view"],
      "event:feedback": ["monitoring:events"],
      "camera:ai:configure": ["org:edit", "camera:edit"],
      "emergency:view": ["org:view", "monitoring:view", "monitoring:alerts"],
      "emergency:activate": ["org:edit"],
      "emergency:manage": ["org:edit"],
      "emergency:resolve": ["org:edit"],
      "response_team:view": ["org:view", "monitoring:view"],
      "response_team:manage": ["org:edit"],
      "response_task:view": ["monitoring:alerts", "monitoring:events"],
      "response_task:manage": ["org:edit", "monitoring:alerts"],
      "playbook:view": ["org:view"],
      "playbook:manage": ["org:edit"],
      "emergency_contact:view": ["org:view", "monitoring:alerts"],
      "emergency_contact:manage": ["org:edit"],
      "command_center:view": ["org:view", "monitoring:view", "monitoring:dashboard"],
      "analytics:view": ["org:view", "monitoring:view", "reports:view"],
      "analytics:export": ["org:edit", "reports:view"],
      "reports:view": ["org:view", "monitoring:view"],
      "reports:generate": ["org:edit", "reports:view"],
      "executive:view": ["org:view"],
      "actions:view": ["org:view", "monitoring:alerts"],
      "actions:manage": ["org:edit"],
      "insights:view": ["org:view", "monitoring:view"],
    };
    const grants = adminLegacy[normalized];
    if (grants?.some((p) => perms.includes(p))) return true;
  }

  return false;
}

export function canAny(user: Pick<IUser, "role" | "permissions"> | null | undefined, permissions: string[]): boolean {
  return permissions.some((p) => can(user, p));
}
