import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canConfigureCameraAI, canViewAI } from "@/lib/ai/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getOrCreateCameraAIConfig,
  getOrCreateOrgAISettings,
  toCameraAIConfigPublic,
  updateCameraAIConfig,
} from "@/lib/ai/config-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const [config, orgSettings] = await Promise.all([
      getOrCreateCameraAIConfig(organizationId, id),
      getOrCreateOrgAISettings(organizationId),
    ]);
    return apiSuccess({ config: toCameraAIConfigPublic(config, orgSettings) });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  modules: z.record(z.string(), z.object({
    enabled: z.boolean().optional(),
    confidenceThreshold: z.number().nullable().optional(),
    cooldownSeconds: z.number().nullable().optional(),
    scheduleId: z.string().nullable().optional(),
    zoneIds: z.array(z.string()).optional(),
  })).optional(),
  occupancyCapacity: z.number().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureCameraAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid config.", 400, "VALIDATION_ERROR");

    const config = await updateCameraAIConfig(organizationId, id, parsed.data);
    const orgSettings = await getOrCreateOrgAISettings(organizationId);

    await logAuditEvent({
      actor: user,
      action: "AI_CONFIGURATION_UPDATED",
      description: `${user.name} updated AI config for camera ${id}`,
      request,
      metadata: { organizationId, cameraId: id },
    });

    return apiSuccess({ config: toCameraAIConfigPublic(config, orgSettings) });
  } catch (error) {
    return handleApiError(error);
  }
}
