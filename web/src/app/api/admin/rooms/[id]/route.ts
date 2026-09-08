import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getRoomById, updateRoom } from "@/lib/campus/room-service";
import { roomUpdateSchema } from "@/lib/campus/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "room.view")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const room = await getRoomById(organizationId, id);
    if (!room) return apiError("Room not found.", 404, "NOT_FOUND");
    return apiSuccess({ room });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "room.edit")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = roomUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    const room = await updateRoom(organizationId, id, parsed.data);
    if (!room) return apiError("Room not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "ROOM_UPDATED",
      description: `${user.name} updated room ${room.roomId}`,
      request,
      targetType: "Room",
      targetId: id,
      targetLabel: room.name,
      metadata: { organizationId },
    });
    return apiSuccess({ room });
  } catch (error) {
    return handleApiError(error);
  }
}
