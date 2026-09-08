import type { IUser } from "@/models/User";
import { can, canAny } from "@/lib/permissions/capabilities";
import { MAP_PERMISSIONS } from "@/lib/map/constants";

function isAdmin(user: Pick<IUser, "role">) {
  return user.role === "ADMIN";
}

export function canViewMap(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...MAP_PERMISSIONS.view]);
}

export function canEditMap(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...MAP_PERMISSIONS.edit]);
}

export function canManageFloorPlans(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...MAP_PERMISSIONS.floorPlan]);
}

export function canManageZones(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...MAP_PERMISSIONS.zones]);
}

export function canExportMap(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...MAP_PERMISSIONS.export]);
}

export function canViewSensitiveLocations(user: Pick<IUser, "role" | "permissions">) {
  return isAdmin(user) || canAny(user, [...MAP_PERMISSIONS.locationSensitive]);
}

export function canViewTeamLocations(user: Pick<IUser, "role" | "permissions">) {
  return (
    isAdmin(user) ||
    canAny(user, [...MAP_PERMISSIONS.teamLocation]) ||
    can(user, "command_center.view")
  );
}

export function canViewFloorPlanDrafts(user: Pick<IUser, "role" | "permissions">) {
  return canManageFloorPlans(user);
}
