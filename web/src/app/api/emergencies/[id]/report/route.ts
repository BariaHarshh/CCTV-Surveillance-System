import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getEmergencyReport } from "@/lib/emergency/command-center-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const report = await getEmergencyReport(organizationId, id);
    if (!report) return apiError("Emergency not found.", 404, "NOT_FOUND");
    return apiSuccess({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
