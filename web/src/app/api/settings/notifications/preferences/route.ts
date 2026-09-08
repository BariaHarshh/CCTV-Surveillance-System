import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { NotificationPreference } from "@/models/Platform";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    let pref = await NotificationPreference.findOne({
      userId: user._id,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (!pref) {
      pref = await NotificationPreference.create({
        userId: user._id,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      });
    }
    return apiSuccess({ preferences: { channels: pref.channels, categories: pref.categories } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const body = await request.json();
    const pref = await NotificationPreference.findOneAndUpdate(
      { userId: user._id, organizationId: new mongoose.Types.ObjectId(organizationId) },
      { $set: { ...(body.channels ? { channels: body.channels } : {}), ...(body.categories ? { categories: body.categories } : {}) } },
      { upsert: true, new: true }
    );
    return apiSuccess({ preferences: { channels: pref.channels, categories: pref.categories } });
  } catch (error) {
    return handleApiError(error);
  }
}
