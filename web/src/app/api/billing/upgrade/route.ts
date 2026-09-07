import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getPaymentProvider } from "@/lib/platform/billing-service";
import { PLAN_IDS } from "@/lib/platform/constants";

const schema = z.object({
  planId: z.enum(PLAN_IDS),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const provider = getPaymentProvider();
    const session = await provider.createCheckoutSession({
      organizationId,
      planId: parsed.data.planId,
      successUrl: parsed.data.successUrl ?? `${appUrl}/admin/billing?upgraded=1`,
      cancelUrl: parsed.data.cancelUrl ?? `${appUrl}/admin/billing?cancelled=1`,
    });

    await logAuditEvent({
      actor: user,
      action: "BILLING_UPGRADED",
      description: `${user.name} upgraded plan to ${parsed.data.planId}`,
      request,
      targetType: "Subscription",
      targetLabel: parsed.data.planId,
      metadata: { organizationId, planId: parsed.data.planId, provider: provider.name },
    });

    return apiSuccess({ checkout: session });
  } catch (error) {
    return handleApiError(error);
  }
}
