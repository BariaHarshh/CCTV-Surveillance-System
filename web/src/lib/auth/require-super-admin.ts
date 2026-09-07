import type { IUser } from "@/models/User";
import { AuthError, requireAuth } from "@/lib/auth/session";

export async function requireSuperAdmin(): Promise<IUser> {
  const user = await requireAuth();

  if (user.role !== "SUPER_ADMIN") {
    throw new AuthError("FORBIDDEN", "Super Admin access required.");
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN", "Account is not active.");
  }

  return user;
}
