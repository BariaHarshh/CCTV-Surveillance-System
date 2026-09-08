import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewMonitoring } from "@/lib/monitoring/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getMonitoringOverview } from "@/lib/monitoring/monitoring-stats";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMonitoring(user)) return apiSuccess({ overview: null });

    const overview = await getMonitoringOverview(organizationId);
    return apiSuccess({ overview });
  } catch (error) {
    return handleApiError(error);
  }
}
