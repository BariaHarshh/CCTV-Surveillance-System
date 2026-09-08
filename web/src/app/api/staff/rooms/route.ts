import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireStaff } from "@/lib/auth/require-staff";
import { can } from "@/lib/permissions/capabilities";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listRooms } from "@/lib/campus/room-service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireStaff();
    if (!can(user, "room.view")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { searchParams } = new URL(request.url);
    const rooms = await listRooms(organizationId, { buildingId: searchParams.get("buildingId") ?? undefined });
    return apiSuccess({ rooms });
  } catch (error) {
    return handleApiError(error);
  }
}
