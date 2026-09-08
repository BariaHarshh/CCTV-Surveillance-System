import type { IUser } from "@/models/User";
import { can, canAny } from "@/lib/permissions/capabilities";
import { ANALYTICS_PERMISSIONS } from "@/lib/analytics/constants";

function isAdmin(user: IUser) {
  return user.role === "ADMIN";
}

export function canViewAnalytics(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...ANALYTICS_PERMISSIONS.view, "monitoring:view", "org:view"]);
}

export function canExportAnalytics(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...ANALYTICS_PERMISSIONS.export, "org:edit"]);
}

export function canViewExecutive(user: IUser): boolean {
  return isAdmin(user) || can(user, "executive.view") || canAny(user, ["org:view"]);
}

export function canViewReports(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...ANALYTICS_PERMISSIONS.reports, "org:view"]);
}

export function canGenerateReports(user: IUser): boolean {
  return isAdmin(user) || canAny(user, ["reports:generate", "org:edit"]);
}

export function canViewActions(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...ANALYTICS_PERMISSIONS.actions, "org:view"]);
}

export function canManageActions(user: IUser): boolean {
  return isAdmin(user) || canAny(user, ["actions:manage", "org:edit"]);
}

export function canViewInsights(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...ANALYTICS_PERMISSIONS.insights, "org:view", "monitoring:view"]);
}
