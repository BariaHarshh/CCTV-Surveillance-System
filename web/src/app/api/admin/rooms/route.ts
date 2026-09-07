import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { listRooms, createRoom } from "@/lib/campus/room-service";
import { roomCreateSchema } from "@/lib/campus/schemas";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "room.view")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { searchParams } = new URL(request.url);
    const rooms = await listRooms(organizationId, {
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      buildingId: searchParams.get("buildingId") ?? undefined,
    });
    return apiSuccess({ rooms });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "room.create")) return apiError("Permission denied.", 403, "FORBIDDEN");

    const parsed = roomCreateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");

    const room = await createRoom(organizationId, parsed.data);
    await logAuditEvent({
      actor: user,
      action: "ROOM_CREATED",
      description: `${user.name} created room ${room.roomId}`,
      request,
      targetType: "Room",
      targetId: room.id,
      targetLabel: room.name,
      metadata: { organizationId, roomId: room.roomId },
    });
    return apiSuccess({ room }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
