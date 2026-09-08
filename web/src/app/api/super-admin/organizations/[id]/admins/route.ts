import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { adminCreateSchema } from "@/lib/organizations/schemas";
import {
  createOrganizationAdmin,
  listOrganizationAdmins,
} from "@/lib/admins/service";
import { getOrganizationById } from "@/lib/organizations/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const { id } = await params;
    const q = request.nextUrl.searchParams.get("q") ?? undefined;
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const admins = await listOrganizationAdmins(id, { q, status });
    return apiSuccess({ admins });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;

    const org = await getOrganizationById(id);
    if (!org) return apiError("Organization not found.", 404, "NOT_FOUND");

    const body = await request.json();
    const parsed = adminCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    let result;
    try {
      result = await createOrganizationAdmin(id, parsed.data);
    } catch (e) {
      return apiError(e instanceof Error ? e.message : "Failed to create admin.", 400, "CREATE_FAILED");
    }

    await logAuditEvent({
      actor,
      action: "ADMIN_CREATED",
      description: `Created administrator ${result.admin.name} for ${org.name}`,
      request,
      targetType: "user",
      targetId: result.admin.id,
      targetLabel: result.admin.name,
      metadata: {
        organizationId: org.organizationId,
        adminUserId: result.admin.userId,
      },
    });

    return apiSuccess({
      admin: result.admin,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
