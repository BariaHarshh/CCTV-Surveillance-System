import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canGenerateReports } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canGenerateReports(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const { cancelReport } = await import("@/lib/analytics/report-service");
    const report = await cancelReport(organizationId, id);
    if (!report) return apiError("Report not found.", 404, "NOT_FOUND");
    return apiSuccess({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
