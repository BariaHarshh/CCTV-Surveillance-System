import type { IUser } from "@/models/User";
import { can, canAny } from "@/lib/permissions/capabilities";
import { MONITORING_PERMISSIONS } from "@/lib/monitoring/constants";

export function canViewMonitoring(user: IUser): boolean {
  return canAny(user, [...MONITORING_PERMISSIONS.view, "camera:view"]);
}

export function canViewEvents(user: IUser): boolean {
  return can(user, "event.view");
}

export function canViewAlerts(user: IUser): boolean {
  return can(user, "alert.view");
}

export function canAcknowledgeAlert(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...MONITORING_PERMISSIONS.alertAck, "org:edit"]);
}

export function canInvestigateAlert(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...MONITORING_PERMISSIONS.alertInvestigate, "org:edit"]);
}

export function canResolveAlert(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...MONITORING_PERMISSIONS.alertResolve, "org:edit"]);
}

export function canDismissAlert(user: IUser): boolean {
  return user.role === "ADMIN" || canAny(user, [...MONITORING_PERMISSIONS.alertDismiss, "org:edit"]);
}

export function canViewNotifications(user: IUser): boolean {
  return canViewMonitoring(user) || canViewAlerts(user);
}
