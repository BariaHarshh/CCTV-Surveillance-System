import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/platform/api-webhook-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    return apiSuccess({ keys: await listApiKeys(organizationId) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    const body = await request.json();
    if (!body.name) return apiError("Name required.", 400, "VALIDATION_ERROR");
    const key = await createApiKey(organizationId, body, { id: user._id.toString(), name: user.name });
    await logAuditEvent({ actor: user, action: "API_KEY_CREATED", description: `${user.name} created API key ${key.keyId}`, request });
    return apiSuccess({ key }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("id required.", 400, "VALIDATION_ERROR");
    const ok = await revokeApiKey(organizationId, id);
    if (!ok) return apiError("API key not found.", 404, "RESOURCE_NOT_FOUND");
    await logAuditEvent({ actor: user, action: "API_KEY_REVOKED", description: `${user.name} revoked API key`, request });
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
