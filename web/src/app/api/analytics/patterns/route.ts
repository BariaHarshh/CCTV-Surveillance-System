import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewAnalytics } from "@/lib/analytics/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { detectPatterns, listPatterns, persistDetectedPatterns } from "@/lib/analytics/pattern-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewAnalytics(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const filters = parseAnalyticsFilters(request.nextUrl.searchParams);
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    if (refresh) {
      const patterns = await persistDetectedPatterns(organizationId, filters);
      return apiSuccess({ patterns, disclaimer: "Pattern confidence is for the detection calculation, not future prediction." });
    }
    const existing = await listPatterns(organizationId);
    if (existing.length === 0) {
      const detected = await detectPatterns(organizationId, filters);
      return apiSuccess(detected);
    }
    return apiSuccess({ empty: false, patterns: existing });
  } catch (error) {
    return handleApiError(error);
  }
}
