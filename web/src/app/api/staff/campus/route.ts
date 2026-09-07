import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireStaff } from "@/lib/auth/require-staff";
import { can } from "@/lib/permissions/capabilities";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getCampusOverview, getCampusHierarchy } from "@/lib/campus/service";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireStaff();
    if (!can(user, "campus.view")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const overview = await getCampusOverview(organizationId);
    const hierarchy = await getCampusHierarchy(organizationId);
    return apiSuccess({ campus: overview, hierarchy });
  } catch (error) {
    return handleApiError(error);
  }
}
