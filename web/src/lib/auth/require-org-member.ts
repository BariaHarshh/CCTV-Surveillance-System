import type { IUser } from "@/models/User";
import { Organization } from "@/models/Organization";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";

export interface OrgMemberContext {
  user: IUser;
  organizationId: string;
}

export async function requireOrgMember(
  roles: Array<"SUPER_ADMIN" | "ADMIN" | "STAFF"> = ["SUPER_ADMIN", "ADMIN", "STAFF"]
): Promise<OrgMemberContext> {
  const user = await requireAuth();

  if (!roles.includes(user.role as "SUPER_ADMIN" | "ADMIN" | "STAFF")) {
    throw new AuthError("FORBIDDEN", "Access denied.");
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN", "Account is not active.");
  }

  await connectDB();
  let targetOrgId = user.organizationId?.toString();
  if (!targetOrgId && user.role === "SUPER_ADMIN") {
    const firstOrg = await Organization.findOne({ status: "ACTIVE", deletedAt: null });
    if (firstOrg) targetOrgId = firstOrg._id.toString();
  }

  if (!targetOrgId) {
    throw new AuthError("FORBIDDEN", "No organization assigned.");
  }

  const organization = await Organization.findOne({ _id: targetOrgId, deletedAt: null });
  if (!organization || organization.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN", "Organization not available.");
  }

  return { user, organizationId: organization._id.toString() };
}
