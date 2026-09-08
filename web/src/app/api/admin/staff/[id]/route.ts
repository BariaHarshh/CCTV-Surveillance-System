import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requirePermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getStaffById, updateStaffMember } from "@/lib/staff/service";
import { staffUpdateSchema } from "@/lib/staff/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    requirePermission(user, "staff:view");

    const { id } = await params;
    const staff = await getStaffById(organizationId, id);
    if (!staff) return apiError("Staff member not found.", 404, "NOT_FOUND");

    return apiSuccess({ staff });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    requirePermission(user, "staff:edit");

    const { id } = await params;
    const body = await request.json();

    if (body.role && body.role !== "STAFF") {
      return apiError("Role escalation is not permitted.", 403, "FORBIDDEN");
    }
    if (body.organizationId) {
      return apiError("Organization cannot be changed.", 403, "FORBIDDEN");
    }

    const parsed = staffUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const existing = await getStaffById(organizationId, id);
    if (!existing) return apiError("Staff member not found.", 404, "NOT_FOUND");

    const permissionsChanged =
      parsed.data.permissions &&
      JSON.stringify(parsed.data.permissions.sort()) !== JSON.stringify(existing.permissions.sort());

    const updated = await updateStaffMember(organizationId, id, user, parsed.data);
    if (!updated) return apiError("Staff member not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: permissionsChanged ? "STAFF_PERMISSION_CHANGED" : "STAFF_UPDATED",
      description: `${user.name} updated staff account ${updated.userId}`,
      request,
      targetType: "Staff",
      targetId: id,
      targetLabel: updated.name,
      metadata: { organizationId, staffId: updated.userId },
    });

    return apiSuccess({ staff: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("already exists") || error.message.includes("already registered")) {
        return apiError(error.message, 409, "DUPLICATE");
      }
    }
    return handleApiError(error);
  }
}
