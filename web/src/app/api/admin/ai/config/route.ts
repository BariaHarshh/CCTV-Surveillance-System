import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canConfigureAI, canViewAI } from "@/lib/ai/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrCreateOrgAISettings } from "@/lib/ai/config-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const settings = await getOrCreateOrgAISettings(organizationId);
    return apiSuccess({ settings: settings.toObject() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const body = await request.json();
    const { updateOrgAISettings } = await import("@/lib/ai/config-service");
    const settings = await updateOrgAISettings(organizationId, body);
    return apiSuccess({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
