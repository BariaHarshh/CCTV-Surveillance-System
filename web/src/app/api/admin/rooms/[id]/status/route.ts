import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { can } from "@/lib/permissions/capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateRoomStatus } from "@/lib/campus/room-service";
import { roomStatusSchema } from "@/lib/campus/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    if (!can(user, "room.status")) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = roomStatusSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid status.", 400, "VALIDATION_ERROR");
    const room = await updateRoomStatus(organizationId, id, parsed.data.status);
    if (!room) return apiError("Room not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "ROOM_STATUS_CHANGED",
      description: `${user.name} set room ${room.roomId} to ${parsed.data.status}`,
      request,
      targetType: "Room",
      targetId: id,
      targetLabel: room.name,
      metadata: { organizationId, status: parsed.data.status },
    });
    return apiSuccess({ room });
  } catch (error) {
    return handleApiError(error);
  }
}
