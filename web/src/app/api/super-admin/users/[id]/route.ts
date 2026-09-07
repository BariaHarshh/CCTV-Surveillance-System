import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { platformConfig } from "@/lib/config/platform";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { Session } from "@/models/Session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();
    const { id } = await params;

    const user = await User.findById(id).lean();
    if (!user) {
      return apiError("User not found.", 404, "NOT_FOUND");
    }

    let organizationName = "Platform";
    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId).lean();
      organizationName = org?.basicInformation?.name ?? "Unknown";
    }

    const sessions = await Session.find({
      userId: user._id,
      isValid: true,
      expiresAt: { $gt: new Date() },
    }).lean();

    const threshold = new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000);

    await logAuditEvent({
      actor,
      action: "VIEW_USER",
      description: `Viewed user profile: ${user.name}`,
      targetType: "user",
      targetId: user._id,
      targetLabel: user.name,
    });

    return apiSuccess({
      user: {
        id: user._id.toString(),
        name: user.name,
        userId: user.userId,
        email: user.email,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId?.toString() ?? null,
        organizationName,
        lastLogin: user.lastLogin?.toISOString() ?? null,
        lastActive: user.lastActive?.toISOString() ?? null,
        passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil?.toISOString() ?? null,
        isOnline: Boolean(user.lastActive && user.lastActive >= threshold && user.status === "ACTIVE"),
        createdAt: user.createdAt.toISOString(),
        activeSessions: sessions.length,
      },
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        lastActivity: s.lastActivity.toISOString(),
        createdAt: s.createdAt.toISOString(),
        rememberMe: s.rememberMe,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
