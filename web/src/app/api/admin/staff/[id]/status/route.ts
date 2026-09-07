import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requirePermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getStaffById, updateStaffStatus } from "@/lib/staff/service";
import { staffStatusSchema } from "@/lib/staff/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();

    const { id } = await params;
    const body = await request.json();
    const parsed = staffStatusSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid status.", 400, "VALIDATION_ERROR");
    }

    const existing = await getStaffById(organizationId, id);
    if (!existing) return apiError("Staff member not found.", 404, "NOT_FOUND");

    const { status, action } = parsed.data;

    if (action === "activate" || status === "ACTIVE") {
      requirePermission(user, "staff:activate");
    } else if (action === "suspend" || status === "SUSPENDED") {
      requirePermission(user, "staff:suspend");
    } else if (action === "unlock") {
      requirePermission(user, "staff:edit");
    }

    const updated = await updateStaffStatus(organizationId, id, status, action);
    if (!updated) return apiError("Staff member not found.", 404, "NOT_FOUND");

    let auditAction: "STAFF_ACTIVATED" | "STAFF_SUSPENDED" | "STAFF_UNLOCKED" | "STAFF_UPDATED" =
      "STAFF_UPDATED";
    if (action === "unlock") auditAction = "STAFF_UNLOCKED";
    else if (status === "SUSPENDED") auditAction = "STAFF_SUSPENDED";
    else if (status === "ACTIVE") auditAction = "STAFF_ACTIVATED";

    const actionLabel =
      action === "unlock"
        ? "unlocked"
        : status === "SUSPENDED"
          ? "suspended"
          : status === "ACTIVE"
            ? "activated"
            : "updated status of";

    await logAuditEvent({
      actor: user,
      action: auditAction,
      description: `${user.name} ${actionLabel} staff account ${updated.userId}`,
      request,
      targetType: "Staff",
      targetId: id,
      targetLabel: updated.name,
      metadata: { organizationId, staffId: updated.userId, status: updated.status },
    });

    return apiSuccess({ staff: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
