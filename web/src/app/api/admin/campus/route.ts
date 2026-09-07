import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getCampusOverview, getCampusHierarchy, updateCampus } from "@/lib/campus/service";
import { campusUpdateSchema } from "@/lib/campus/schemas";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "campus.view")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const overview = await getCampusOverview(organizationId);
    const hierarchy = await getCampusHierarchy(organizationId);
    return apiSuccess({ campus: overview, hierarchy });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "campus.edit")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const body = await request.json();
    const parsed = campusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const campus = await updateCampus(organizationId, parsed.data);
    await logAuditEvent({
      actor: user,
      action: "CAMPUS_UPDATED",
      description: `${user.name} updated campus profile`,
      request,
      metadata: { organizationId },
    });
    return apiSuccess({ campus });
  } catch (error) {
    return handleApiError(error);
  }
}
