import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewInsights } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { generateInsights, listInsights } from "@/lib/analytics/insight-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewInsights(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    if (refresh) {
      const filters = parseAnalyticsFilters(request.nextUrl.searchParams);
      const result = await generateInsights(organizationId, filters);
      return apiSuccess(result);
    }
    const insights = await listInsights(organizationId);
    return apiSuccess({
      empty: insights.length === 0,
      insights,
      message: insights.length === 0 ? "No insights available. Generate from verified metrics." : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
