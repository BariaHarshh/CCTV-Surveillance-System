import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import {
  getOrCreatePlatformSettings,
  getPlatformRuntimeStatus,
  toPlatformSettingsPublic,
  updatePlatformSettings,
} from "@/lib/platform/platform-settings-service";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const doc = await getOrCreatePlatformSettings();
    return apiSuccess({
      settings: toPlatformSettingsPublic(doc),
      runtime: getPlatformRuntimeStatus(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return apiError("Invalid body", 400, "VALIDATION");
    }

    const doc = await updatePlatformSettings(body, user.name);
    await logAuditEvent({
      actor: user,
      action: "SETTINGS_UPDATED",
      description: `${user.name} updated global platform settings`,
      request,
      severity: "warning",
      metadata: { keys: Object.keys(body) },
    });

    return apiSuccess({
      settings: toPlatformSettingsPublic(doc),
      runtime: getPlatformRuntimeStatus(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
