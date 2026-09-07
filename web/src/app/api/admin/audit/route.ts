import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    await connectDB();

    const oid = new mongoose.Types.ObjectId(organizationId);

    // Prefer first-class organizationId; fall back to legacy metadata for older rows.
    const logs = await AuditLog.find({
      $or: [{ organizationId: oid }, { "metadata.organizationId": organizationId }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return apiSuccess({
      logs: logs.map((l) => ({
        id: l._id.toString(),
        description: l.description,
        actor: l.actorName,
        action: l.action,
        severity: l.severity,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
