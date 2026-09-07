import { can } from "@/lib/permissions/capabilities";
import type { IUser } from "@/models/User";
import { MOBILE_PERMISSIONS } from "@/lib/mobile/constants";

export function canViewFieldOps(user: Pick<IUser, "role" | "permissions">) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return can(user as never, MOBILE_PERMISSIONS.fieldView) || can(user as never, "incident:view");
}

export function canManageFieldTasks(user: Pick<IUser, "role" | "permissions">) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return can(user as never, MOBILE_PERMISSIONS.fieldManage);
}

export function canViewTeams(user: Pick<IUser, "role" | "permissions">) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return can(user as never, MOBILE_PERMISSIONS.teamView);
}

export function canManageTeams(user: Pick<IUser, "role" | "permissions">) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return can(user as never, MOBILE_PERMISSIONS.teamManage);
}

export function canEmergencyAct(user: Pick<IUser, "role" | "permissions">) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return can(user as never, MOBILE_PERMISSIONS.emergencyManage) || can(user as never, "emergency:activate");
}

export function canBroadcast(user: Pick<IUser, "role" | "permissions">) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return can(user as never, MOBILE_PERMISSIONS.emergencyManage);
}
