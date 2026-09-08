import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAnalytics } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { analyticsService } from "@/lib/analytics/analytics-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const filters = parseAnalyticsFilters(request.nextUrl.searchParams);
    const [summary, volume] = await Promise.all([
      analyticsService.alerts(organizationId, filters),
      analyticsService.alertVolume(organizationId, filters),
    ]);
    return apiSuccess({ data: { summary, volume } });
  } catch (error) {
    return handleApiError(error);
  }
}
