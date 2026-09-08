import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canViewAI } from "@/lib/ai/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getAIHealthMetrics } from "@/lib/ai/health-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const health = await getAIHealthMetrics(organizationId);
    return apiSuccess({ health });
  } catch (error) {
    return handleApiError(error);
  }
}
