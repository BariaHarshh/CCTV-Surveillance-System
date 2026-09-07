import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canConfigureAI, canViewAI } from "@/lib/ai/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createRestrictedZone,
  deleteRestrictedZone,
  listRestrictedZones,
  updateRestrictedZone,
} from "@/lib/ai/zone-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const zones = await listRestrictedZones(organizationId);
    return apiSuccess({ zones });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(2),
  cameraId: z.string().min(1),
  buildingId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  scheduleId: z.string().optional().nullable(),
  allowedRoles: z.array(z.string()).optional(),
  polygon: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid zone.", 400, "VALIDATION_ERROR");
    const zone = await createRestrictedZone(organizationId, parsed.data);
    await logAuditEvent({
      actor: user,
      action: "AI_CONFIGURATION_UPDATED",
      description: `${user.name} created restricted zone ${zone.zoneId}`,
      request,
      metadata: { organizationId, zoneId: zone.zoneId },
    });
    return apiSuccess({ zone }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
