import type { IUser } from "@/models/User";
import type { IOrganization } from "@/models/Organization";
import { Organization } from "@/models/Organization";
import { AuthError, requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";

export interface StaffContext {
  user: IUser;
  organization: IOrganization;
  organizationId: string;
}

export async function requireStaff(): Promise<StaffContext> {
  const user = await requireAuth();

  if (user.role !== "STAFF") {
    throw new AuthError("FORBIDDEN", "Staff access required.");
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN", "Account is not active.");
  }

  if (!user.organizationId) {
    throw new AuthError("FORBIDDEN", "No organization assigned to this account.");
  }

  await connectDB();
  const organization = await Organization.findOne({
    _id: user.organizationId,
    deletedAt: null,
  });

  if (!organization) {
    throw new AuthError("FORBIDDEN", "Organization not found.");
  }

  if (organization.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN", "Organization is not active.");
  }

  return {
    user,
    organization,
    organizationId: organization._id.toString(),
  };
}
