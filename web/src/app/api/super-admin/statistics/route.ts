import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getPlatformStatistics } from "@/lib/super-admin/statistics";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const statistics = await getPlatformStatistics();
    return apiSuccess({ statistics, generatedAt: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
