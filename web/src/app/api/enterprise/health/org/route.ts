import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { computeOrganizationHealth } from "@/lib/enterprise/health-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const health = await computeOrganizationHealth(organizationId);
    return apiSuccess({ health });
  } catch (error) {
    return handleApiError(error);
  }
}
