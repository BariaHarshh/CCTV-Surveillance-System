import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewCommandCenter } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getCommandCenterOverview } from "@/lib/emergency/command-center-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewCommandCenter(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const overview = await getCommandCenterOverview(organizationId, {
      buildingId: params.buildingId,
      severity: params.severity,
      emergencyType: params.emergencyType,
      incidentStatus: params.incidentStatus,
      teamId: params.teamId,
      assignedTo: params.assignedTo,
    });
    return apiSuccess({ overview });
  } catch (error) {
    return handleApiError(error);
  }
}
