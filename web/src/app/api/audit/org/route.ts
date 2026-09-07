import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const oid = new mongoose.Types.ObjectId(organizationId);
    const logs = await AuditLog.find({
      $or: [{ organizationId: oid }, { "metadata.organizationId": organizationId }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return apiSuccess({
      logs: logs.map((l) => ({
        id: l._id.toString(),
        description: l.description,
        actorName: l.actorName,
        action: l.action,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
