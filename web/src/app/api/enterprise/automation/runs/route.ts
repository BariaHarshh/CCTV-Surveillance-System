import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { WorkflowRun } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const runs = await WorkflowRun.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return apiSuccess({ runs });
  } catch (error) {
    return handleApiError(error);
  }
}
