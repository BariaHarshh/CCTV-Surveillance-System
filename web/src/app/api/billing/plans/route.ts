import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPlans } from "@/lib/platform/billing-service";

export async function GET() {
  try {
    await ensureDbReady();
    await requireAdmin();
    const plans = await listPlans();
    return apiSuccess({
      plans: plans.map((p) => ({
        planId: p.planId,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        billingInterval: p.billingInterval,
        limits: p.limits,
        features: p.features,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
