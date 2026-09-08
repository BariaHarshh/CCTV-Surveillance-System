import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { validateInternalEventRequest } from "@/lib/monitoring/internal-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getAIHealthMetrics } from "@/lib/ai/health-service";

export async function POST(request: NextRequest) {
  try {
    if (!validateInternalEventRequest(request)) {
      return apiError("Forbidden.", 403, "FORBIDDEN");
    }
    await ensureDbReady();
    const body = await request.json();
    const organizationId = body.organizationId as string;
    if (!organizationId) return apiError("organizationId required.", 400, "VALIDATION_ERROR");
    const health = await getAIHealthMetrics(organizationId);
    return apiSuccess({ health });
  } catch (error) {
    return handleApiError(error);
  }
}
