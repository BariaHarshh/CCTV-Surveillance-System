import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120),
});

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();

    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    actor.name = parsed.data.name.trim();
    await actor.save();

    await logAuditEvent({
      actor,
      action: "PROFILE_UPDATED",
      description: "Super Admin updated profile",
      request,
      targetType: "user",
      targetId: actor._id,
      targetLabel: actor.name,
    });

    return apiSuccess({
      user: {
        id: actor._id.toString(),
        name: actor.name,
        email: actor.email,
        userId: actor.userId,
        role: actor.role,
        status: actor.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
