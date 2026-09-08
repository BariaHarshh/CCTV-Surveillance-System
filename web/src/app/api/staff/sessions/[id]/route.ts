import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { Session } from "@/models/Session";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const { id } = await params;

    const session = await Session.findOne({ _id: id, userId: user._id.toString() });
    if (!session) return apiError("Session not found.", 404, "NOT_FOUND");

    session.isValid = false;
    await session.save();

    await logAuditEvent({
      actor: user,
      action: "STAFF_SESSION_REVOKED",
      description: `${user.name} revoked a session`,
      request,
      metadata: { organizationId, sessionId: id },
    });

    return apiSuccess({ message: "Session revoked." });
  } catch (error) {
    return handleApiError(error);
  }
}
