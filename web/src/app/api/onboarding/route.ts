import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getOnboardingStatus, markOnboardingStep } from "@/lib/platform/settings-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    return apiSuccess({ onboarding: await getOnboardingStatus(organizationId) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const body = await request.json();
    if (!body.step) return apiError("step required.", 400, "VALIDATION_ERROR");
    const onboarding = await markOnboardingStep(organizationId, body.step, body.done !== false);
    return apiSuccess({ onboarding });
  } catch (error) {
    return handleApiError(error);
  }
}
