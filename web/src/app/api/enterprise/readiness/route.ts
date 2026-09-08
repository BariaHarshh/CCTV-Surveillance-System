import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { runSystemReadiness } from "@/lib/enterprise/health-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const readiness = await runSystemReadiness(organizationId);
    return apiSuccess({ readiness });
  } catch (error) {
    return handleApiError(error);
  }
}
