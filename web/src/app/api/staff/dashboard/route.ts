import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireStaff } from "@/lib/auth/require-staff";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrganizationById } from "@/lib/organizations/service";

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
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        professional: user.professional,
        lastLogin: user.lastLogin?.toISOString() ?? null,
        lastActive: user.lastActive?.toISOString() ?? null,
      },
      organization: org
        ? { name: org.name, organizationId: org.organizationId, status: org.status }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
