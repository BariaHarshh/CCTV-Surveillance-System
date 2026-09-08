import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { CorrectiveAction } from "@/models/CorrectiveAction";
import { Incident } from "@/models/Incident";
import { ApprovalRequest } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const oid = new mongoose.Types.ObjectId(organizationId);
    const uid = user._id as mongoose.Types.ObjectId;

    const [tasks, approvals, incidents] = await Promise.all([
      CorrectiveAction.find({
        organizationId: oid,
        $or: [{ assignedTo: uid }, { createdBy: uid }],
        status: { $nin: ["COMPLETED", "CANCELLED"] },
      })
        .sort({ dueAt: 1 })
        .limit(20)
        .lean(),
      ApprovalRequest.find({
        organizationId: oid,
        status: "PENDING",
        $or: [{ requiredApprovers: { $size: 0 } }, { requiredApprovers: uid }],
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Incident.find({
        organizationId: oid,
        assignedTo: uid,
        status: { $in: ["OPEN", "INVESTIGATING", "CONTAINED"] },
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return apiSuccess({
      summary: {
        openTasks: tasks.length,
        pendingApprovals: approvals.length,
        assignedIncidents: incidents.length,
      },
      tasks,
      approvals,
      incidents,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
