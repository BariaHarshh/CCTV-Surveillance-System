import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createWebhook, listWebhookDeliveries, listWebhooks } from "@/lib/platform/api-webhook-service";
import { WEBHOOK_EVENTS } from "@/lib/platform/constants";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    if (request.nextUrl.searchParams.get("deliveries") === "true") {
      return apiSuccess({ deliveries: await listWebhookDeliveries(organizationId, request.nextUrl.searchParams.get("webhookId") ?? undefined) });
    }
    return apiSuccess({ webhooks: await listWebhooks(organizationId), events: WEBHOOK_EVENTS });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    const body = await request.json();
    if (!body.url || !Array.isArray(body.events)) return apiError("url and events required.", 400, "VALIDATION_ERROR");
    const webhook = await createWebhook(organizationId, body, { id: user._id.toString() });
    await logAuditEvent({ actor: user, action: "WEBHOOK_CREATED", description: `${user.name} created webhook ${webhook.webhookId}`, request });
    return apiSuccess({ webhook }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
