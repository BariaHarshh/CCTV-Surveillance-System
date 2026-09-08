import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { searchOrganizationUsers } from "@/lib/admin/statistics";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const results = await searchOrganizationUsers(organizationId, q);
    return apiSuccess({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
