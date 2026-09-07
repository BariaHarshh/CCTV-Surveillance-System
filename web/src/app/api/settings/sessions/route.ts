import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { getSessionTokenFromCookie, invalidateAllUserSessions } from "@/lib/auth/session";
import { hashLookupToken } from "@/lib/auth/token-lookup";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { Session } from "@/models/Session";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { user } = await requireOrgMember();
    const sessions = await Session.find({
      userId: user._id.toString(),
      isValid: true,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastActivity: -1 })
      .lean();

    const currentToken = await getSessionTokenFromCookie();
    const currentLookup = currentToken ? hashLookupToken(currentToken) : null;

    return apiSuccess({
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        device: s.userAgent?.slice(0, 80) ?? "Unknown device",
        ipAddress: s.ipAddress,
        lastActive: s.lastActivity?.toISOString() ?? null,
        isCurrent: s.tokenLookup === currentLookup,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const { action } = await request.json();
    if (action !== "logout_others") {
      return apiError("Invalid action.", 400, "VALIDATION_ERROR");
    }
    const currentToken = await getSessionTokenFromCookie();
    await invalidateAllUserSessions(user._id.toString(), currentToken ?? undefined);
    await logAuditEvent({
      actor: user,
      action: "REVOKE_SESSION",
      description: `${user.name} revoked other sessions`,
      request,
      metadata: { organizationId },
    });
    return apiSuccess({ message: "Other sessions revoked." });
  } catch (error) {
    return handleApiError(error);
  }
}
