import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canActivateEmergency, canViewEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { activateEmergency, listEmergencies } from "@/lib/emergency/emergency-service";
import { startEscalation } from "@/lib/emergency/escalation-engine";
import { logAuditEvent } from "@/lib/audit/log";
import { EMERGENCY_TYPES, CAMPUS_EMERGENCY_MODES } from "@/lib/emergency/constants";
import { SEVERITY_LEVELS } from "@/lib/monitoring/constants";

const createSchema = z.object({
  type: z.enum(EMERGENCY_TYPES),
  reason: z.string().min(3).max(500),
  description: z.string().max(2000).optional(),
  severity: z.enum(SEVERITY_LEVELS).optional(),
  mode: z.enum(CAMPUS_EMERGENCY_MODES).optional(),
  location: z
    .object({
      campus: z.string().optional(),
      building: z.string().optional(),
      buildingId: z.string().optional(),
      floor: z.string().optional(),
      room: z.string().optional(),
      camera: z.string().optional(),
      label: z.string().optional(),
    })
    .optional(),
  affectedBuildingIds: z.array(z.string()).optional(),
  incidentId: z.string().optional(),
  teamIds: z.array(z.string()).optional(),
  playbookId: z.string().optional(),
  confirm: z.literal(true),
});

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listEmergencies(organizationId, {
      status: params.status,
      type: params.type,
      source: params.source,
      excludeTest: params.excludeTest === "true",
      page: params.page ? parseInt(params.page, 10) : 1,
      limit: params.limit ? parseInt(params.limit, 10) : 20,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canActivateEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid emergency activation. Confirmation and reason required.", 400, "VALIDATION_ERROR");

    const emergency = await activateEmergency({
      organizationId,
      type: parsed.data.type,
      reason: parsed.data.reason,
      description: parsed.data.description,
      severity: parsed.data.severity,
      mode: parsed.data.mode,
      location: parsed.data.location,
      affectedBuildingIds: parsed.data.affectedBuildingIds,
      incidentId: parsed.data.incidentId,
      teamIds: parsed.data.teamIds,
      playbookId: parsed.data.playbookId,
      actor: { id: user._id.toString(), name: user.name },
    });

    await startEscalation({
      organizationId,
      emergencyId: emergency.id,
      incidentId: parsed.data.incidentId,
      severity: emergency.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    });

    await logAuditEvent({
      actor: user,
      action: "EMERGENCY_ACTIVATED",
      description: `${user.name} activated emergency ${emergency.emergencyId}: ${parsed.data.type}`,
      request,
      targetType: "Emergency",
      targetId: emergency.id,
      metadata: { type: parsed.data.type, reason: parsed.data.reason },
      severity: "critical",
    });

    return apiSuccess({ emergency }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
