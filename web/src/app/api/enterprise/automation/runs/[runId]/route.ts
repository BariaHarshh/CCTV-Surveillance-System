import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { WorkflowRun } from "@/models/Enterprise";

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const { runId } = await ctx.params;
    const run = await WorkflowRun.findOne({
      runId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    }).lean();
    if (!run) return apiError("Run not found.", 404, "NOT_FOUND");
    return apiSuccess({
      run,
      timeline: run.steps ?? [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
