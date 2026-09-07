import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageEmergency, canResolveEmergency, canViewEmergency } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getEmergencyById, updateEmergency, updateEmergencyStatus } from "@/lib/emergency/emergency-service";
import { getPlaybookById } from "@/lib/emergency/playbook-service";
import { getActiveEscalations } from "@/lib/emergency/escalation-engine";
import { listTasks } from "@/lib/emergency/task-service";
import { logAuditEvent } from "@/lib/audit/log";
import { EMERGENCY_STATUSES, CAMPUS_EMERGENCY_MODES } from "@/lib/emergency/constants";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const emergency = await getEmergencyById(organizationId, id);
    if (!emergency) return apiError("Emergency not found.", 404, "NOT_FOUND");
    const [playbook, escalations, tasks] = await Promise.all([
      emergency.playbookId ? getPlaybookById(organizationId, emergency.playbookId) : null,
      getActiveEscalations(organizationId, id),
      listTasks(organizationId, { emergencyId: id }),
    ]);
    return apiSuccess({ emergency, playbook, escalations, tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  status: z.enum(EMERGENCY_STATUSES).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  teamIds: z.array(z.string()).optional(),
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
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageEmergency(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");

    const actor = { id: user._id.toString(), name: user.name };

    if (parsed.data.status) {
      if ((parsed.data.status === "RESOLVED" || parsed.data.status === "CANCELLED") && !canResolveEmergency(user)) {
        return apiError("Permission denied.", 403, "FORBIDDEN");
      }
      const result = await updateEmergencyStatus(organizationId, id, parsed.data.status, actor, parsed.data.notes);
      if ("error" in result) {
        if (result.error === "NOT_FOUND") return apiError("Emergency not found.", 404, "NOT_FOUND");
        return apiError(`Invalid transition from ${result.from} to ${result.to}.`, 400, "INVALID_TRANSITION");
      }
      await logAuditEvent({
        actor: user,
        action: parsed.data.status === "RESOLVED" ? "EMERGENCY_RESOLVED" : "EMERGENCY_UPDATED",
        description: `${user.name} set emergency ${id} to ${parsed.data.status}`,
        request,
        targetType: "Emergency",
        targetId: id,
      });
      return apiSuccess(result);
    }

    const result = await updateEmergency(organizationId, id, parsed.data, actor);
    if (!result) return apiError("Emergency not found.", 404, "NOT_FOUND");
    if ("error" in result) return apiError("Emergency is closed.", 400, "CLOSED");
    await logAuditEvent({
      actor: user,
      action: "EMERGENCY_UPDATED",
      description: `${user.name} updated emergency ${id}`,
      request,
      targetType: "Emergency",
      targetId: id,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
