import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewExecutive } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { analyticsService } from "@/lib/analytics/analytics-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewExecutive(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const filters = parseAnalyticsFilters(request.nextUrl.searchParams);
    const overview = await analyticsService.executive(organizationId, filters);
    await logAuditEvent({
      actor: user,
      action: "EXECUTIVE_DASHBOARD_VIEWED",
      description: `${user.name} viewed executive dashboard`,
      request,
    });
    return apiSuccess({ overview });
  } catch (error) {
    return handleApiError(error);
  }
}
