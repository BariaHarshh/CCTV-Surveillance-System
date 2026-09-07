import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { AuthActivity } from "@/models/AuthActivity";
import { User } from "@/models/User";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return apiError("Security access required.", 403, "PERMISSION_DENIED");
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
    const orgUsers = await User.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deletedAt: null,
    })
      .select("_id email name")
      .lean();
    const userIds = orgUsers.map((u) => u._id);
    const byId = new Map(orgUsers.map((u) => [u._id.toString(), u]));

    const rows = await AuthActivity.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return apiSuccess({
      history: rows.map((r) => {
        const u = r.userId ? byId.get(String(r.userId)) : null;
        const success = r.type === "LOGIN_SUCCESS";
        return {
          id: r._id.toString(),
          user: u?.name ?? u?.email ?? "Unknown",
          email: u?.email ?? null,
          timestamp: r.createdAt?.toISOString?.() ?? null,
          ip: r.ipAddress ?? null,
          device: r.userAgent ?? null,
          browser: r.userAgent ?? null,
          success,
          type: r.type,
          reason: typeof r.metadata?.reason === "string" ? r.metadata.reason : r.type,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
