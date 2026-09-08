import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listServiceCatalog } from "@/lib/enterprise/health-service";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    return apiSuccess({ services: listServiceCatalog() });
  } catch (error) {
    return handleApiError(error);
  }
}
