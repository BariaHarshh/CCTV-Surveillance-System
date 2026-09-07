import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageTasks, canViewTasks } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createTask, listTasks } from "@/lib/emergency/task-service";
import { logAuditEvent } from "@/lib/audit/log";
import { TASK_PRIORITIES } from "@/lib/emergency/constants";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewTasks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const tasks = await listTasks(organizationId, { emergencyId: id });
    return apiSuccess({ tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: z.string().nullable().optional(),
  assignedToName: z.string().optional(),
  assignedTeam: z.string().nullable().optional(),
  assignedTeamName: z.string().optional(),
  dueAt: z.string().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageTasks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid task.", 400, "VALIDATION_ERROR");
    const task = await createTask(
      organizationId,
      { ...parsed.data, emergencyId: id },
      { id: user._id.toString(), name: user.name }
    );
    await logAuditEvent({
      actor: user,
      action: "TASK_CREATED",
      description: `${user.name} created task ${task.taskId}`,
      request,
      targetType: "ResponseTask",
      targetId: task.id,
    });
    return apiSuccess({ task }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
