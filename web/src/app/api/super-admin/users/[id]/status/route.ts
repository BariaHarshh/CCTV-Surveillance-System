import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { User } from "@/models/User";

const statusSchema = z.object({
  action: z.enum(["activate", "suspend", "unlock"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;

    if (actor._id.toString() === id) {
      return apiError("You cannot modify your own account status.", 400, "SELF_ACTION");
    }

    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid action.", 400, "VALIDATION_ERROR");
    }

    const user = await User.findById(id);
    if (!user) {
      return apiError("User not found.", 404, "NOT_FOUND");
    }

    if (user.role === "SUPER_ADMIN") {
      return apiError("Super Admin accounts cannot be modified through this action.", 403, "FORBIDDEN");
    }

    const { action } = parsed.data;
    let auditAction: "ACTIVATE_USER" | "SUSPEND_USER" | "UNLOCK_USER" = "ACTIVATE_USER";
    let description = "";

    switch (action) {
      case "activate":
        user.status = "ACTIVE";
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        auditAction = "ACTIVATE_USER";
        description = `Activated user account: ${user.name}`;
        break;
      case "suspend":
        if (user.status !== "ACTIVE" && user.status !== "INACTIVE") {
          return apiError("Only active or inactive users can be suspended.", 400, "INVALID_STATUS");
        }
        user.status = "SUSPENDED";
        auditAction = "SUSPEND_USER";
        description = `Suspended user account: ${user.name}`;
        break;
      case "unlock":
        user.status = "ACTIVE";
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        auditAction = "UNLOCK_USER";
        description = `Unlocked user account: ${user.name}`;
        break;
    }

    await user.save();

    await logAuditEvent({
      actor,
      action: auditAction,
      description,
      request,
      targetType: "user",
      targetId: user._id,
      targetLabel: user.name,
      severity: action === "suspend" ? "warning" : "info",
    });

    return apiSuccess({
      user: {
        id: user._id.toString(),
        name: user.name,
        status: user.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
