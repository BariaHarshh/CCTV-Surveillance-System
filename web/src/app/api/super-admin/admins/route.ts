import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAdminsList } from "@/lib/super-admin/statistics";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const admins = await getAdminsList();
    return apiSuccess({ admins });
  } catch (error) {
    return handleApiError(error);
  }
}
