import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listBuildings, createBuilding } from "@/lib/campus/building-service";
import { buildingCreateSchema } from "@/lib/campus/schemas";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "building.view")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { searchParams } = new URL(request.url);
    const buildings = await listBuildings(organizationId, {
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    return apiSuccess({ buildings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "building.create")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const body = await request.json();
    const parsed = buildingCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const building = await createBuilding(organizationId, parsed.data);
    await logAuditEvent({
      actor: user,
      action: "BUILDING_CREATED",
      description: `${user.name} created building ${building.buildingId}`,
      request,
      targetType: "Building",
      targetId: building.id,
      targetLabel: building.name,
      metadata: { organizationId, buildingId: building.buildingId },
    });
    return apiSuccess({ building }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
