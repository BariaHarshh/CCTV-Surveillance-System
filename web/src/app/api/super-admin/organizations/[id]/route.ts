import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getOrganizationById,
  updateOrganization,
  softDeleteOrganization,
} from "@/lib/organizations/service";
import { organizationCreateSchema } from "@/lib/organizations/schemas";

const deleteSchema = z.object({
  confirmName: z.string().min(1),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const { id } = await params;
    const org = await getOrganizationById(id);
    if (!org) return apiError("Organization not found.", 404, "NOT_FOUND");
    return apiSuccess({ organization: org });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = organizationCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }
    const org = await updateOrganization(id, parsed.data);
    if (!org) return apiError("Organization not found.", 404, "NOT_FOUND");

    await logAuditEvent({
      actor,
      action: "ORGANIZATION_UPDATED",
      description: `Updated organization: ${org.name}`,
      request,
      targetType: "organization",
      targetId: id,
      targetLabel: org.name,
    });

    return apiSuccess({ organization: org });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;

    const existing = await getOrganizationById(id);
    if (!existing) return apiError("Organization not found.", 404, "NOT_FOUND");

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Confirmation name is required.", 400, "VALIDATION_ERROR");
    }

    if (parsed.data.confirmName.trim() !== existing.name) {
      return apiError("Organization name does not match.", 400, "CONFIRMATION_FAILED");
    }

    await softDeleteOrganization(id);

    await logAuditEvent({
      actor,
      action: "ORGANIZATION_DELETED",
      description: `Archived organization: ${existing.name}`,
      request,
      targetType: "organization",
      targetId: id,
      targetLabel: existing.name,
      severity: "warning",
    });

    return apiSuccess({ message: "Organization archived successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
