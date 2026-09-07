import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { Session } from "@/models/Session";
import { User } from "@/models/User";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;

    const session = await Session.findById(id);
    if (!session || !session.isValid) {
      return apiError("Session not found.", 404, "NOT_FOUND");
    }

    const user = await User.findById(session.userId);

    session.isValid = false;
    await session.save();

    await logAuditEvent({
      actor,
      action: "REVOKE_SESSION",
      description: `Revoked session for ${user?.name ?? "user"}`,
      request,
      targetType: "session",
      targetId: session._id,
      targetLabel: user?.name ?? null,
      severity: "warning",
    });

    return apiSuccess({ message: "Session revoked successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
