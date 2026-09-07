import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { ExportJob, newEnterpriseId } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const exports = await ExportJob.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return apiSuccess({ exports });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  type: z.string().min(1).max(80),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid export job.", 400, "VALIDATION_ERROR");

    const job = await ExportJob.create({
      exportId: newEnterpriseId("exp"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      requestedBy: user._id,
      type: parsed.data.type,
      status: "PENDING",
      storageRef: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return apiSuccess({ export: job }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
