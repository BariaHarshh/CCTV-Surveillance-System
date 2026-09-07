import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getAdminById } from "@/lib/admins/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const { id } = await params;
    const admin = await getAdminById(id);
    if (!admin) return apiError("Administrator not found.", 404, "NOT_FOUND");
    return apiSuccess({ admin });
  } catch (error) {
    return handleApiError(error);
  }
}
