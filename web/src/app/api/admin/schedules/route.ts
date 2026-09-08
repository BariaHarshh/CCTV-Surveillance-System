import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { canConfigureAI, canViewAI } from "@/lib/ai/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createSchedule, deleteSchedule, listSchedules, updateSchedule } from "@/lib/ai/schedule-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canViewAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const schedules = await listSchedules(organizationId);
    return apiSuccess({ schedules });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(2),
  timezone: z.string().optional(),
  windows: z.array(z.object({ dayOfWeek: z.number(), startTime: z.string(), endTime: z.string() })).optional(),
  exceptions: z.array(z.object({ date: z.string(), label: z.string(), closed: z.boolean() })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid schedule.", 400, "VALIDATION_ERROR");
    const schedule = await createSchedule(organizationId, parsed.data);
    return apiSuccess({ schedule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const body = await request.json();
    if (!body.id) return apiError("Schedule id required.", 400, "VALIDATION_ERROR");
    const schedule = await updateSchedule(organizationId, body.id, body);
    if (!schedule) return apiError("Schedule not found.", 404, "NOT_FOUND");
    return apiSuccess({ schedule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!canConfigureAI(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return apiError("Schedule id required.", 400, "VALIDATION_ERROR");
    const ok = await deleteSchedule(organizationId, id);
    if (!ok) return apiError("Schedule not found.", 404, "NOT_FOUND");
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
