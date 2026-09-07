import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requirePermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { invalidateAllUserSessions } from "@/lib/auth/session";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { resetStaffPassword } from "@/lib/staff/service";
import { generateSecurePassword, assertPasswordStrength } from "@/lib/admins/password-generator";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    requirePermission(user, "staff:reset-password");

    const { id } = await params;
    const password = generateSecurePassword();
    assertPasswordStrength(password);

    const result = await resetStaffPassword(organizationId, id, password);
    if (!result) return apiError("Staff member not found.", 404, "NOT_FOUND");

    await invalidateAllUserSessions(id);

    await logAuditEvent({
      actor: user,
      action: "STAFF_PASSWORD_RESET",
      description: `${user.name} reset password for staff ${result.staff.userId}`,
      request,
      targetType: "Staff",
      targetId: id,
      targetLabel: result.staff.name,
      metadata: { organizationId, staffId: result.staff.userId },
    });

    return apiSuccess({
      staff: result.staff,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
