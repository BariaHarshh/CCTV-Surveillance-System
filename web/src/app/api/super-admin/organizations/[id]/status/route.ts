import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateOrganizationStatus, getOrganizationById } from "@/lib/organizations/service";
import type { OrganizationStatus } from "@/models/Organization";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "INACTIVE"]),
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
      return apiError(parsed.error.issues[0]?.message ?? "Invalid status.", 400, "VALIDATION_ERROR");
    }

    const org = await updateOrganizationStatus(id, parsed.data.status as OrganizationStatus);
    if (!org) return apiError("Organization not found.", 404, "NOT_FOUND");

    const action =
      parsed.data.status === "ACTIVE"
        ? "ORGANIZATION_ACTIVATED"
        : parsed.data.status === "SUSPENDED"
          ? "ORGANIZATION_SUSPENDED"
          : "ORGANIZATION_UPDATED";

    await logAuditEvent({
      actor,
      action,
      description: `Organization ${org.basicInformation.name} status changed to ${parsed.data.status}`,
      request,
      targetType: "organization",
      targetId: org._id,
      targetLabel: org.basicInformation.name,
      severity: parsed.data.status === "SUSPENDED" ? "warning" : "info",
    });

    const summary = await getOrganizationById(id);
    return apiSuccess({ organization: summary });
  } catch (error) {
    return handleApiError(error);
  }
}
