import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getRecentActivity } from "@/lib/super-admin/statistics";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const activity = await getRecentActivity(30);
    return apiSuccess({ activity });
  } catch (error) {
    return handleApiError(error);
  }
}
