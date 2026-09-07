import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewIncidents } from "@/lib/ai/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listIncidents } from "@/lib/ai/incident-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewIncidents(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listIncidents(organizationId, {
      status: params.status,
      q: params.q,
      page: params.page ? parseInt(params.page, 10) : 1,
      limit: params.limit ? parseInt(params.limit, 10) : 20,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
