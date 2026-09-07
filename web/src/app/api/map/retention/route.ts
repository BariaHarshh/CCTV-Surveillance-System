import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canEditMap, canViewMap } from "@/lib/map/permissions";
import { connectDB } from "@/lib/db/connect";
import { LocationRetentionPolicy } from "@/models/Map";
import mongoose from "mongoose";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    await connectDB();
    const policy =
      (await LocationRetentionPolicy.findOne({
        organizationId: new mongoose.Types.ObjectId(organizationId),
      })) ??
      (await LocationRetentionPolicy.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
      }));
    return apiSuccess({
      retention: {
        locationHistoryDays: policy.locationHistoryDays,
        teamLocationDays: policy.teamLocationDays,
        assetLocationDays: policy.assetLocationDays,
        cameraLocationDays: policy.cameraLocationDays,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canEditMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    await connectDB();
    const policy = await LocationRetentionPolicy.findOneAndUpdate(
      { organizationId: new mongoose.Types.ObjectId(organizationId) },
      {
        $set: {
          locationHistoryDays: Number(body.locationHistoryDays ?? 90),
          teamLocationDays: Number(body.teamLocationDays ?? 30),
          assetLocationDays: Number(body.assetLocationDays ?? 365),
          cameraLocationDays: Number(body.cameraLocationDays ?? 365),
          updatedBy: user._id,
        },
        $setOnInsert: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      },
      { upsert: true, new: true }
    );
    await logAuditEvent({
      actor: user,
      action: "RETENTION_UPDATED",
      description: "Updated location retention policy",
      metadata: { scope: "location" },
    });
    return apiSuccess({
      retention: {
        locationHistoryDays: policy.locationHistoryDays,
        teamLocationDays: policy.teamLocationDays,
        assetLocationDays: policy.assetLocationDays,
        cameraLocationDays: policy.cameraLocationDays,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
