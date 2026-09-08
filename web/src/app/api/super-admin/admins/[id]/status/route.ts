import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { User } from "@/models/User";

const statusSchema = z.object({
  action: z.enum(["activate", "suspend"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid action.", 400, "VALIDATION_ERROR");
    }

    const admin = await User.findOne({ _id: id, role: "ADMIN" });
    if (!admin) return apiError("Administrator not found.", 404, "NOT_FOUND");

    const { action } = parsed.data;
    if (action === "activate") {
      admin.status = "ACTIVE";
    } else {
      admin.status = "SUSPENDED";
    }
    await admin.save();

    await logAuditEvent({
      actor,
      action: action === "activate" ? "ADMIN_ACTIVATED" : "ADMIN_SUSPENDED",
      description: `${action === "activate" ? "Activated" : "Suspended"} administrator: ${admin.name}`,
      request,
      targetType: "user",
      targetId: admin._id,
      targetLabel: admin.name,
      severity: action === "suspend" ? "warning" : "info",
    });

    return apiSuccess({
      admin: {
        id: admin._id.toString(),
        name: admin.name,
        status: admin.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
