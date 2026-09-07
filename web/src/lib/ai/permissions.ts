import type { IUser } from "@/models/User";
import { can, canAny } from "@/lib/permissions/capabilities";
import { AI_PERMISSIONS } from "@/lib/ai/constants";

export function canViewAI(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...AI_PERMISSIONS.view, "org:view"]);
}

export function canConfigureAI(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...AI_PERMISSIONS.configure, "org:edit"]);
}

export function canViewIncidents(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...AI_PERMISSIONS.incidentView, "monitoring:events"]);
}

export function canManageIncidents(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...AI_PERMISSIONS.incidentManage, "org:edit"]);
}

export function canSubmitEventFeedback(user: IUser): boolean {
  return canViewAI(user) || can(user, "event.view");
}

export function canConfigureCameraAI(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...AI_PERMISSIONS.cameraAiConfigure, "camera:edit", "org:edit"]);
}
