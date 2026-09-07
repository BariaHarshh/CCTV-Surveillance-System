import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireStaff } from "@/lib/auth/require-staff";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrganizationById } from "@/lib/organizations/service";
import { User } from "@/models/User";
import { z } from "zod";

const profileSchema = z.object({
  personal: z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    photo: z.string().optional(),
  }),
});

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireStaff();
    const org = await getOrganizationById(organizationId);
    return apiSuccess({
      user: {
        id: user._id.toString(),
        name: user.name,
        userId: user.userId,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        profile: user.profile,
        professional: user.professional,
        lastLogin: user.lastLogin?.toISOString() ?? null,
        lastActive: user.lastActive?.toISOString() ?? null,
      },
      organization: org ? { name: org.name, organizationId: org.organizationId } : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireStaff();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid data.", 400, "VALIDATION_ERROR");

    const dbUser = await User.findById(user._id);
    if (!dbUser) return apiError("User not found.", 404, "NOT_FOUND");

    dbUser.profile = { ...dbUser.profile, ...parsed.data.personal };
    await dbUser.save();

    await logAuditEvent({
      actor: user,
      action: "STAFF_PROFILE_UPDATED",
      description: `${user.name} updated their profile`,
      request,
      metadata: { organizationId },
    });

    return apiSuccess({ message: "Profile updated." });
  } catch (error) {
    return handleApiError(error);
  }
}
