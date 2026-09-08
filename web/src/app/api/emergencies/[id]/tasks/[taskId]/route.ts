import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageTasks } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateTask } from "@/lib/emergency/task-service";
import { logAuditEvent } from "@/lib/audit/log";
import { RESPONSE_TASK_STATUSES, TASK_PRIORITIES } from "@/lib/emergency/constants";

type RouteParams = { params: Promise<{ id: string; taskId: string }> };

const patchSchema = z.object({
  status: z.enum(RESPONSE_TASK_STATUSES).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  assignedToName: z.string().optional(),
  assignedTeam: z.string().nullable().optional(),
  assignedTeamName: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageTasks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { taskId } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");
    const result = await updateTask(organizationId, taskId, parsed.data, {
      id: user._id.toString(),
      name: user.name,
    });
    if ("error" in result) {
      if (result.error === "NOT_FOUND") return apiError("Task not found.", 404, "NOT_FOUND");
      return apiError(`Invalid transition from ${result.from} to ${result.to}.`, 400, "INVALID_TRANSITION");
    }
    if (parsed.data.status === "COMPLETED") {
      await logAuditEvent({
        actor: user,
        action: "TASK_COMPLETED",
        description: `${user.name} completed task ${taskId}`,
        request,
        targetType: "ResponseTask",
        targetId: taskId,
      });
    }
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
