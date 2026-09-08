import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { Session } from "@/models/Session";
import { User } from "@/models/User";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();

    const sessions = await Session.find({
      isValid: true,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastActivity: -1 })
      .limit(100)
      .lean();

    const userIds = [...new Set(sessions.map((s) => s.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    return apiSuccess({
      sessions: sessions.map((s) => {
        const user = userMap[s.userId.toString()];
        return {
          id: s._id.toString(),
          userId: s.userId.toString(),
          userName: user?.name ?? "Unknown",
          userRole: user?.role ?? "",
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          lastActivity: s.lastActivity.toISOString(),
          createdAt: s.createdAt.toISOString(),
          rememberMe: s.rememberMe,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
