import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canManageFieldTasks, canViewFieldOps } from "@/lib/mobile/permissions";
import { listMyTasks, getTaskDetail, applyTaskAction } from "@/lib/mobile/field-service";
import { createTask } from "@/lib/emergency/task-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const task = await getTaskDetail(organizationId, id);
      if (!task) return apiError("Not found", 404, "NOT_FOUND");
      return apiSuccess({ task });
    }
    const data = await listMyTasks(organizationId, user._id.toString(), {
      status: url.searchParams.get("status") || undefined,
      priority: url.searchParams.get("priority") || undefined,
    });
    return apiSuccess(data);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canManageFieldTasks(user) && user.role !== "ADMIN") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }
    const body = await request.json();
    const task = await createTask(
      organizationId,
      {
        title: String(body.title || "Task"),
        description: body.description,
        priority: body.priority,
        assignedTo: body.assignedTo || user._id.toString(),
        assignedToName: body.assignedToName || user.name,
        assignedTeam: body.assignedTeam,
        assignedTeamName: body.assignedTeamName,
        incidentId: body.incidentId,
        emergencyId: body.emergencyId,
        dueAt: body.dueAt,
        source: body.source || "MOBILE",
        checklist: body.checklist,
      } as never,
      { id: user._id.toString(), name: user.name }
    );
    return apiSuccess({ task }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
