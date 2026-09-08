import type { IUser } from "@/models/User";
import { can, canAny } from "@/lib/permissions/capabilities";
import { EMERGENCY_PERMISSIONS } from "@/lib/emergency/constants";

function isAdmin(user: IUser) {
  return user.role === "ADMIN";
}

export function canViewEmergency(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.view, "monitoring:view", "monitoring:alerts"]);
}

export function canActivateEmergency(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.activate, "org:edit"]);
}

export function canManageEmergency(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.manage, "org:edit"]);
}

export function canResolveEmergency(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.resolve, "org:edit"]);
}

export function canEscalateIncident(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.incidentEscalate, "org:edit", "incident:manage"]);
}

export function canAssignIncident(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.incidentAssign, "org:edit", "incident:manage"]);
}

export function canViewResponseTeams(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.teamView, "org:view"]);
}

export function canManageResponseTeams(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.teamManage, "org:edit"]);
}

export function canViewTasks(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.taskView, "monitoring:alerts"]);
}

export function canManageTasks(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.taskManage, "org:edit"]);
}

export function canViewPlaybooks(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.playbookView, "org:view"]);
}

export function canManagePlaybooks(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.playbookManage, "org:edit"]);
}

export function canViewContacts(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.contactView, "org:view"]);
}

export function canManageContacts(user: IUser): boolean {
  return isAdmin(user) || canAny(user, [...EMERGENCY_PERMISSIONS.contactManage, "org:edit"]);
}

export function canViewCommandCenter(user: IUser): boolean {
  return isAdmin(user) || can(user, "command_center.view") || canAny(user, ["monitoring:view", "monitoring:dashboard", "org:view"]);
}
