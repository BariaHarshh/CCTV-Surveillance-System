import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import {
  getFieldDashboard,
  getSupervisorDashboard,
  getOperationsDashboard,
  getOperationsAnalytics,
} from "@/lib/mobile/field-service";
import {
  listDirectory,
  listEquipment,
  listInspections,
  listPatrols,
  listCertifications,
  completeInspection,
  startPatrol,
  checkPatrolPoint,
  scanQrToken,
  equipmentAction,
  ensureDefaultChecklists,
} from "@/lib/mobile/ops-service";
import { getPushAnalytics, registerPushSubscription } from "@/lib/mobile/push-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "field";

    if (view === "field") return apiSuccess(await getFieldDashboard(organizationId, user._id.toString()));
    if (view === "supervisor") return apiSuccess(await getSupervisorDashboard(organizationId));
    if (view === "operations") return apiSuccess(await getOperationsDashboard(organizationId));
    if (view === "analytics") return apiSuccess({ analytics: await getOperationsAnalytics(organizationId) });
    if (view === "directory") return apiSuccess({ directory: await listDirectory(organizationId) });
    if (view === "equipment") return apiSuccess({ equipment: await listEquipment(organizationId) });
    if (view === "inspections") {
      await ensureDefaultChecklists(organizationId);
      return apiSuccess({ inspections: await listInspections(organizationId) });
    }
    if (view === "patrol") return apiSuccess(await listPatrols(organizationId));
    if (view === "certifications") return apiSuccess({ certifications: await listCertifications(organizationId) });
    if (view === "push") return apiSuccess(await getPushAnalytics(organizationId));
    if (view === "scan") {
      const token = url.searchParams.get("token") || "";
      return apiSuccess(await scanQrToken(organizationId, token));
    }
    return apiError("Unknown view", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "complete_inspection") {
      const run = await completeInspection(
        organizationId,
        user,
        String(body.inspectionId),
        body.result,
        body.notes
      );
      if (!run) return apiError("Not found", 404, "NOT_FOUND");
      return apiSuccess({
        inspectionId: run.inspectionId,
        result: run.result,
        followUpTaskId: run.followUpTaskId,
      });
    }
    if (action === "start_patrol") {
      const run = await startPatrol(organizationId, user, String(body.routeId));
      if (!run) return apiError("Route not found", 404, "NOT_FOUND");
      return apiSuccess({ patrolId: run.patrolId, status: run.status }, 201);
    }
    if (action === "patrol_checkpoint") {
      const run = await checkPatrolPoint(
        organizationId,
        user,
        String(body.patrolId),
        String(body.checkpointId),
        { note: body.note, missed: body.missed }
      );
      if (!run || "error" in (run as object)) return apiError("Checkpoint error", 400, "VALIDATION");
      return apiSuccess({ patrolId: (run as { patrolId: string }).patrolId, status: (run as { status: string }).status });
    }
    if (action === "equipment") {
      const eq = await equipmentAction(
        organizationId,
        user,
        String(body.equipmentId),
        body.op,
        body.note
      );
      if (!eq) return apiError("Not found", 404, "NOT_FOUND");
      return apiSuccess({ equipmentId: eq.equipmentId, status: eq.status });
    }
    if (action === "push_subscribe") {
      await registerPushSubscription(organizationId, user._id.toString(), body.subscription);
      await logAuditEvent({
        actor: user,
        action: "PUSH_SUBSCRIBED",
        description: "Registered push subscription",
      });
      return apiSuccess({ ok: true });
    }
    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
