import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageTasks, canViewTasks } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createTask, listTasks } from "@/lib/emergency/task-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewTasks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const tasks = await listTasks(organizationId, { incidentId: id });
    return apiSuccess({ tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageTasks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid task.", 400, "VALIDATION_ERROR");
    const task = await createTask(
      organizationId,
      { ...parsed.data, incidentId: id },
      { id: user._id.toString(), name: user.name }
    );
    return apiSuccess({ task }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
