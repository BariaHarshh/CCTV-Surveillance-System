import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewMonitoring } from "@/lib/monitoring/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listMonitoringCameras } from "@/lib/monitoring/stream-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMonitoring(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const cameras = await listMonitoringCameras(organizationId);
    return apiSuccess({ cameras });
  } catch (error) {
    return handleApiError(error);
  }
}
