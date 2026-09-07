import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireStaff } from "@/lib/auth/require-staff";
import { can } from "@/lib/permissions/capabilities";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listBuildings } from "@/lib/campus/building-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireStaff();
    if (!can(user, "building.view")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { searchParams } = new URL(request.url);
    const buildings = await listBuildings(organizationId, { q: searchParams.get("q") ?? undefined });
    return apiSuccess({ buildings });
  } catch (error) {
    return handleApiError(error);
  }
}
