import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { getPaymentProvider, changePlan } from "@/lib/platform/billing-service";
import { PLAN_IDS, type PlanId } from "@/lib/platform/constants";
import { logStructured } from "@/lib/platform/logging";

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-acg-signature") ??
      request.headers.get("x-payment-signature") ??
      request.headers.get("stripe-signature") ??
      "";

    const provider = getPaymentProvider();
    const event = await provider.verifyWebhook(rawBody, signature);

    logStructured("INFO", "payments-webhook", "Payment webhook received", {
      type: event.type,
      provider: provider.name,
    });

    if (event.type === "checkout.completed" || event.type === "subscription.updated") {
      const organizationId = String(event.data.organizationId ?? "");
      const planId = String(event.data.planId ?? "") as PlanId;
      if (organizationId && PLAN_IDS.includes(planId)) {
        await changePlan(organizationId, planId);
      }
    }

    return apiSuccess({ received: true, type: event.type });
  } catch (error) {
    if (error instanceof Error && error.message.includes("signature")) {
      return apiError("Invalid signature.", 401, "AUTH_REQUIRED");
    }
    return handleApiError(error);
  }
}
