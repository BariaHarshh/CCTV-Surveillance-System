import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requirePermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrganizationById, updateOrganization } from "@/lib/organizations/service";
import { organizationCreateSchema } from "@/lib/organizations/schemas";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    requirePermission(user, "org:view");

    const org = await getOrganizationById(organizationId);
    if (!org) return apiError("Organization not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "ORGANIZATION_VIEWED",
      description: `${user.name} viewed organization profile`,
      request,
      targetType: "Organization",
      targetId: organizationId,
      targetLabel: org.name,
      metadata: { organizationId },
    });

    return apiSuccess({ organization: org });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    requirePermission(user, "org:edit");

    const body = await request.json();
    const parsed = organizationCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const updated = await updateOrganization(organizationId, parsed.data);
    if (!updated) return apiError("Organization not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor: user,
      action: "ORGANIZATION_UPDATED",
      description: `${user.name} updated organization profile`,
      request,
      targetType: "Organization",
      targetId: organizationId,
      targetLabel: updated.name,
      metadata: { organizationId },
    });

    return apiSuccess({ organization: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return apiError(error.message, 403, "FORBIDDEN");
    }
    return handleApiError(error);
  }
}
