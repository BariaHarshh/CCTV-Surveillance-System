import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canGenerateReports, canViewReports } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { cancelReport, getReport } from "@/lib/analytics/report-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewReports(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const report = await getReport(organizationId, id);
    if (!report) return apiError("Report not found.", 404, "NOT_FOUND");
    return apiSuccess({ report });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canGenerateReports(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action === "cancel") {
      const report = await cancelReport(organizationId, id);
      if (!report) return apiError("Report not found.", 404, "NOT_FOUND");
      return apiSuccess({ report });
    }
    return apiError("Unknown action.", 400, "VALIDATION_ERROR");
  } catch (error) {
    return handleApiError(error);
  }
}
