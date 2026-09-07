export function formatRoleLabel(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "STAFF":
      return "Staff";
    default:
      return role;
  }
}

export function getDefaultRedirectForRole(role: string, mustChangePassword = false): string {
  if (mustChangePassword && (role === "ADMIN" || role === "STAFF")) {
    return "/change-password";
  }
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";
    case "ADMIN":
      return "/admin/dashboard";
    case "STAFF":
      return "/staff/dashboard";
    default:
      return "/login";
  }
}

export function getPasswordChangePath(): string {
  return "/change-password";
}

/** Post-login destination: password change always wins over ?redirect= */
export function resolvePostLoginRedirect(
  role: string,
  mustChangePassword: boolean,
  redirectParam?: string | null
): string {
  if (mustChangePassword && (role === "ADMIN" || role === "STAFF")) {
    return getPasswordChangePath();
  }
  if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
    return redirectParam;
  }
  return getDefaultRedirectForRole(role, false);
}

export function canAccessSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}
