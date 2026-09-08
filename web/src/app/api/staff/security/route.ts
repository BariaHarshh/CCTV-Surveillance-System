import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { getSessionTokenFromCookie, invalidateAllUserSessions } from "@/lib/auth/session";
import { hashLookupToken } from "@/lib/auth/token-lookup";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { Session } from "@/models/Session";
import { AuthActivity } from "@/models/AuthActivity";
import { User } from "@/models/User";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const dbUser = await User.findById(user._id);

    const sessions = await Session.find({ userId: user._id.toString(), isValid: true, expiresAt: { $gt: new Date() } })
      .sort({ lastActivity: -1 })
      .lean();

    const currentToken = await getSessionTokenFromCookie();
    const currentLookup = currentToken ? hashLookupToken(currentToken) : null;

    const activity = await AuthActivity.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return apiSuccess({
      passwordChangedAt: dbUser?.passwordChangedAt?.toISOString() ?? null,
      mustChangePassword: dbUser?.mustChangePassword ?? false,
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        device: s.userAgent?.slice(0, 80) ?? "Unknown device",
        browser: s.userAgent?.slice(0, 40) ?? "Browser",
        ipAddress: s.ipAddress,
        lastActive: s.lastActivity?.toISOString() ?? null,
        createdAt: s.createdAt?.toISOString() ?? null,
        isCurrent: s.tokenLookup === currentLookup,
        status: s.isValid ? "Active" : "Revoked",
      })),
      recentLogins: activity.map((a) => ({
        type: a.type,
        createdAt: a.createdAt.toISOString(),
        ipAddress: a.ipAddress,
      })),
      organizationId,
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

    if (action === "logout_others") {
      const currentToken = await getSessionTokenFromCookie();
      await invalidateAllUserSessions(user._id.toString(), currentToken ?? undefined);
      await logAuditEvent({
        actor: user,
        action: "STAFF_SESSION_REVOKED",
        description: `${user.name} revoked other sessions`,
        request,
        metadata: { organizationId },
      });
      return apiSuccess({ message: "Other sessions revoked." });
    }

    return apiError("Invalid action.", 400, "VALIDATION_ERROR");
  } catch (error) {
    return handleApiError(error);
  }
}
