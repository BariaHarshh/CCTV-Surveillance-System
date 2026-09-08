import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageIncidents, canViewIncidents } from "@/lib/ai/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { assignIncident, getIncidentById, updateIncidentStatus } from "@/lib/ai/incident-service";
import { INCIDENT_STATUSES } from "@/lib/ai/constants";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewIncidents(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const result = await getIncidentById(organizationId, id);
    if (!result) return apiError("Incident not found.", 404, "NOT_FOUND");
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  status: z.enum(INCIDENT_STATUSES).optional(),
  assigneeId: z.string().optional(),
  assigneeName: z.string().optional(),
  teamId: z.string().optional(),
  teamName: z.string().optional(),
  escalate: z
    .object({
      type: z.enum(["FIRE", "MEDICAL", "SECURITY", "INTRUSION", "VIOLENCE", "NATURAL_DISASTER", "HAZARDOUS_MATERIAL", "MISSING_PERSON", "CAMPUS_THREAT", "OTHER"]),
      reason: z.string().min(3),
      description: z.string().optional(),
      confirm: z.literal(true),
    })
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageIncidents(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");

    if (parsed.data.escalate) {
      const { escalateIncidentToEmergency } = await import("@/lib/emergency/emergency-service");
      const { canEscalateIncident } = await import("@/lib/emergency/permissions");
      if (!canEscalateIncident(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
      const result = await escalateIncidentToEmergency(organizationId, id, {
        type: parsed.data.escalate.type,
        reason: parsed.data.escalate.reason,
        description: parsed.data.escalate.description,
        actor: { id: user._id.toString(), name: user.name },
      });
      if ("error" in result) return apiError("Incident not found.", 404, "NOT_FOUND");
      await logAuditEvent({
        actor: user,
        action: "INCIDENT_ESCALATED",
        description: `${user.name} escalated incident ${id} to emergency`,
        request,
        targetType: "Incident",
        targetId: id,
        severity: "critical",
      });
      return apiSuccess(result, 201);
    }

    if (parsed.data.status) {
      const incident = await updateIncidentStatus(organizationId, id, parsed.data.status, {
        id: user._id.toString(),
        name: user.name,
      });
      if (!incident) return apiError("Incident not found.", 404, "NOT_FOUND");
      if ("error" in incident) {
        return apiError(`Invalid transition from ${incident.from} to ${incident.to}.`, 400, "INVALID_TRANSITION");
      }
      const action =
        parsed.data.status === "RESOLVED" ? "INCIDENT_RESOLVED" :
        parsed.data.status === "DISMISSED" ? "INCIDENT_DISMISSED" : "INCIDENT_CREATED";
      await logAuditEvent({
        actor: user,
        action,
        description: `${user.name} updated incident ${incident.incidentId} to ${parsed.data.status}`,
        request,
        targetType: "Incident",
        targetId: id,
        targetLabel: incident.incidentId,
      });
      return apiSuccess({ incident });
    }

    if (parsed.data.assigneeId || parsed.data.teamId) {
      const incident = await assignIncident(
        organizationId,
        id,
        parsed.data.assigneeId ?? null,
        parsed.data.assigneeName ?? "",
        parsed.data.teamId && parsed.data.teamName
          ? { teamId: parsed.data.teamId, teamName: parsed.data.teamName }
          : null
      );
      if (!incident) return apiError("Incident not found.", 404, "NOT_FOUND");
      await logAuditEvent({
        actor: user,
        action: "INCIDENT_ASSIGNED",
        description: `${user.name} assigned incident ${incident.incidentId}`,
        request,
        targetType: "Incident",
        targetId: id,
        targetLabel: incident.incidentId,
      });
      return apiSuccess({ incident });
    }

    return apiError("No valid update.", 400, "VALIDATION_ERROR");
  } catch (error) {
    return handleApiError(error);
  }
}
