import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requirePermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listStaffMembers, createStaffMember, getStaffDepartments } from "@/lib/staff/service";
import { staffCreateSchema } from "@/lib/staff/schemas";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    requirePermission(user, "staff:view");

    const { searchParams } = new URL(request.url);
    const result = await listStaffMembers(organizationId, {
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      department: searchParams.get("department") ?? undefined,
      position: searchParams.get("position") ?? undefined,
      online: searchParams.get("online") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 20),
      sort: searchParams.get("sort") ?? undefined,
      order: (searchParams.get("order") as "asc" | "desc") ?? undefined,
    });

    const departments = await getStaffDepartments(organizationId);

    return apiSuccess({ ...result, departments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId, organization } = await requireAdmin();
    requirePermission(user, "staff:create");

    const body = await request.json();
    const parsed = staffCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    if (parsed.data.account.userId.toLowerCase().startsWith("adm-")) {
      return apiError("Invalid Staff ID format.", 400, "VALIDATION_ERROR");
    }

    const result = await createStaffMember(organizationId, user, parsed.data);

    await logAuditEvent({
      actor: user,
      action: "STAFF_CREATED",
      description: `${user.name} created staff account ${result.staff.userId}`,
      request,
      targetType: "Staff",
      targetId: result.staff.id,
      targetLabel: result.staff.name,
      metadata: {
        organizationId,
        organizationName: organization.basicInformation.name,
        staffId: result.staff.userId,
      },
    });

    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("already exists") || error.message.includes("already registered")) {
        return apiError(error.message, 409, "DUPLICATE");
      }
    }
    return handleApiError(error);
  }
}
