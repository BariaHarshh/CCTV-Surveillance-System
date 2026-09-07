import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrganizationById } from "@/lib/organizations/service";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const { id } = await params;
    const org = await getOrganizationById(id);
    if (!org) return apiError("Organization not found.", 404, "NOT_FOUND");

    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 40)));
    const oid = new mongoose.Types.ObjectId(id);

    const orgUsers = await User.find({ organizationId: oid }).select("_id").lean();
    const actorIds = orgUsers.map((u) => u._id);

    const logs = await AuditLog.find({
      $or: [
        { organizationId: oid },
        { "metadata.organizationId": id },
        { "metadata.organizationId": org.organizationId },
        ...(actorIds.length ? [{ actorId: { $in: actorIds } }] : []),
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return apiSuccess({
      activity: logs.map((l) => ({
        id: l._id.toString(),
        action: l.action,
        description: l.description,
        actorName: l.actorName,
        actorRole: l.actorRole,
        severity: l.severity,
        targetType: l.targetType,
        targetLabel: l.targetLabel,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
