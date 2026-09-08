import type { IUser } from "@/models/User";
import { AuthError } from "@/lib/auth/session";

export function hasPermission(user: IUser, permission: string): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  return user.permissions.includes(permission);
}

export function requirePermission(user: IUser, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw new AuthError("FORBIDDEN", "You do not have permission to perform this action.");
  }
}

import { ALL_STAFF_PERMISSIONS } from "@/lib/staff/constants";

export function filterAssignableStaffPermissions(
  adminPermissions: string[],
  requested: string[]
): string[] {
  const validStaff = new Set<string>(ALL_STAFF_PERMISSIONS);

  if (adminPermissions.includes("staff:create") || adminPermissions.includes("staff:edit")) {
    return requested.filter((p) => validStaff.has(p));
  }

  const allowed = new Set(adminPermissions);
  return requested.filter((p) => validStaff.has(p) && (allowed.has(p) || adminHasStaffGrant(adminPermissions, p)));
}

function adminHasStaffGrant(adminPermissions: string[], staffPermission: string): boolean {
  if (staffPermission.startsWith("dashboard:") && adminPermissions.includes("monitoring:dashboard")) {
    return true;
  }
  if (staffPermission.startsWith("org:") && adminPermissions.includes("org:view")) {
    return true;
  }
  if (staffPermission.startsWith("monitoring:") && adminPermissions.some((p) => p.startsWith("monitoring:"))) {
    return true;
  }
  if (staffPermission.startsWith("reports:") && adminPermissions.some((p) => p.startsWith("reports:"))) {
    return true;
  }
  if (staffPermission.startsWith("security:") && adminPermissions.some((p) => p.startsWith("security:"))) {
    return true;
  }
  return false;
}
